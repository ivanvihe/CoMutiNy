"""Minimal world manager that exposes map and object information."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional

from ..map.loader import MapLoaderError, load_map
from ..map.models import MapDefinition


class WorldManager:
    """Keeps the current map definition and exposes a client-facing payload."""

    def __init__(self, map_path: str | Path):
        self._map_path = Path(map_path)
        self._current_map: Optional[MapDefinition] = None

    @property
    def current_map(self) -> MapDefinition:
        if self._current_map is None:
            self._current_map = load_map(self._map_path)
        return self._current_map

    def reload(self) -> MapDefinition:
        """Force a reload of the backing `.map` file."""

        self._current_map = load_map(self._map_path)
        return self._current_map

    def set_map(self, definition: MapDefinition) -> None:
        """Inject a map definition produced elsewhere (e.g. database)."""

        self._current_map = definition

    def serialise(self) -> Dict[str, object]:
        """Return the payload that should be delivered to connected clients."""

        game_map = self.current_map
        payload = game_map.to_dict()

        return {
            "map": payload,
            "objects": payload.get("objects", []),
        }

    def ensure_loaded(self) -> None:
        """Helper used by tests to validate early failures."""

        _ = self.current_map


__all__ = ["WorldManager", "MapLoaderError"]
