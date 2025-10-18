"""Persistent storage helpers for per-player preferences."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Mapping
import json

DEFAULT_APPEARANCE: Mapping[str, str] = {
    "texture": "astronaut/classic",
    "mesh": "compact",
    "visorColor": "#d7ecff",
    "accentColor": "#1a202c",
}

DEFAULT_PREFERENCES: Mapping[str, object] = {
    "mapZoom": 1.0,
    "appearance": dict(DEFAULT_APPEARANCE),
}

ZOOM_RANGE = (0.5, 2.0)

VALID_TEXTURES = {
    "astronaut/classic",
    "astronaut/engineer",
    "astronaut/biologist",
}

LEGACY_TEXTURE_MAP = {
    "explorer": "astronaut/classic",
    "pilot": "astronaut/engineer",
    "engineer": "astronaut/engineer",
    "scientist": "astronaut/biologist",
}

VALID_MESHES = {"compact", "tall", "sturdy"}


def _normalise_hex(value: object, fallback: str) -> str:
    if not isinstance(value, str):
        return fallback
    candidate = value.strip()
    if not candidate:
        return fallback
    stripped = candidate[1:] if candidate.startswith("#") else candidate
    if len(stripped) not in (3, 6):
        return fallback
    try:
        int(stripped, 16)
    except ValueError:
        return fallback
    if len(stripped) == 3:
        stripped = "".join(ch * 2 for ch in stripped)
    return f"#{stripped.lower()}"


def _normalise_texture(value: object) -> str:
    if isinstance(value, str):
        candidate = value.strip()
        if candidate in VALID_TEXTURES:
            return candidate
        legacy = LEGACY_TEXTURE_MAP.get(candidate)
        if legacy:
            return legacy
    return DEFAULT_APPEARANCE["texture"]


def _normalise_mesh(value: object) -> str:
    if isinstance(value, str):
        candidate = value.strip()
        if candidate in VALID_MESHES:
            return candidate
    return DEFAULT_APPEARANCE["mesh"]


def _clamp(value: object, minimum: float, maximum: float) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return minimum
    if minimum > maximum:
        return minimum
    return max(min(numeric, maximum), minimum)


def _normalise_alias(alias: str) -> str:
    return alias.strip().lower()


@dataclass
class PlayerPreferences:
    """Value object describing the preferences for a player alias."""

    map_zoom: float = 1.0
    appearance: Dict[str, str] = field(default_factory=lambda: dict(DEFAULT_APPEARANCE))

    @classmethod
    def from_dict(cls, payload: Mapping[str, object] | None) -> "PlayerPreferences":
        if not payload or not isinstance(payload, Mapping):
            return cls()

        map_zoom = _clamp(payload.get("mapZoom"), ZOOM_RANGE[0], ZOOM_RANGE[1])

        appearance: Dict[str, str] = dict(DEFAULT_APPEARANCE)
        raw_appearance = payload.get("appearance")
        if isinstance(raw_appearance, Mapping):
            appearance["texture"] = _normalise_texture(
                raw_appearance.get("texture") or raw_appearance.get("sprite")
            )
            appearance["mesh"] = _normalise_mesh(raw_appearance.get("mesh"))
            appearance["visorColor"] = _normalise_hex(
                raw_appearance.get("visorColor") or raw_appearance.get("visor"),
                appearance["visorColor"],
            )
            appearance["accentColor"] = _normalise_hex(
                raw_appearance.get("accentColor")
                or raw_appearance.get("accent")
                or raw_appearance.get("color"),
                appearance["accentColor"],
            )

        return cls(map_zoom=map_zoom, appearance=appearance)

    def to_dict(self) -> Dict[str, object]:
        return {
            "mapZoom": _clamp(self.map_zoom, ZOOM_RANGE[0], ZOOM_RANGE[1]),
            "appearance": dict(self.appearance),
        }


class PlayerPreferencesStore:
    """Simple JSON-backed preference persistence."""

    def __init__(self, storage_path: str | Path):
        self._path = Path(storage_path)
        self._cache: Dict[str, Dict[str, object]] | None = None

    def _load_cache(self) -> Dict[str, Dict[str, object]]:
        if self._cache is not None:
            return self._cache
        try:
            data = json.loads(self._path.read_text("utf-8"))
            if not isinstance(data, dict):
                self._cache = {}
            else:
                self._cache = {
                    str(alias): value
                    for alias, value in data.items()
                    if isinstance(alias, str) and isinstance(value, dict)
                }
        except FileNotFoundError:
            self._cache = {}
        except json.JSONDecodeError:
            self._cache = {}
        return self._cache

    def _write_cache(self) -> None:
        if self._cache is None:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(self._cache, indent=2, ensure_ascii=False), "utf-8")

    def get(self, alias: str) -> PlayerPreferences:
        key = _normalise_alias(alias)
        if not key:
            return PlayerPreferences()
        cache = self._load_cache()
        return PlayerPreferences.from_dict(cache.get(key))

    def update(self, alias: str, payload: Mapping[str, object] | None) -> PlayerPreferences:
        key = _normalise_alias(alias)
        if not key:
            raise ValueError("Alias inválido para actualizar preferencias")
        cache = self._load_cache()
        current = cache.get(key, {})
        merged = {}
        if isinstance(current, Mapping):
            merged.update(current)
        if isinstance(payload, Mapping):
            merged.update(payload)
        preferences = PlayerPreferences.from_dict(merged)
        cache[key] = preferences.to_dict()
        self._write_cache()
        return preferences


DEFAULT_STORE_PATH = Path(__file__).resolve().parents[1] / "data" / "player-preferences.json"


def get_default_store() -> PlayerPreferencesStore:
    return PlayerPreferencesStore(DEFAULT_STORE_PATH)


__all__ = [
    "DEFAULT_APPEARANCE",
    "DEFAULT_PREFERENCES",
    "PlayerPreferences",
    "PlayerPreferencesStore",
    "get_default_store",
]
