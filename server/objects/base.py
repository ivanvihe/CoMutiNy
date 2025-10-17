"""Core abstractions for interactive world objects.

This module defines the minimal interface that dynamic map objects must
implement on the Python side.  Even though the real-time server currently
runs on Node.js, object designers can prototype behaviours here and export
metadata that the JavaScript runtime consumes later on.  The loader module
creates instances of these classes when parsing ``.obj`` definitions.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, Optional


@dataclass(slots=True)
class InteractionEvent:
    """Representation of a single interaction event.

    Events are converted into JSON before being sent to the real-time
    service.  They match the payload consumed by the browser client.
    """

    type: str
    title: str
    description: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class InteractionResult:
    """Outcome of invoking :meth:`InteractiveObject.on_interact`."""

    success: bool
    message: Optional[str] = None
    events: Iterable[InteractionEvent] = field(default_factory=tuple)
    broadcast: bool = False


class InteractiveObject:
    """Base class for any interactive element placed on the map.

    Implementations should override :meth:`on_interact` to produce an
    :class:`InteractionResult`.  The method receives the player metadata
    and an arbitrary context dictionary with extra information (map id,
    interaction type, etc.).
    """

    object_type: str = "base"

    def __init__(self, object_id: str, definition: Dict[str, Any]):
        self.id = object_id
        self.definition = definition
        self.name = definition.get("name", object_id)
        self.description = definition.get("description", "")
        self.appearance = definition.get("appearance")

    def on_interact(self, player: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> InteractionResult:
        """Handle a player interaction.

        Sub-classes must return an :class:`InteractionResult` describing the
        interaction.  The default implementation simply rejects the action.
        """

        return InteractionResult(success=False, message="El objeto no responde." )

    def export(self) -> Dict[str, Any]:
        """Serialise the definition in a JavaScript-friendly structure."""

        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "interaction": self.definition.get("interaction"),
            "behavior": self.definition.get("behavior"),
            "appearance": self.definition.get("appearance"),
            "metadata": self.definition.get("metadata", {}),
        }


_OBJECT_REGISTRY: Dict[str, Callable[[str, Dict[str, Any]], InteractiveObject]] = {}


def register_object(cls: Callable[[str, Dict[str, Any]], InteractiveObject]) -> Callable[[str, Dict[str, Any]], InteractiveObject]:
    """Register an interactive object implementation."""

    if not hasattr(cls, "object_type"):
        raise TypeError("Interactive objects must define an 'object_type' attribute")

    _OBJECT_REGISTRY[str(cls.object_type)] = cls
    return cls


def build_object(object_type: str, object_id: str, definition: Dict[str, Any]) -> InteractiveObject:
    """Instantiate the class registered for ``object_type``."""

    factory = _OBJECT_REGISTRY.get(object_type)
    if not factory:
        factory = _OBJECT_REGISTRY.get("base", InteractiveObject)
    return factory(object_id, definition)


@register_object
class MessageObject(InteractiveObject):
    """Simple object that sends a textual response to the player."""

    object_type = "message"

    def on_interact(
        self,
        player: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> InteractionResult:
        behaviour = self.definition.get("behavior", {}) or {}
        metadata = behaviour.get("metadata", {})

        message = behaviour.get("message") or behaviour.get("text") or self.description
        title = behaviour.get("title") or self.name
        description = behaviour.get("description") or message

        event = InteractionEvent(
            type=str(behaviour.get("type") or "message"),
            title=title,
            description=description,
            metadata={**metadata, "objectId": self.id},
        )

        personalised = message
        alias = player.get("alias") or player.get("name")
        if alias and isinstance(personalised, str):
            personalised = personalised.replace("{player}", alias)

        return InteractionResult(
            success=True,
            message=personalised,
            events=(event,),
            broadcast=bool(behaviour.get("broadcast")),
        )


__all__ = [
    "InteractionEvent",
    "InteractionResult",
    "InteractiveObject",
    "MessageObject",
    "build_object",
    "register_object",
]
