import { promises as fs } from 'node:fs';
import path from 'node:path';

const STORAGE_FILE = path.resolve(process.cwd(), 'server', 'data', 'player-preferences.json');

export const DEFAULT_APPEARANCE = Object.freeze({
  hair: 'Corto',
  face: 'Clásica',
  outfit: 'Casual',
  shoes: 'Botas'
});

export const DEFAULT_PREFERENCES = Object.freeze({
  mapZoom: 1,
  appearance: { ...DEFAULT_APPEARANCE }
});

export const DEFAULT_ZOOM_RANGE = Object.freeze({ min: 0.5, max: 2 });

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (min > max) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const sanitiseAppearance = (raw = {}) => {
  const next = { ...DEFAULT_APPEARANCE };
  if (!raw || typeof raw !== 'object') {
    return next;
  }

  for (const key of Object.keys(DEFAULT_APPEARANCE)) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) {
      next[key] = value.trim();
    }
  }
  return next;
};

const sanitisePreferences = (raw = {}) => {
  const next = {
    mapZoom: DEFAULT_PREFERENCES.mapZoom,
    appearance: { ...DEFAULT_APPEARANCE }
  };

  if (!raw || typeof raw !== 'object') {
    return next;
  }

  if (raw.mapZoom !== undefined) {
    const parsed = Number(raw.mapZoom);
    if (Number.isFinite(parsed) && parsed > 0) {
      next.mapZoom = clamp(parsed, DEFAULT_ZOOM_RANGE.min, DEFAULT_ZOOM_RANGE.max);
    }
  }

  if (raw.appearance !== undefined) {
    next.appearance = sanitiseAppearance(raw.appearance);
  }

  return next;
};

class PlayerPreferencesService {
  constructor(storageFile = STORAGE_FILE) {
    this.storageFile = storageFile;
    this._cache = null;
    this._pendingWrite = null;
  }

  _normaliseAlias(alias) {
    if (typeof alias !== 'string') {
      return '';
    }
    return alias.trim().toLowerCase();
  }

  async _readFile() {
    if (this._cache) {
      return this._cache;
    }
    try {
      const raw = await fs.readFile(this.storageFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        this._cache = {};
        return this._cache;
      }
      this._cache = parsed;
      return this._cache;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this._cache = {};
        return this._cache;
      }
      throw error;
    }
  }

  async _writeFile(store) {
    if (this._pendingWrite) {
      await this._pendingWrite;
    }
    const directory = path.dirname(this.storageFile);
    await fs.mkdir(directory, { recursive: true });
    const payload = JSON.stringify(store, null, 2);
    this._pendingWrite = fs.writeFile(this.storageFile, payload, 'utf8');
    await this._pendingWrite;
    this._pendingWrite = null;
  }

  _mergeWithDefaults(preferences) {
    const sanitised = sanitisePreferences(preferences);
    return {
      ...DEFAULT_PREFERENCES,
      ...sanitised,
      appearance: {
        ...DEFAULT_APPEARANCE,
        ...(sanitised.appearance ?? {})
      }
    };
  }

  async getPreferences(alias) {
    const key = this._normaliseAlias(alias);
    if (!key) {
      return this._mergeWithDefaults();
    }
    const store = await this._readFile();
    const entry = store[key] ?? {};
    return this._mergeWithDefaults(entry);
  }

  async updatePreferences(alias, patch = {}) {
    const key = this._normaliseAlias(alias);
    if (!key) {
      throw new Error('Alias inválido para actualizar preferencias.');
    }
    const store = await this._readFile();
    const current = store[key] ?? {};
    const next = sanitisePreferences({
      ...current,
      ...(patch && typeof patch === 'object' ? patch : {})
    });
    store[key] = next;
    await this._writeFile(store);
    return this._mergeWithDefaults(next);
  }
}

const playerPreferencesService = new PlayerPreferencesService();

export default playerPreferencesService;
