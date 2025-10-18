import Phaser from 'phaser';
import { FloorGenerator } from '../../game/graphics/generators/index.js';
import { MAPS } from '../../game/maps.js';
import gameState from '../../game/state/index.js';
import createSpriteCanvas from '../../game/objects/canvasSprites.js';
import { listObjectDefinitions } from '../../game/objects/definitions.js';
import { CHARACTER_TEXTURES } from '../../game/characters/customization.js';
import { awaitCharacterTexture, ensureCharacterTexture } from '../../game/characters/textureLoader.js';

const DEFAULT_TILE_SIZE = 64;
const OBJECT_TEXTURE_PREFIX = 'object/';
const TILE_TEXTURE_PREFIX = 'tile/';
const CHARACTER_TEXTURE_PREFIX = 'character/';
const DEFAULT_CHARACTER_TEXTURE_ID = 'astronaut/classic';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const globalGenerators = {
  floor: null
};

const getFloorGenerator = () => {
  if (!globalGenerators.floor) {
    globalGenerators.floor = new FloorGenerator({
      defaultWidth: DEFAULT_TILE_SIZE,
      defaultHeight: DEFAULT_TILE_SIZE
    });
  }
  return globalGenerators.floor;
};

const globalTileTextureCache = new Map();
const globalObjectSpriteCache = new Map();

const toArray = (value) => (Array.isArray(value) ? value : []);

const normaliseMaps = (value) => {
  const maps = Array.isArray(value) ? value : [value];
  const collected = [];
  const seen = new Set();

  maps.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : null;
    if (id) {
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
    } else if (seen.has(entry)) {
      return;
    } else {
      seen.add(entry);
    }
    collected.push(entry);
  });

  return collected;
};

const collectPreloadMaps = ({ maps, preloadMaps, currentMap } = {}) => {
  const sources = [
    normaliseMaps(maps),
    normaliseMaps(preloadMaps),
    normaliseMaps(currentMap),
    normaliseMaps(gameState?.maps ?? [])
  ].flat();

  const deduped = [];
  const seen = new Set();

  sources.forEach((map) => {
    const id = typeof map?.id === 'string' && map.id.trim() ? map.id.trim() : null;
    if (id) {
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
    } else if (seen.has(map)) {
      return;
    } else {
      seen.add(map);
    }
    deduped.push(map);
  });

  if (!deduped.length) {
    deduped.push(...MAPS);
  }

  return deduped;
};

const collectDefinitionIdsForMaps = (maps) => {
  const identifiers = new Set();

  const register = (candidate) => {
    if (typeof candidate !== 'string') {
      return;
    }
    const trimmed = candidate.trim();
    if (trimmed) {
      identifiers.add(trimmed);
    }
  };

  const inspectObject = (object) => {
    if (!object || typeof object !== 'object') {
      return;
    }
    register(object.definitionId);
    register(object.objectId);
    if (typeof object.id === 'string') {
      register(object.id);
    }
    if (object.metadata && typeof object.metadata === 'object') {
      register(object.metadata.definitionId);
      register(object.metadata.objectId);
    }
  };

  toArray(maps).forEach((map) => {
    toArray(map?.objects).forEach(inspectObject);
    toArray(map?.objectLayers)
      .filter((layer) => layer && layer.visible !== false)
      .forEach((layer) => {
        toArray(layer.objects).forEach(inspectObject);
      });
  });

  return identifiers;
};

const collectCharacterTextureIds = (players = [], profile = null) => {
  const identifiers = new Set();

  const register = (candidate) => {
    if (typeof candidate !== 'string') {
      return;
    }
    const trimmed = candidate.trim();
    if (trimmed) {
      identifiers.add(trimmed);
    }
  };

  toArray(players).forEach((player) => {
    register(player?.sprite);
    register(player?.avatar?.sprite);
    register(player?.metadata?.avatar?.sprite);
  });

  if (profile && typeof profile === 'object') {
    register(profile.avatar?.sprite);
    register(profile.metadata?.avatar?.sprite);
  }

  return identifiers;
};

