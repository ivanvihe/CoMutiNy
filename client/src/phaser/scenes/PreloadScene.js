import Phaser from 'phaser';
import { FloorGenerator } from '../../game/graphics/generators/index.js';
import { MAPS } from '../../game/maps.js';
import createSpriteCanvas from '../../game/objects/canvasSprites.js';
import { listObjectDefinitions } from '../../game/objects/definitions.js';
import { CHARACTER_TEXTURES } from '../../game/characters/customization.js';
import { awaitCharacterTexture, ensureCharacterTexture } from '../../game/characters/textureLoader.js';

const DEFAULT_TILE_SIZE = 64;
const OBJECT_TEXTURE_PREFIX = 'object/';
const TILE_TEXTURE_PREFIX = 'tile/';
const CHARACTER_TEXTURE_PREFIX = 'character/';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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
  }

  init() {
    this.tileTextures.clear();
    this.objectSprites.clear();
    this.characterTextures.clear();
    this.generators = {
      floor: new FloorGenerator({ defaultWidth: DEFAULT_TILE_SIZE, defaultHeight: DEFAULT_TILE_SIZE })
    };
  }

  preload() {
    this.readyPromise = this.generateProceduralAssets();
  }

  create() {
    const next = () => {
      this.scene.start('GameScene', {
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
    MAPS.forEach((map) => {
      const entries = Object.values(map?.tileTypes ?? {});
      entries.forEach((tile) => {
        if (!tile?.id) {
          return;
        }
        tileTypes.set(tile.id, tile);
      });
    });

    tileTypes.forEach((tile, tileId) => {
      const baseColor = normaliseHex(tile.color, '#8eb5ff');
      const palette = [
        adjustHexColour(baseColor, 0.18),
        adjustHexColour(baseColor, -0.12)
      ];
      const groutColor = adjustHexColour(baseColor, 0.35);
      const canvas = this.generators.floor.generateTiledFloor({
        width: DEFAULT_TILE_SIZE,
        height: DEFAULT_TILE_SIZE,
        tileSize: DEFAULT_TILE_SIZE / 4,
        tileColors: palette,
        groutColor
      });
      if (!canvas) {
        return;
      }
      const key = `${TILE_TEXTURE_PREFIX}${tileId}`;
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
      this.textures.addCanvas(key, canvas);
      this.tileTextures.set(tileId, {
        key,
        tile,
        canvas,
        palette: {
          base: baseColor,
          light: palette[0],
          dark: palette[1],
          grout: groutColor
        }
      });
    });
  }

  generateObjectSprites() {
    const definitions = listObjectDefinitions();
    definitions.forEach((definition) => {
      const appearance = definition?.appearance;
      if (!appearance?.generator) {
        return;
      }

      const sprite = createSpriteCanvas({
        generator: appearance.generator,
        width: appearance.width ?? definition.size?.width ?? 1,
        height: appearance.height ?? definition.size?.height ?? 1,
        tileSize: appearance.tileSize ?? DEFAULT_TILE_SIZE,
        options: appearance.options ?? {}
      });

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

      this.objectSprites.set(definition.id, {
        key,
        definition,
        sprite,
        composite,
        appearance: {
          offset: appearance.offset ?? { x: 0, y: 0, z: 0 },
          scale: appearance.scale ?? { x: 1, y: 1 },
          anchor: appearance.anchor ?? sprite.anchor ?? { x: 0.5, y: 1 }
        }
      });
    });
  }

  async generateCharacterTextures() {
    const textureIds = Object.keys(CHARACTER_TEXTURES);
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
