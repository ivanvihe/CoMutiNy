import { MAPS, fetchServerMaps, resolveDefaultMapId } from '../maps.js';

const toMapLookup = (maps) => {
  const lookup = new Map();
  (Array.isArray(maps) ? maps : []).forEach((map) => {
    if (map && typeof map === 'object' && typeof map.id === 'string') {
      lookup.set(map.id, map);
    }
  });
  return lookup;
};

export class GameStateManager {
  constructor({ maps = MAPS, fetchMaps = fetchServerMaps } = {}) {
    this._maps = toMapLookup(maps);
    this._listeners = new Set();
    this._fetchMaps = typeof fetchMaps === 'function' ? fetchMaps : null;
    this._currentMapId = resolveDefaultMapId(maps);
  }

  get currentMapId() {
    return this._currentMapId;
  }

  get currentMap() {
    return this._maps.get(this._currentMapId) ?? null;
  }

  get maps() {
    return Array.from(this._maps.values());
  }

  getSnapshot() {
    return {
      mapId: this._currentMapId,
      map: this.currentMap,
      maps: this.maps,
    };
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this._listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this._listeners.delete(listener);
    };
  }

  _emit() {
    const snapshot = this.getSnapshot();
    this._listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // Ignore listener errors to avoid breaking notification flow
      }
    });
  }

  registerMap(mapDefinition) {
    if (!mapDefinition || typeof mapDefinition !== 'object') {
      return;
    }
    const mapId = typeof mapDefinition.id === 'string' ? mapDefinition.id : null;
    if (!mapId) {
      return;
    }
    this._maps.set(mapId, mapDefinition);
  }

  async _ensureMapLoaded(mapId) {
    if (!mapId || this._maps.has(mapId) || !this._fetchMaps) {
      return;
    }

    try {
      const remoteMaps = await this._fetchMaps({});
      (Array.isArray(remoteMaps) ? remoteMaps : []).forEach((map) => {
        if (map && typeof map === 'object' && typeof map.id === 'string') {
          this._maps.set(map.id, map);
        }
      });
    } catch {
      // Ignore fetch errors; consumers can retry later
    }
  }

  async handleMapChange({ mapId, definition } = {}) {
    if (definition && typeof definition === 'object') {
      this.registerMap(definition);
    }

    const targetId =
      (typeof mapId === 'string' && mapId.trim()) ||
      (definition && typeof definition.id === 'string' ? definition.id : null) ||
      this._currentMapId;

    if (!targetId) {
      return null;
    }

    await this._ensureMapLoaded(targetId);

    if (!this._maps.has(targetId)) {
      return null;
    }

    this._currentMapId = targetId;
    this._emit();

    return this.currentMap;
  }
}

export const gameState = new GameStateManager();

export default gameState;
