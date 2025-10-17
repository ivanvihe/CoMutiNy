"""Parser for the custom `.map` text format used by CoMutiNy."""

from __future__ import annotations

import re
from dataclasses import asdict
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from .models import MapArea, MapDefinition, MapDoor, MapObject, MapPosition, MapSize


class MapLoaderError(RuntimeError):
    """Raised when a map file cannot be parsed."""


_SECTION_PATTERN = re.compile(r"^\[(?P<name>[^\]]+)\]$")
def _normalise_key(raw: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "_", raw.lower().strip())
    return re.sub(r"_+", "_", cleaned).strip("_")


def _parse_sections(contents: str) -> Dict[str, List[str]]:
    sections: Dict[str, List[str]] = {"meta": []}
    current = "meta"

    for raw_line in contents.splitlines():
        trimmed = raw_line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue

        inline_comment = re.search(r"\s+#(?![0-9A-Fa-f])", trimmed)
        if inline_comment:
            trimmed = trimmed[: inline_comment.start()].strip()
            if not trimmed:
                continue

        match = _SECTION_PATTERN.match(trimmed)
        if match:
            current = _normalise_key(match.group("name")) or "meta"
            sections.setdefault(current, [])
            continue

        sections.setdefault(current, []).append(trimmed)

    return sections


def _parse_key_values(lines: Iterable[str]) -> Dict[str, str]:
    result: Dict[str, str] = {}

    for line in lines:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        normalised_key = _normalise_key(key)
        result[normalised_key] = value.strip()

    return result


def _parse_dimension(value: str) -> MapSize:
    parts = [
        int(part)
        for part in re.split(r"[x,]", value)
        if part.strip().isdigit()
    ]
    if len(parts) >= 2 and parts[0] > 0 and parts[1] > 0:
        return MapSize(width=parts[0], height=parts[1])
    raise MapLoaderError(f"Dimensiones inválidas: '{value}'")


def _parse_coordinate(value: str) -> MapPosition:
    tokens = [token for token in re.split(r"[x,]", value) if token.strip()]
    if len(tokens) == 2 and all(token.strip().isdigit() for token in tokens):
        return MapPosition(x=int(tokens[0]), y=int(tokens[1]))

    # Allow whitespace separated coordinates as a fallback
    parts = [token for token in value.split() if token.strip()]
    if len(parts) == 2 and all(part.isdigit() for part in parts):
        return MapPosition(x=int(parts[0]), y=int(parts[1]))

    raise MapLoaderError(f"Coordenada inválida: '{value}'")


def _ensure_unique_id(base: str, seen: Dict[str, int]) -> str:
    counter = seen.setdefault(base, 0)
    if counter == 0:
        seen[base] = 1
        return base

    while True:
        counter += 1
        candidate = f"{base}-{counter}"
        if candidate not in seen:
            seen[base] = counter
            seen[candidate] = 1
            return candidate


def _parse_object_line(line: str, *, registry: Dict[str, int]) -> MapObject:
    cleaned = line.lstrip("-").strip()
    if not cleaned:
        raise MapLoaderError("Entrada de objeto vacía")

    solid = False
    if cleaned.startswith("!"):
        solid = True
        cleaned = cleaned[1:].strip()

    label: str | None = None
    if "|" in cleaned:
        cleaned, label = [segment.strip() for segment in cleaned.split("|", 1)]
        if not cleaned:
            raise MapLoaderError("Entrada de objeto sin identificador")

    # Separate identifier and coordinates
    parts = re.split(r"\s*@\s*|\s*:\s*", cleaned, maxsplit=1)
    if len(parts) == 2:
        reference, coordinates = parts
    else:
        tokens = cleaned.split()
        if len(tokens) < 2:
            raise MapLoaderError(f"No se pudieron determinar las coordenadas en '{line}'")
        reference = tokens[0]
        coordinates = " ".join(tokens[1:])

    reference = reference.strip()
    if not reference:
        raise MapLoaderError("Objeto sin identificador")

    coordinates = coordinates.strip()
    if not coordinates:
        raise MapLoaderError(f"Objeto '{reference}' sin coordenadas")

    position = _parse_coordinate(coordinates)

    if "#" in reference:
        object_id, instance_part = reference.split("#", 1)
        object_id = object_id.strip()
        instance_id = (instance_part or object_id).strip()
    else:
        object_id = reference
        instance_id = reference

    if not object_id:
        raise MapLoaderError("Identificador de objeto vacío")

    unique_instance = _ensure_unique_id(instance_id, registry)

    metadata = {"objectId": object_id, "instanceId": unique_instance}
    if instance_id != unique_instance:
        metadata["originalInstanceId"] = instance_id

    name = label or unique_instance

    return MapObject(
        id=unique_instance,
        name=name,
        position=position,
        size=MapSize(1, 1),
        solid=solid,
        metadata=metadata,
    )