const computeTileSignature = (tile) => {
  try {
    const baseColor = normaliseHex(tile?.color, '#8eb5ff');
    return JSON.stringify({
      id: tile?.id ?? null,
      color: baseColor,
      palette: tile?.palette ?? null,
      metadata: tile?.metadata ?? null
    });
  } catch {
    return `${tile?.id ?? 'tile'}:${normaliseHex(tile?.color)}`;
  }
};

const computeSpriteSignature = (definition, appearance) => {
  try {
    const serializable = {
      id: definition?.id ?? null,
      generator: appearance?.generator ?? null,
      width: appearance?.width ?? definition?.size?.width ?? 1,
      height: appearance?.height ?? definition?.size?.height ?? 1,
      tileSize: appearance?.tileSize ?? DEFAULT_TILE_SIZE,
      options: appearance?.options ?? {},
      offset: appearance?.offset ?? null,
      scale: appearance?.scale ?? null,
      anchor: appearance?.anchor ?? null
    };
    return JSON.stringify(serializable);
  } catch {
    return `${definition?.id ?? 'object'}:${appearance?.generator ?? 'generator'}`;
  }
};

const normaliseHex = (value, fallback = '#8eb5ff') => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim().replace(/^#/, '');
  if (!trimmed || !/^[0-9a-f]{3,8}$/i.test(trimmed)) {
    return fallback;
  }
  if (trimmed.length === 3 || trimmed.length === 4) {
    return `#${trimmed
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`.slice(0, 7);
  }
  return `#${trimmed.slice(0, 6)}`;
};

const adjustHexColour = (hex, amount) => {
  const normalised = normaliseHex(hex);
  const numeric = Number.parseInt(normalised.slice(1), 16);
  if (!Number.isFinite(numeric)) {
    return normalised;
  }
  let r = (numeric >> 16) & 0xff;
  let g = (numeric >> 8) & 0xff;
  let b = numeric & 0xff;
  if (amount >= 0) {
    r = clamp(Math.round(r + (255 - r) * amount), 0, 255);
    g = clamp(Math.round(g + (255 - g) * amount), 0, 255);
    b = clamp(Math.round(b + (255 - b) * amount), 0, 255);
  } else {
    const factor = 1 + amount;
    r = clamp(Math.round(r * factor), 0, 255);
    g = clamp(Math.round(g * factor), 0, 255);
    b = clamp(Math.round(b * factor), 0, 255);
  }
  const combined = (r << 16) | (g << 8) | b;
  return `#${combined.toString(16).padStart(6, '0')}`;
};

