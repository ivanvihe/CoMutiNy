"""Parser for the custom `.map` text format used by CoMutiNy."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from .models import (
    MapArea,
    MapDefinition,
    MapDoor,
    MapLayer,
    MapObject,
    MapPosition,
    MapSize,
    MapTileType,
)


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


def _parse_bool(value: str | None, *, default: bool = False) -> bool:
    if value is None:
        return default

    text = value.strip().lower()
    if text in {"true", "1", "yes", "y", "on", "solid"}:
        return True
    if text in {"false", "0", "no", "n", "off", "transparent", "none"}:
        return False
    return default


_DEFAULT_TILE_TYPE = MapTileType(
    id="floor",
    symbol=".",
    name="Suelo",
    collides=False,
    transparent=True,
    color="#8eb5ff",
    metadata={"default": True},
)


def _parse_tile_definitions(lines: Iterable[str]) -> Tuple[Dict[str, MapTileType], Dict[str, str]]:
    tile_types: Dict[str, MapTileType] = {}
    symbol_map: Dict[str, str] = {}

    for line in lines:
        cleaned = line.strip()
        if not cleaned or cleaned.startswith("#"):
            continue

        if "=" not in cleaned:
            continue

        symbol_part, remainder = cleaned.split("=", 1)
        symbol = symbol_part.strip()
        if not symbol:
            raise MapLoaderError(f"Definición de tile sin símbolo: '{line}'")

        tokens = [token.strip() for token in remainder.split(";") if token.strip()]
        if not tokens:
            raise MapLoaderError(f"Definición de tile incompleta: '{line}'")

        tile_id = tokens[0]
        if not tile_id:
            raise MapLoaderError(f"Tile sin identificador: '{line}'")

        props: Dict[str, str] = {}
        for token in tokens[1:]:
            if "=" in token:
                key, value = token.split("=", 1)
                normalised_key = _normalise_key(key)
                props[normalised_key] = value.strip()
            else:
                normalised_key = _normalise_key(token)
                props[normalised_key] = "true"

        name = props.get("name") or props.get("label") or tile_id
        collides = _parse_bool(
            props.get("collides")
            or props.get("solid")
            or props.get("collision"),
            default=False,
        )
        transparent = _parse_bool(props.get("transparent"), default=True)
        color = props.get("color") or props.get("colour")

        metadata = {
            key: value
            for key, value in props.items()
            if key
            not in {
                "name",
                "label",
                "collides",
                "solid",
                "collision",
                "transparent",
                "color",
                "colour",
            }
        }

        tile_type = MapTileType(
            id=tile_id,
            symbol=symbol,
            name=name,
            collides=collides,
            transparent=transparent,
            color=color,
            metadata=metadata,
        )

        tile_types[tile_id] = tile_type
        if symbol in symbol_map and symbol_map[symbol] != tile_id:
            raise MapLoaderError(
                f"El símbolo '{symbol}' ya está asignado a '{symbol_map[symbol]}'"
            )
        symbol_map[symbol] = tile_id

    if not tile_types:
        tile_types[_DEFAULT_TILE_TYPE.id] = _DEFAULT_TILE_TYPE
        symbol_map[_DEFAULT_TILE_TYPE.symbol] = _DEFAULT_TILE_TYPE.id

    return tile_types, symbol_map


def _tokenise_layer_row(line: str) -> List[str]:
    tokens = [token for token in line.split() if token]
    if len(tokens) == 1 and len(tokens[0]) > 1:
        # Allow compact notation without spaces (e.g. '..##..')
        return list(tokens[0])
    if not tokens and line.strip():
        return list(line.strip())
    return tokens


def _resolve_tile_reference(
    token: str,
    *,
    tile_types: Dict[str, MapTileType],
    symbol_map: Dict[str, str],
) -> str | None:
    normalised = token.strip()
    if not normalised:
        return None

    lowered = normalised.lower()
    if lowered in {"none", "empty", "void", "transparent"}:
        return None

    if normalised in symbol_map:
        return symbol_map[normalised]

    if normalised in tile_types:
        return normalised

    raise MapLoaderError(f"Tile desconocido en capa: '{token}'")


def _parse_layer_sections(
    sections: Dict[str, List[str]],
    *,
    tile_types: Dict[str, MapTileType],
    symbol_map: Dict[str, str],
) -> List[MapLayer]:
    layers: List[MapLayer] = []

    for key, lines in sections.items():
        if not key.startswith("layer"):
            continue

        properties = _parse_key_values(line for line in lines if ":" in line)
        raw_rows = [line for line in lines if ":" not in line]

        rows: List[List[str | None]] = []
        for raw in raw_rows:
            cleaned = raw.strip()
            if not cleaned or cleaned.startswith("#"):
                continue
            tokens = _tokenise_layer_row(cleaned)
            if not tokens:
                continue
            resolved_row: List[str | None] = []
            for token in tokens:
                resolved_row.append(
                    _resolve_tile_reference(
                        token,
                        tile_types=tile_types,
                        symbol_map=symbol_map,
                    )
                )
            rows.append(resolved_row)

        if not rows:
            continue

        width = max(len(row) for row in rows)
        normalised_rows: List[List[str | None]] = []
        for row in rows:
            if len(row) != width:
                raise MapLoaderError(
                    f"Todas las filas de la capa '{key}' deben tener el mismo ancho"
                )
            normalised_rows.append(row)

        if key == "layer":
            layer_id = properties.get("id") or properties.get("name") or "layer"
        elif key.startswith("layer_"):
            layer_id = properties.get("id") or key[len("layer_"):]
        else:
            layer_id = properties.get("id") or key.split("layer", 1)[-1] or key

        layer_id = layer_id or f"layer_{len(layers) + 1}"
        name = properties.get("name") or properties.get("label") or layer_id

        try:
            order = int(properties.get("order", len(layers)))
        except ValueError:
            order = len(layers)

        visible = _parse_bool(properties.get("visible"), default=True)

        layers.append(
            MapLayer(
                id=layer_id,
                name=name,
                order=order,
                visible=visible,
                tiles=normalised_rows,
            )
        )

    layers.sort(key=lambda layer: (layer.order, layer.id))
    return layers


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

    tile_types, symbol_map = _parse_tile_definitions(sections.get("tiles", []))
    layers = _parse_layer_sections(
        sections, tile_types=tile_types, symbol_map=symbol_map
    )

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

    if layers:
        layer_width = max(len(row) for layer in layers for row in layer.tiles) if layers else 0
        layer_height = max(len(layer.tiles) for layer in layers) if layers else 0
        if layer_width and (size.width <= 0 or layer_width != size.width):
            size = MapSize(width=layer_width, height=size.height or layer_height)
        if layer_height and (size.height <= 0 or layer_height != size.height):
            size = MapSize(width=size.width or layer_width, height=layer_height)

    if not layers:
        fallback_width = size.width or 1
        fallback_height = size.height or 1
        default_tile_id = next(iter(tile_types.keys()))
        fallback_tiles = [
            [default_tile_id for _ in range(fallback_width)]
            for _ in range(fallback_height)
        ]
        layers = [
            MapLayer(
                id="ground",
                name="Ground",
                order=0,
                visible=True,
                tiles=fallback_tiles,
            )
        ]

    blocked_areas = _build_blocked_areas(size)

    collidable_lookup: Dict[Tuple[int, int], MapPosition] = {}
    for layer in layers:
        for y, row in enumerate(layer.tiles):
            for x, tile_id in enumerate(row):
                if tile_id is None:
                    continue
                tile = tile_types.get(tile_id)
                if tile and tile.collides:
                    collidable_lookup.setdefault((x, y), MapPosition(x=x, y=y))

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

    collidable_tiles = sorted(
        collidable_lookup.values(), key=lambda position: (position.y, position.x)
    )

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
        tile_types=tile_types,
        layers=layers,
        collidable_tiles=collidable_tiles,
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
