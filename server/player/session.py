"""Lightweight player session used by tests and server helpers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional

from ..map.models import MapDefinition, MapPosition


@dataclass
class PlayerSession:
    """Tracks the map and positional state of a player."""

    player_id: str
    map_id: str
    position: MapPosition
    metadata: Dict[str, object] = field(default_factory=dict)

    def move_to(self, position: MapPosition) -> None:
        """Update the player's position within the current map."""

        self.position = position

    def enter_map(
        self,
        map_definition: MapDefinition,
        position: Optional[MapPosition] = None,
    ) -> None:
        """Assign a new map to the player and relocate them."""

        self.map_id = map_definition.id
        self.position = position or map_definition.spawn

    def to_dict(self) -> Dict[str, object]:
        """Serialise the session for consumers that expect JSON-compatible output."""

        return {
            "id": self.player_id,
            "mapId": self.map_id,
            "position": {"x": self.position.x, "y": self.position.y},
            "metadata": {**self.metadata},
        }


__all__ = ["PlayerSession"]