const createObjectComposite = (sprite) => {
  const tileSize = Math.max(1, sprite?.tileSize ?? DEFAULT_TILE_SIZE);
  const layers = Array.isArray(sprite?.layers) ? sprite.layers : [];
  const baseWidth = Math.max(1, sprite?.size?.width ?? 1) * tileSize;
  const baseHeight = Math.max(1, sprite?.size?.height ?? 1) * tileSize;

  let minX = 0;
  let minY = 0;
  let maxX = baseWidth;
  let maxY = baseHeight;

  layers.forEach((layer) => {
    if (!layer?.canvas) {
      return;
    }
    const offset = layer.offset ?? { x: 0, y: 0 };
    const pixelOffset = layer.pixelOffset ?? { x: 0, y: 0 };
    const x = (offset.x ?? 0) * tileSize + (pixelOffset.x ?? 0);
    const y = (offset.y ?? 0) * tileSize + (pixelOffset.y ?? 0);
    const width = layer.canvas.width;
    const height = layer.canvas.height;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  const width = Math.max(1, Math.round(maxX - minX));
  const height = Math.max(1, Math.round(maxY - minY));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  layers.forEach((layer) => {
    if (!layer?.canvas) {
      return;
    }
    const offset = layer.offset ?? { x: 0, y: 0 };
    const pixelOffset = layer.pixelOffset ?? { x: 0, y: 0 };
    const x = (offset.x ?? 0) * tileSize + (pixelOffset.x ?? 0) - minX;
    const y = (offset.y ?? 0) * tileSize + (pixelOffset.y ?? 0) - minY;
    ctx.globalAlpha = Number.isFinite(layer.alpha) ? clamp(layer.alpha, 0, 1) : 1;
    ctx.globalCompositeOperation = layer.composite ?? 'source-over';
    ctx.drawImage(layer.canvas, Math.round(x), Math.round(y));
  });

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  const anchor = sprite?.anchor ?? { x: 0.5, y: 1 };
  const anchorPixelX = (anchor.x ?? 0.5) * baseWidth - minX;
  const anchorPixelY = (anchor.y ?? 1) * baseHeight - minY;
  const origin = {
    x: clamp(width ? anchorPixelX / width : 0.5, 0, 1),
    y: clamp(height ? anchorPixelY / height : 1, 0, 1.5)
  };

  return {
    canvas,
    origin,
    bounds: { minX, minY, maxX, maxY },
    width,
    height
  };
};

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
    this.tileTextures = new Map();
    this.objectSprites = new Map();
    this.characterTextures = new Map();
    this.generators = null;
    this.readyPromise = null;
    this.initializationData = {};
    this.mapsForPreload = [];
    this.preloadCharacterIds = new Set();
  }

  init(data = {}) {
    this.initializationData = data && typeof data === 'object' ? { ...data } : {};
    this.tileTextures.clear();
    this.objectSprites.clear();
    this.characterTextures.clear();
    this.generators = {
      floor: getFloorGenerator()
    };
    this.mapsForPreload = collectPreloadMaps(this.initializationData);
    this.preloadCharacterIds = collectCharacterTextureIds(
      this.initializationData.players,
      this.initializationData.profile
    );
    if (this.preloadCharacterIds.size === 0 && CHARACTER_TEXTURES[DEFAULT_CHARACTER_TEXTURE_ID]) {
      this.preloadCharacterIds.add(DEFAULT_CHARACTER_TEXTURE_ID);
    }
  }

  preload() {
    this.readyPromise = this.generateProceduralAssets();
  }

  create() {
    const next = () => {
      this.scene.start('GameScene', {
        ...this.initializationData,
        tileTextures: this.tileTextures,
        objectSprites: this.objectSprites,
        characterTextures: this.characterTextures,
        tileSize: DEFAULT_TILE_SIZE
      });
    };

    if (this.readyPromise) {
      this.readyPromise.then(next).catch((error) => {
        console.error('[PreloadScene] Error generating assets', error);
        next();
      });
    } else {
      next();
    }
  }

  async generateProceduralAssets() {
    this.generateTileTextures();
    this.generateObjectSprites();
    await this.generateCharacterTextures();
  }

  generateTileTextures() {
    const tileTypes = new Map();
    this.mapsForPreload.forEach((map) => {
      const entries = Object.values(map?.tileTypes ?? {});
      entries.forEach((tile) => {
        if (!tile?.id) {
          return;
        }
        tileTypes.set(tile.id, tile);
      });
    });

    tileTypes.forEach((tile, tileId) => {
      const signature = computeTileSignature(tile);
      const cachedEntry = globalTileTextureCache.get(tileId);
      if (cachedEntry && cachedEntry.signature === signature) {
        const key = `${TILE_TEXTURE_PREFIX}${tileId}`;
        if (this.textures.exists(key)) {
          this.textures.remove(key);
        }
        this.textures.addCanvas(key, cachedEntry.canvas);
        const record = {
          ...cachedEntry.record,
          key,
          tile
        };
        this.tileTextures.set(tileId, record);
        globalTileTextureCache.set(tileId, {
          ...cachedEntry,
          record
        });
        return;
      }

      const baseColor = normaliseHex(tile.color, '#8eb5ff');
      const palette = [
        adjustHexColour(baseColor, 0.18),
        adjustHexColour(baseColor, -0.12)
      ];
      const groutColor = adjustHexColour(baseColor, 0.35);
      let canvas = null;
      try {
        canvas = this.generators.floor.generateTiledFloor({
          width: DEFAULT_TILE_SIZE,
          height: DEFAULT_TILE_SIZE,
          tileSize: DEFAULT_TILE_SIZE / 4,
          tileColors: palette,
          groutColor
        });
      } catch (error) {
        console.error(`[PreloadScene] Error generating tile texture for ${tileId}`, error);
        return;
      }
      if (!canvas) {
        return;
      }
      const key = `${TILE_TEXTURE_PREFIX}${tileId}`;
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
      this.textures.addCanvas(key, canvas);
      const record = {
        key,
        tile,
        canvas,
        palette: {
          base: baseColor,
          light: palette[0],
          dark: palette[1],
          grout: groutColor
        }
      };
      this.tileTextures.set(tileId, record);
      globalTileTextureCache.set(tileId, {
        signature,
        canvas,
        record
      });
    });
  }

  generateObjectSprites() {
    const preloadDefinitionIds = collectDefinitionIdsForMaps(this.mapsForPreload);
    const shouldFilter = preloadDefinitionIds.size > 0;
    const definitions = listObjectDefinitions().filter((definition) => {
      if (!shouldFilter) {
        return true;
      }
      const id = typeof definition?.id === 'string' ? definition.id : null;
      return id ? preloadDefinitionIds.has(id) : false;
    });
    definitions.forEach((definition) => {
      const appearance = definition?.appearance;
      if (!appearance?.generator) {
        return;
      }

      const signature = computeSpriteSignature(definition, appearance);
      const cachedEntry = globalObjectSpriteCache.get(definition.id);
      if (cachedEntry && cachedEntry.signature === signature) {
        const key = `${OBJECT_TEXTURE_PREFIX}${definition.id}`;
        if (this.textures.exists(key)) {
          this.textures.remove(key);
        }
        this.textures.addCanvas(key, cachedEntry.record.composite.canvas);
        const record = {
          ...cachedEntry.record,
          key,
          definition
        };
        this.objectSprites.set(definition.id, record);
        globalObjectSpriteCache.set(definition.id, {
          ...cachedEntry,
          record
        });
        return;
      }

      let sprite = null;
      try {
        sprite = createSpriteCanvas({
          generator: appearance.generator,
          width: appearance.width ?? definition.size?.width ?? 1,
          height: appearance.height ?? definition.size?.height ?? 1,
          tileSize: appearance.tileSize ?? DEFAULT_TILE_SIZE,
          options: appearance.options ?? {}
        });
      } catch (error) {
        console.error(`[PreloadScene] Error generating object sprite for ${definition.id}`, error);
        return;
      }

      if (!sprite || !Array.isArray(sprite.layers) || !sprite.layers.length) {
        return;
      }

      const composite = createObjectComposite(sprite);
      if (!composite?.canvas) {
        return;
      }

      const key = `${OBJECT_TEXTURE_PREFIX}${definition.id}`;
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
      this.textures.addCanvas(key, composite.canvas);

      const record = {
        key,
        definition,
        sprite,
        composite,
        appearance: {
          offset: appearance.offset ?? { x: 0, y: 0, z: 0 },
          scale: appearance.scale ?? { x: 1, y: 1 },
          anchor: appearance.anchor ?? sprite.anchor ?? { x: 0.5, y: 1 }
        }
      };

      this.objectSprites.set(definition.id, record);
      globalObjectSpriteCache.set(definition.id, {
        signature,
        record
      });
    });
  }

  async generateCharacterTextures() {
    const explicitIds = Array.from(this.preloadCharacterIds).filter((id) => CHARACTER_TEXTURES[id]);
    const textureIds = explicitIds.length ? explicitIds : Object.keys(CHARACTER_TEXTURES);
    const tasks = textureIds.map(async (textureId) => {
      const entry = ensureCharacterTexture(textureId);
      let image = entry?.image ?? null;
      if (!image) {
        image = await awaitCharacterTexture(textureId);
      }
      if (!image) {
        return;
      }
      const key = `${CHARACTER_TEXTURE_PREFIX}${textureId}`;
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
      this.textures.addCanvas(key, image);
      this.characterTextures.set(textureId, {
        key,
        definition: CHARACTER_TEXTURES[textureId],
        width: image.width,
        height: image.height
      });
    });

    await Promise.allSettled(tasks);
  }
}