def _split_door_entries(value: str) -> List[str]:
    entries: List[str] = []
    for raw_entry in re.split(r"[;,\n]", value):
        trimmed = raw_entry.strip()
        if trimmed:
            entries.append(trimmed)
    return entries


def _parse_door_entry(value: str) -> Tuple[MapPosition, str | None, MapPosition | None]:
    if "->" in value:
        coordinate_part, remainder = value.split("->", 1)
    elif ":" in value:
        coordinate_part, remainder = value.split(":", 1)
    else:
        coordinate_part, remainder = value, ""

    position = _parse_coordinate(coordinate_part.strip())

    target_map: str | None = None
    target_position: MapPosition | None = None

    remainder = remainder.strip()
    if remainder:
        if "@" in remainder:
            map_part, coordinate_target = remainder.split("@", 1)
            target_map = map_part.strip() or None
            coordinate_target = coordinate_target.strip()
            if coordinate_target:
                target_position = _parse_coordinate(coordinate_target)
        else:
            target_map = remainder.strip() or None

    return position, target_map, target_position


def _build_door_definitions(
    values: Iterable[str],
    *,
    map_id: str,
    kind: str,
    registry: Dict[str, int],
) -> Tuple[List[MapDoor], List[MapObject]]:
    doors: List[MapDoor] = []
    objects: List[MapObject] = []

    entries = list(values)
    for index, raw_entry in enumerate(entries):
        try:
            position, target_map, target_position = _parse_door_entry(raw_entry)
        except MapLoaderError as error:
            raise MapLoaderError(
                f"Entrada de puerta inválida '{raw_entry}'"
            ) from error

        door_id = _ensure_unique_id(f"{map_id}-door-{kind}", registry)
        door = MapDoor(
            id=door_id,
            kind=kind,
            position=position,
            target_map=target_map,
            target_position=target_position,
        )
        doors.append(door)

        if kind == "out":
            name = "Acceso principal"
            if len(entries) > 1:
                name = f"Acceso {index + 1}"

            metadata: Dict[str, object] = {
                "objectId": "community_door",
                "instanceId": door_id,
                "type": "door",
                "doorKind": kind,
            }
            if target_map:
                metadata["targetMap"] = target_map
            if target_position:
                metadata["targetPosition"] = {
                    "x": target_position.x,
                    "y": target_position.y,
                }

            objects.append(
                MapObject(
                    id=door_id,
                    name=name,
                    position=position,
                    size=MapSize(1, 1),
                    solid=False,
                    metadata=metadata,
                )
            )

    return doors, objects


def _build_blocked_areas(size: MapSize) -> List[MapArea]:
    if size.width <= 0 or size.height <= 0:
        return []

    width = size.width
    height = size.height

    return [
        MapArea(x=0, y=0, width=width, height=1),
        MapArea(x=0, y=height - 1, width=width, height=1),
        MapArea(x=0, y=0, width=1, height=height),
        MapArea(x=width - 1, y=0, width=1, height=height),
    ]


