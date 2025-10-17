"""Utilities to load interactive object definitions from ``.obj`` files.

The format is intentionally lightweight: each file contains a JSON object
with the following keys:

``id``
    Unique identifier.  Required.
``type``
    Object class to instantiate.  Defaults to ``"message"``.
``name`` / ``description``
    Human readable metadata displayed to the player.
``interaction``
    Optional dictionary describing the interaction prompt that the client
    can render before invoking the behaviour.
``behavior``
    Behaviour configuration consumed by :class:`InteractiveObject`
    instances.  When absent the loader mirrors ``interaction``.

The loader returns instantiated Python objects so automated tools can
pre-validate behaviours, while the Node.js runtime consumes the exported
JSON payloads produced by :meth:`InteractiveObject.export`.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Dict, Iterable, List

from .base import InteractionResult, InteractiveObject, build_object


class ObjectLoaderError(RuntimeError):
    """Raised when an ``.obj`` file cannot be parsed correctly."""


def _normalise_definition(raw: Dict) -> Dict:
    if not isinstance(raw, dict):
        raise ObjectLoaderError("Invalid object definition: expected a JSON object")

    object_id = str(raw.get("id", "")).strip()
    if not object_id:
        raise ObjectLoaderError("Object definition is missing an 'id' field")

    object_type = str(raw.get("type") or raw.get("objectType") or "message").strip() or "message"

    definition = {
        "id": object_id,
        "type": object_type,
        "name": str(raw.get("name") or object_id).strip() or object_id,
        "description": str(raw.get("description") or "").strip(),
        "interaction": raw.get("interaction") or raw.get("prompt"),
        "behavior": raw.get("behavior") or raw.get("behaviour") or raw.get("interaction") or {},
        "metadata": raw.get("metadata", {}),
    }

    return definition


def load_definition(path: Path) -> InteractiveObject:
    try:
        content = path.read_text(encoding="utf-8")
        raw = json.loads(content)
        definition = _normalise_definition(raw)
        return build_object(definition["type"], definition["id"], definition)
    except FileNotFoundError as exc:
        raise ObjectLoaderError(f"No se encontró el archivo {path}") from exc
    except json.JSONDecodeError as exc:
        raise ObjectLoaderError(f"El archivo {path} no es un JSON válido") from exc


def discover_objects(directory: Path) -> List[InteractiveObject]:
    objects: List[InteractiveObject] = []

    if not directory.exists():
        return objects

    for entry in sorted(directory.glob("*.obj")):
        try:
            objects.append(load_definition(entry))
        except ObjectLoaderError as error:
            raise ObjectLoaderError(f"Error al cargar {entry.name}: {error}") from error

    return objects


def export_objects(objects: Iterable[InteractiveObject]) -> Dict[str, Dict]:
    return {obj.id: obj.export() for obj in objects}


def load_objects(directory: str | Path) -> Dict[str, Dict]:
    directory_path = Path(directory)
    objects = discover_objects(directory_path)
    return export_objects(objects)


def simulate_interaction(obj: InteractiveObject, player: Dict) -> Dict:
    """Convenience helper used in tests: executes ``on_interact``."""

    result: InteractionResult = obj.on_interact(player, context={"objectId": obj.id})
    return {
        "success": result.success,
        "message": result.message,
        "events": [asdict(event) for event in result.events],
        "broadcast": result.broadcast,
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Load CoMutiNy interactive objects")
    parser.add_argument("directory", nargs="?", default="./definitions")
    parser.add_argument("--simulate", metavar="OBJECT_ID", help="Simular interacción con el objeto indicado")
    parser.add_argument("--player", metavar="ALIAS", default="Explorador", help="Nombre del jugador para la simulación")
    args = parser.parse_args()

    base_directory = Path(__file__).resolve().parent
    target_directory = (base_directory / args.directory).resolve()

    try:
        objects = discover_objects(target_directory)
    except ObjectLoaderError as error:
        parser.error(str(error))

    if args.simulate:
        match = next((obj for obj in objects if obj.id == args.simulate), None)
        if not match:
            parser.error(f"No se encontró el objeto '{args.simulate}' en {target_directory}")
        outcome = simulate_interaction(match, {"alias": args.player})
        print(json.dumps(outcome, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(export_objects(objects), ensure_ascii=False, indent=2))
