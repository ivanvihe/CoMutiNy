"""Dataclasses describing static map definitions and embedded objects."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class MapPosition:
    """Two-dimensional tile coordinate."""

    x: int
    y: int


@dataclass(frozen=True)
class MapSize:
    """Width/height pair expressed in tiles."""

    width: int
    height: int


@dataclass(frozen=True)
class MapArea:
    """Axis-aligned rectangular area expressed in tiles."""

    x: int
    y: int
    width: int
    height: int


@dataclass
class MapObject:
    """Interactive or decorative object embedded in a map."""

    id: str
    name: Optional[str]
    position: MapPosition
    size: MapSize = field(default_factory=lambda: MapSize(1, 1))
    solid: bool = False
    metadata: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        """Serialise the object to a JSON-compatible dictionary."""

        payload: Dict[str, object] = {
            "id": self.id,
            "name": self.name or self.id,
            "position": {"x": self.position.x, "y": self.position.y},
            "size": {"width": self.size.width, "height": self.size.height},
            "solid": bool(self.solid),
            "metadata": {**self.metadata},
        }

        if payload["metadata"].get("objectId") and "objectId" not in payload:
            payload["objectId"] = payload["metadata"]["objectId"]

        return payload


@dataclass
class MapDefinition:
    """Normalised representation of a `.map` file."""

    id: str
    name: str
    biome: str
    description: str
    size: MapSize
    spawn: MapPosition
    blocked_areas: List[MapArea] = field(default_factory=list)
    objects: List[MapObject] = field(default_factory=list)
    portals: List[Dict[str, object]] = field(default_factory=list)
    theme: Dict[str, object] = field(default_factory=dict)
    source_path: Optional[str] = None
    extra: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        """Serialise the map definition for consumption by the runtime."""

        return {
            "id": self.id,
            "name": self.name,
            "biome": self.biome,
            "description": self.description,
            "size": {"width": self.size.width, "height": self.size.height},
            "spawn": {"x": self.spawn.x, "y": self.spawn.y},
            "blockedAreas": [
                {"x": area.x, "y": area.y, "width": area.width, "height": area.height}
                for area in self.blocked_areas
            ],
            "objects": [obj.to_dict() for obj in self.objects],
            "portals": [dict(portal) for portal in self.portals],
            "theme": {**self.theme},
            "sourcePath": self.source_path,
            **({k: v for k, v in self.extra.items() if k not in {
                "id",
                "name",
                "biome",
                "description",
                "size",
                "spawn",
                "blockedAreas",
                "objects",
                "portals",
                "theme",
                "sourcePath",
            }}),
        }