def _parse_objects(
    lines: Iterable[str],
    *,
    registry: Dict[str, int],
) -> List[MapObject]:
    objects: List[MapObject] = []

    for index, line in enumerate(lines):
        cleaned = line.strip()
        if not cleaned or cleaned.startswith("#"):
            continue

        try:
            obj = _parse_object_line(cleaned, registry=registry)
        except MapLoaderError as error:
            raise MapLoaderError(f"Error al analizar objeto #{index + 1}: {error}") from error

        objects.append(obj)

    return objects


def load_map(path: str | Path) -> MapDefinition:
    file_path = Path(path)
    try:
        contents = file_path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise MapLoaderError(f"No se encontró el mapa: {path}") from exc

    sections = _parse_sections(contents)
    metadata = _parse_key_values(sections.get("meta", []))

    try:
        size = _parse_dimension(metadata.get("dimensions", ""))
    except MapLoaderError:
        size = MapSize(width=0, height=0)

    spawn = None
    for key in ("starting_point", "spawn_point", "spawn"):
        if metadata.get(key):
            try:
                spawn = _parse_coordinate(metadata[key])
                break
            except MapLoaderError:
                continue
    if spawn is None:
        spawn = MapPosition(x=size.width // 2 if size.width else 0, y=size.height // 2 if size.height else 0)

    inbound_raw = metadata.get("door_in") or ""
    outbound_raw = metadata.get("door_out") or ""
    legacy_position = metadata.get("door_position")

    inbound_entries: List[str] = []
    outbound_entries: List[str] = []

    if inbound_raw:
        inbound_entries = _split_door_entries(inbound_raw)

    if outbound_raw:
        outbound_entries = _split_door_entries(outbound_raw)
    elif legacy_position:
        try:
            position = _parse_coordinate(legacy_position)
            outbound_entries = [f"{position.x}x{position.y}"]
        except MapLoaderError:
            outbound_entries = []

    raw_id = (metadata.get("id") or file_path.stem).strip()
    map_id = raw_id or file_path.stem
    title = metadata.get("title") or metadata.get("name") or map_id
    biome = metadata.get("biome", "Comunidad")
    description = metadata.get("description", "")

    theme = {"borderColour": metadata.get("border_colour") or metadata.get("border_color")}

    registry: Dict[str, int] = {}
    objects: List[MapObject] = []
    doors: List[MapDoor] = []

    if outbound_entries:
        parsed_doors, door_objects = _build_door_definitions(
            outbound_entries, map_id=map_id, kind="out", registry=registry
        )
        doors.extend(parsed_doors)
        objects.extend(door_objects)

    if inbound_entries:
        parsed_doors, _ = _build_door_definitions(
            inbound_entries, map_id=map_id, kind="in", registry=registry
        )
        doors.extend(parsed_doors)

    section_objects = sections.get("objects", [])
    objects.extend(_parse_objects(section_objects, registry=registry))

    blocked_areas = _build_blocked_areas(size)

    extra = {
        key: value
        for key, value in metadata.items()
        if key
        not in {
            "id",
            "title",
            "name",
            "biome",
            "description",
            "dimensions",
            "starting_point",
            "spawn_point",
            "spawn",
            "door_position",
            "door_in",
            "door_out",
            "border_colour",
            "border_color",
        }
    }

    return MapDefinition(
        id=map_id,
        name=title,
        biome=biome,
        description=description,
        size=size,
        spawn=spawn,
        blocked_areas=blocked_areas,
        objects=objects,
        doors=doors,
        portals=[],
        theme=theme,
        source_path=str(file_path),
        extra=extra,
    )


def load_maps(directory: str | Path) -> List[MapDefinition]:
    base_path = Path(directory)
    if not base_path.exists():
        return []

    maps: List[MapDefinition] = []

    for entry in sorted(base_path.glob("*.map")):
        try:
            maps.append(load_map(entry))
        except MapLoaderError as error:
            raise MapLoaderError(f"Error al cargar '{entry.name}': {error}") from error

    return maps
