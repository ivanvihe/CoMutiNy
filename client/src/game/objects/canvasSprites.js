import {
  resolveSpriteGenerator,
  registerSpriteGeneratorDefinitions
} from './spriteGenerators.js';
import {
  DEFAULT_PIXEL_OFFSET,
  DEFAULT_SPRITE_ANCHOR,
  DEFAULT_SPRITE_OFFSET,
  DEFAULT_VOLUME,
  clamp,
  normaliseAnchor,
  normaliseOffset,
  normalisePixelOffset,
  normaliseVolume,
  toFiniteNumber
} from '../graphics/spritePlacement.js';

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
    anchor: { ...DEFAULT_SPRITE_ANCHOR },
    offset: { ...DEFAULT_SPRITE_OFFSET },
    pixelOffset: { ...DEFAULT_PIXEL_OFFSET },
    volume: normaliseVolume(Math.max(1, height), DEFAULT_VOLUME)
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
    const offset = normaliseOffset(config.offset, DEFAULT_SPRITE_OFFSET);
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
