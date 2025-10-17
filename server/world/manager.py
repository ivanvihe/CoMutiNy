"""World manager that resolves maps and door-based transitions."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Iterable, Optional

from ..map.loader import MapLoaderError, load_map, load_maps
from ..map.models import MapDefinition, MapDoor, MapPosition
from ..player.session import PlayerSession


class WorldManager:
    """Keeps track of map definitions and player transitions."""

    def __init__(self, map_path: str | Path):
        self._source = Path(map_path)
        self._maps_by_id: Dict[str, MapDefinition] = {}
        self._current_map_id: Optional[str] = None
        self.reload()

    @property
    def current_map(self) -> MapDefinition:
        if self._current_map_id is None:
            raise MapLoaderError("No hay mapas cargados")
        return self._maps_by_id[self._current_map_id]

    def reload(self) -> MapDefinition:
        """Reload all maps from the configured source."""

        if self._source.is_dir():
            definitions = load_maps(self._source)
        else:
            definitions = [load_map(self._source)]

        if not definitions:
            self._maps_by_id = {}
            self._current_map_id = None
            raise MapLoaderError("No se cargaron mapas desde la ruta especificada")

        self._maps_by_id = {definition.id: definition for definition in definitions}

        if self._current_map_id not in self._maps_by_id:
            self._current_map_id = definitions[0].id

        return self.current_map

    def set_map(self, definition: MapDefinition) -> None:
        """Inject a map definition produced elsewhere (e.g. database)."""

        self._maps_by_id[definition.id] = definition
        self._current_map_id = definition.id

    def get_map(self, map_id: str) -> MapDefinition:
        try:
            return self._maps_by_id[map_id]
        except KeyError as error:
            raise MapLoaderError(f"Mapa desconocido: {map_id}") from error

    def serialise(self) -> Dict[str, object]:
        """Return the payload that should be delivered to connected clients."""

        payload = self.current_map.to_dict()
        return {
            "map": payload,
            "objects": payload.get("objects", []),
            "doors": payload.get("doors", []),
        }

    def ensure_loaded(self) -> None:
        """Helper used by tests to validate early failures."""

        _ = self.current_map

    # Door handling -----------------------------------------------------

    def _iter_doors(self, game_map: MapDefinition, *, kind: Optional[str] = None) -> Iterable[MapDoor]:
        for door in game_map.doors:
            if kind and door.kind != kind:
                continue
            yield door

    def _match_outbound_door(
        self,
        game_map: MapDefinition,
        *,
        door_id: Optional[str] = None,
        position: Optional[MapPosition] = None,
    ) -> Optional[MapDoor]:
        for door in self._iter_doors(game_map, kind="out"):
            if door_id and door.id == door_id:
                return door
            if position and door.position.x == position.x and door.position.y == position.y:
                return door
        return None

    def _resolve_arrival_position(
        self,
        destination: MapDefinition,
        *,
        source_map_id: Optional[str],
        explicit: Optional[MapPosition],
    ) -> MapPosition:
        if explicit:
            return explicit

        if source_map_id:
            for door in self._iter_doors(destination, kind="in"):
                if door.target_map and door.target_map != source_map_id:
                    continue
                return door.position

        return destination.spawn

    def update_player_position(
        self, session: PlayerSession, position: MapPosition
    ) -> Optional[MapDefinition]:
        """Update a player's position and handle door traversal if needed."""

        session.move_to(position)
        current_map = self.get_map(session.map_id)
        door = self._match_outbound_door(current_map, position=position)

        if not door or not door.target_map:
            return None

        destination = self.get_map(door.target_map)
        arrival = self._resolve_arrival_position(
            destination,
            source_map_id=session.map_id,
            explicit=door.target_position,
        )

        session.enter_map(destination, arrival)
        self._current_map_id = destination.id
        return destination

    def traverse_door(
        self,
        session: PlayerSession,
        *,
        door_id: Optional[str] = None,
    ) -> Optional[MapDefinition]:
        """Teleport the player through a specific door."""

        current_map = self.get_map(session.map_id)
        door = self._match_outbound_door(current_map, door_id=door_id)
        if not door or not door.target_map:
            return None

        destination = self.get_map(door.target_map)
        arrival = self._resolve_arrival_position(
            destination,
            source_map_id=session.map_id,
            explicit=door.target_position,
        )
        session.enter_map(destination, arrival)
        self._current_map_id = destination.id
        return destination


__all__ = ["WorldManager", "MapLoaderError"]
