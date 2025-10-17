import {
  resolveSpriteGenerator,
  registerSpriteGeneratorDefinitions
} from './spriteGenerators.js';

const DEFAULT_ANCHOR = { x: 0.5, y: 1, z: 0 };
const DEFAULT_OFFSET = { x: 0, y: 0, z: 0 };
const DEFAULT_PIXEL_OFFSET = { x: 0, y: 0, z: 0 };

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normaliseAnchor = (value, fallback = DEFAULT_ANCHOR) => {
  if (value === undefined || value === null) {
    return { ...fallback };
  }

  if (typeof value === 'number') {
    const numeric = clamp(toFiniteNumber(value, fallback.x), 0, 1);
    return { x: numeric, y: numeric, z: fallback.z ?? 0 };
  }

  if (Array.isArray(value) && value.length) {
    const x = clamp(toFiniteNumber(value[0], fallback.x), 0, 1);
    const y = clamp(toFiniteNumber(value[1] ?? value[0], fallback.y), 0, 1.5);
    const z = clamp(toFiniteNumber(value[2] ?? fallback.z ?? 0, fallback.z ?? 0), -8, 8);
    return { x, y, z };
  }

  if (typeof value === 'object') {
    const x = clamp(toFiniteNumber(value.x ?? value[0], fallback.x), 0, 1);
    const y = clamp(toFiniteNumber(value.y ?? value[1], fallback.y), 0, 1.5);
    const z = clamp(toFiniteNumber(value.z ?? value[2] ?? fallback.z ?? 0, fallback.z ?? 0), -8, 8);
    return { x, y, z };
  }

  return { ...fallback };
};

const normaliseOffset = (value, fallback = DEFAULT_OFFSET) => {
  if (value === undefined || value === null) {
    return { ...fallback };
  }

  if (typeof value === 'number') {
    const numeric = toFiniteNumber(value, fallback.x);
    return { x: numeric, y: numeric, z: fallback.z ?? 0 };
  }

  if (Array.isArray(value) && value.length) {
    const x = toFiniteNumber(value[0], fallback.x);
    const y = toFiniteNumber(value[1] ?? value[0], fallback.y);
    const z = toFiniteNumber(value[2] ?? fallback.z ?? 0, fallback.z ?? 0);
    return { x, y, z };
  }

  if (typeof value === 'object') {
    const x = toFiniteNumber(value.x ?? value[0], fallback.x);
    const y = toFiniteNumber(value.y ?? value[1], fallback.y);
    const z = toFiniteNumber(value.z ?? value[2] ?? fallback.z ?? 0, fallback.z ?? 0);
    return { x, y, z };
  }

  return { ...fallback };
};

const normalisePixelOffset = (value, fallback = DEFAULT_PIXEL_OFFSET) => {
  if (value === undefined || value === null) {
    return { ...fallback };
  }

  if (typeof value === 'number') {
    const numeric = toFiniteNumber(value, fallback.x);
    return { x: numeric, y: numeric, z: fallback.z ?? 0 };
  }

  if (Array.isArray(value) && value.length) {
    const x = toFiniteNumber(value[0], fallback.x);
    const y = toFiniteNumber(value[1] ?? value[0], fallback.y);
    const z = toFiniteNumber(value[2] ?? fallback.z ?? 0, fallback.z ?? 0);
    return { x, y, z };
  }

  if (typeof value === 'object') {
    const x = toFiniteNumber(value.x ?? value[0], fallback.x);
    const y = toFiniteNumber(value.y ?? value[1], fallback.y);
    const z = toFiniteNumber(value.z ?? value[2] ?? fallback.z ?? 0, fallback.z ?? 0);
    return { x, y, z };
  }

  return { ...fallback };
};

const normaliseVolume = (value, fallback = { height: 1, anchor: DEFAULT_ANCHOR }) => {
  const baseAnchor = fallback?.anchor ?? DEFAULT_ANCHOR;
  const fallbackHeight = Number.isFinite(fallback?.height) ? Math.max(fallback.height, 0) : 0;

  if (value === undefined || value === null) {
    return { height: fallbackHeight, anchor: { ...baseAnchor } };
  }

  if (typeof value === 'number') {
    const height = Math.max(toFiniteNumber(value, fallbackHeight), 0);
    return { height, anchor: { ...baseAnchor } };
  }

  if (Array.isArray(value) && value.length) {
    const height = Math.max(toFiniteNumber(value[0], fallbackHeight), 0);
    const anchor = normaliseAnchor(value[1], baseAnchor);
    return { height, anchor };
  }

  if (typeof value === 'object') {
    const heightCandidate =
      value.height ?? value.z ?? value.depth ?? value.levels ?? value.size ?? fallbackHeight;
    const height = Math.max(toFiniteNumber(heightCandidate, fallbackHeight), 0);
    const anchor = normaliseAnchor(value.anchor ?? value.pivot ?? value.origin, baseAnchor);
    return { height, anchor };
  }

  return { height: fallbackHeight, anchor: { ...baseAnchor } };
};

export const getSpriteGenerator = (id) => {
  return resolveSpriteGenerator(id);
};

