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


@dataclass(frozen=True)
class MapTileType:
    """Describes a tile type that can be referenced from map layers."""

    id: str
    symbol: str
    name: str
    collides: bool = False
    transparent: bool = True
    color: Optional[str] = None
    metadata: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        payload: Dict[str, object] = {
            "id": self.id,
            "symbol": self.symbol,
            "name": self.name,
            "collides": bool(self.collides),
            "transparent": bool(self.transparent),
        }

        if self.color:
            payload["color"] = self.color

        if self.metadata:
            payload["metadata"] = {**self.metadata}

        return payload


@dataclass(frozen=True)
class MapLayer:
    """Single tile layer expressed as a matrix of tile type identifiers."""

    id: str
    name: str
    order: int
    visible: bool
    tiles: List[List[str | None]]

    def to_dict(self) -> Dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "order": self.order,
            "visible": self.visible,
            "tiles": [
                [tile if tile is not None else None for tile in row]
                for row in self.tiles
            ],
        }


@dataclass(frozen=True)
class MapDoor:
    """Simple descriptor for an inbound or outbound door."""

    id: str
    kind: str  # "in" or "out"
    position: MapPosition
    target_map: Optional[str] = None
    target_position: Optional[MapPosition] = None

    def to_dict(self) -> Dict[str, object]:
        payload: Dict[str, object] = {
            "id": self.id,
            "kind": self.kind,
            "position": {"x": self.position.x, "y": self.position.y},
        }

        if self.target_map:
            payload["targetMap"] = self.target_map

        if self.target_position:
            payload["targetPosition"] = {
                "x": self.target_position.x,
                "y": self.target_position.y,
            }

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
    doors: List[MapDoor] = field(default_factory=list)
    portals: List[Dict[str, object]] = field(default_factory=list)
    theme: Dict[str, object] = field(default_factory=dict)
    source_path: Optional[str] = None
    extra: Dict[str, object] = field(default_factory=dict)
    tile_types: Dict[str, MapTileType] = field(default_factory=dict)
    layers: List[MapLayer] = field(default_factory=list)
    collidable_tiles: List[MapPosition] = field(default_factory=list)

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
            "doors": [door.to_dict() for door in self.doors],
            "portals": [dict(portal) for portal in self.portals],
            "theme": {**self.theme},
            "sourcePath": self.source_path,
            "tileTypes": {
                tile_id: tile.to_dict() for tile_id, tile in self.tile_types.items()
            },
            "layers": [layer.to_dict() for layer in self.layers],
            "collidableTiles": [
                {"x": position.x, "y": position.y}
                for position in self.collidable_tiles
            ],
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
                "tileTypes",
                "layers",
                "collidableTiles",
            }}),
        }
