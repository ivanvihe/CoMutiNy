"""Interactive object utilities for CoMutiNy."""

from .base import InteractionEvent, InteractionResult, InteractiveObject, MessageObject, build_object, register_object
from .loader import discover_objects, export_objects, load_definition, load_objects, simulate_interaction

__all__ = [
    "InteractionEvent",
    "InteractionResult",
    "InteractiveObject",
    "MessageObject",
    "build_object",
    "register_object",
    "discover_objects",
    "export_objects",
    "load_definition",
    "load_objects",
    "simulate_interaction",
]
