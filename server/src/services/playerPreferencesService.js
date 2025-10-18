import { promises as fs } from 'node:fs';
import path from 'node:path';

const STORAGE_FILE = path.resolve(process.cwd(), 'server', 'data', 'player-preferences.json');

export const DEFAULT_APPEARANCE = Object.freeze({
  texture: 'astronaut/classic',
  mesh: 'compact',
  visorColor: '#d7ecff',
  accentColor: '#1a202c'
});

const VALID_TEXTURES = new Set(['astronaut/classic', 'astronaut/engineer', 'astronaut/biologist']);
const LEGACY_TEXTURE_MAP = {
  explorer: 'astronaut/classic',
  pilot: 'astronaut/engineer',
  engineer: 'astronaut/engineer',
  scientist: 'astronaut/biologist'
};
const VALID_MESHES = new Set(['compact', 'tall', 'sturdy']);

const HEX_COLOR_REGEX = /^#?[0-9a-f]{3,8}$/i;

const normaliseHex = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    return fallback;
  }
  const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  const expanded = withoutHash.length === 3
    ? withoutHash
        .split('')
        .map((char) => char + char)
        .join('')
        .toLowerCase()
    : withoutHash.slice(0, 6).toLowerCase();
  return `#${expanded}`;
};

const normaliseTexture = (candidate) => {
  if (typeof candidate !== 'string') {
    return DEFAULT_APPEARANCE.texture;
  }
  const trimmed = candidate.trim();
  if (VALID_TEXTURES.has(trimmed)) {
    return trimmed;
  }
  const legacy = LEGACY_TEXTURE_MAP[trimmed];
  if (legacy) {
    return legacy;
  }
  return DEFAULT_APPEARANCE.texture;
};

const normaliseMesh = (candidate) => {
  if (typeof candidate !== 'string') {
    return DEFAULT_APPEARANCE.mesh;
  }
  const trimmed = candidate.trim();
  if (VALID_MESHES.has(trimmed)) {
    return trimmed;
  }
  return DEFAULT_APPEARANCE.mesh;
};

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

  next.texture = normaliseTexture(raw.texture ?? raw.sprite);
  next.mesh = normaliseMesh(raw.mesh);
  next.visorColor = normaliseHex(raw.visorColor ?? raw.visor, next.visorColor);
  const accentSource = raw.accentColor ?? raw.accent ?? raw.color;
  next.accentColor = normaliseHex(accentSource, next.accentColor);

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
