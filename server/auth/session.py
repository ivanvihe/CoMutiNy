"""Session helpers to support alias-based logins and preferences."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

from ..map.models import MapDefinition
from ..player import (
    PlayerPreferences,
    PlayerPreferencesStore,
    PlayerSession,
    get_default_store,
)
from ..world.manager import WorldManager


@dataclass
class LoginRequest:
    """Represents the minimum input required to start a session."""

    alias: str
    map_id: Optional[str] = None

    def normalised_alias(self) -> str:
        return (self.alias or "").strip()


class SessionService:
    """Coordinates session creation using alias and optional map selection."""

    def __init__(self, world_manager: WorldManager, preferences: Optional[PlayerPreferencesStore] = None):
        self._world_manager = world_manager
        self._preferences = preferences or get_default_store()

    def _resolve_map(self, map_id: Optional[str]) -> MapDefinition:
        if map_id:
            return self._world_manager.get_map(map_id)
        return self._world_manager.current_map

    def open_session(self, request: LoginRequest) -> Tuple[PlayerSession, PlayerPreferences]:
        alias = request.normalised_alias()
        if not alias:
            raise ValueError("Debes proporcionar un alias para iniciar sesión")

        map_definition = self._resolve_map(request.map_id)
        player_id = f"alias:{alias.lower()}"
        session = PlayerSession(
            player_id=player_id,
            map_id=map_definition.id,
            position=map_definition.spawn,
            metadata={"alias": alias},
        )
        preferences = self._preferences.get(alias)
        return session, preferences

    def load_preferences(self, alias: str) -> PlayerPreferences:
        alias = (alias or "").strip()
        if not alias:
            return PlayerPreferences()
        return self._preferences.get(alias)

    def update_preferences(self, alias: str, payload: Optional[dict]) -> PlayerPreferences:
        alias = (alias or "").strip()
        if not alias:
            raise ValueError("Alias inválido para actualizar preferencias")
        return self._preferences.update(alias, payload or {})


__all__ = ["LoginRequest", "SessionService"]
