"""Simple collision engine that respects map tile metadata."""

from __future__ import annotations

from typing import Iterable, Set, Tuple

from ..map.models import MapDefinition, MapPosition


def _expand_area(x: int, y: int, width: int, height: int) -> Iterable[Tuple[int, int]]:
    for dy in range(height):
        for dx in range(width):
            yield x + dx, y + dy


class PhysicsEngine:
    """Determines whether positions within a map are walkable."""

    def __init__(self, definition: MapDefinition):
        self._definition = definition
        self._blocked: Set[Tuple[int, int]] = set()
        self._rebuild()

    @property
    def definition(self) -> MapDefinition:
        return self._definition

    def _rebuild(self) -> None:
        blocked: Set[Tuple[int, int]] = set()

        for position in self._definition.collidable_tiles:
            blocked.add((position.x, position.y))

        for area in self._definition.blocked_areas:
            blocked.update(_expand_area(area.x, area.y, area.width, area.height))

        for obj in self._definition.objects:
            if not obj.solid:
                continue
            blocked.update(
                _expand_area(
                    obj.position.x,
                    obj.position.y,
                    obj.size.width,
                    obj.size.height,
                )
            )

        self._blocked = blocked

    def update_definition(self, definition: MapDefinition) -> None:
        """Replace the active map definition and recompute collision data."""

        self._definition = definition
        self._rebuild()

    def is_blocked(self, position: MapPosition) -> bool:
        """Return ``True`` when the given tile coordinate cannot be walked."""

        if position.x < 0 or position.y < 0:
            return True

        if (
            position.x >= self._definition.size.width
            or position.y >= self._definition.size.height
        ):
            return True

        return (position.x, position.y) in self._blocked

    def can_move(self, position: MapPosition) -> bool:
        """Return ``True`` when the position is within bounds and not blocked."""

        return not self.is_blocked(position)

    def iter_blocked(self) -> Iterable[Tuple[int, int]]:
        """Expose a snapshot of currently blocked tile coordinates."""

        return tuple(sorted(self._blocked))


__all__ = ["PhysicsEngine"]