export const createSpriteCanvas = ({ generator, width, height, tileSize, options }) => {
  if (typeof document === 'undefined') {
    return null;
  }

  const generatorFn = getSpriteGenerator(generator);
  if (typeof generatorFn !== 'function') {
    return null;
  }

  const safeTileSize = Math.max(4, Math.round(tileSize ?? 16));
  const safeWidth = Math.max(1, Math.round(Math.max(1, width) * safeTileSize));
  const safeHeight = Math.max(1, Math.round(Math.max(1, height) * safeTileSize));

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = safeWidth;
  baseCanvas.height = safeHeight;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) {
    return null;
  }

  const payload = {
    width: Math.max(1, width),
    height: Math.max(1, height),
    tileSize: safeTileSize,
    options: options ?? {}
  };

  const meta = {
    anchor: { ...DEFAULT_ANCHOR },
    offset: { ...DEFAULT_OFFSET },
    pixelOffset: { ...DEFAULT_PIXEL_OFFSET },
    volume: { height: Math.max(1, height), anchor: { ...DEFAULT_ANCHOR } }
  };

  const layers = [];

  const registerLayer = (id, drawFn, config = {}) => {
    const layerId = typeof id === 'string' && id.trim() ? id.trim() : `layer-${layers.length + 1}`;
    const layerWidth = Math.max(0.125, toFiniteNumber(config.width ?? payload.width, payload.width));
    const layerHeight = Math.max(0.125, toFiniteNumber(config.height ?? payload.height, payload.height));
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = Math.max(1, Math.round(layerWidth * safeTileSize));
    layerCanvas.height = Math.max(1, Math.round(layerHeight * safeTileSize));
    const layerCtx = layerCanvas.getContext('2d');
    if (!layerCtx) {
      return null;
    }

    layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
    if (typeof drawFn === 'function') {
      drawFn(layerCtx, { ...payload, width: layerWidth, height: layerHeight });
    }

    const anchor = normaliseAnchor(config.anchor, meta.anchor);
    const offset = normaliseOffset(config.offset, DEFAULT_OFFSET);
    const pixelOffset = normalisePixelOffset(config.pixelOffset, DEFAULT_PIXEL_OFFSET);
    const alpha = clamp(toFiniteNumber(config.alpha, 1), 0, 1);
    const composite =
      typeof config.composite === 'string' && config.composite.trim()
        ? config.composite.trim()
        : 'source-over';
    const order = Number.isFinite(config.order) ? config.order : layers.length;

    const layer = {
      id: layerId,
      canvas: layerCanvas,
      size: { width: layerWidth, height: layerHeight },
      anchor,
      offset,
      pixelOffset,
      alpha,
      composite,
      order
    };

    const existingIndex = layers.findIndex((entry) => entry.id === layerId);
    if (existingIndex >= 0) {
      layers.splice(existingIndex, 1, layer);
    } else {
      layers.push(layer);
    }

    return layer;
  };

  const helpers = {
    registerLayer,
    setAnchor(anchor) {
      meta.anchor = normaliseAnchor(anchor, meta.anchor);
    },
    setOffset(offset) {
      meta.offset = normaliseOffset(offset, meta.offset);
    },
    setPixelOffset(pixelOffset) {
      meta.pixelOffset = normalisePixelOffset(pixelOffset, meta.pixelOffset);
    },
    setVolume(volume) {
      meta.volume = normaliseVolume(volume, meta.volume);
    }
  };

  baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
  const result = generatorFn(baseCtx, payload, helpers);

  if (result && typeof result === 'object') {
    if (result.anchor !== undefined) {
      helpers.setAnchor(result.anchor);
    }
    if (result.offset !== undefined) {
      helpers.setOffset(result.offset);
    }
    if (result.pixelOffset !== undefined) {
      helpers.setPixelOffset(result.pixelOffset);
    }
    if (result.volume !== undefined) {
      helpers.setVolume(result.volume);
    }
    if (Array.isArray(result.layers)) {
      result.layers.forEach((layerConfig) => {
        if (!layerConfig) {
          return;
        }
        const { id, draw, ...rest } = layerConfig;
        registerLayer(id, draw, rest);
      });
    }
  }

  const hasBaseLayer = layers.some((layer) => layer.id === 'base');
  if (!hasBaseLayer) {
    layers.push({
      id: 'base',
      canvas: baseCanvas,
      size: { width: payload.width, height: payload.height },
      anchor: { ...meta.anchor },
      offset: { ...meta.offset },
      pixelOffset: { ...meta.pixelOffset },
      alpha: 1,
      composite: 'source-over',
      order: Number.NEGATIVE_INFINITY
    });
  }

  layers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return {
    layers,
    anchor: { ...meta.anchor },
    offset: { ...meta.offset },
    pixelOffset: { ...meta.pixelOffset },
    volume: { ...meta.volume, anchor: { ...meta.volume.anchor } },
    size: { width: payload.width, height: payload.height },
    tileSize: safeTileSize
  };
};

export const registerCanvasSpriteDefinitions = (definitions) => {
  return registerSpriteGeneratorDefinitions(definitions);
};

export default createSpriteCanvas;
