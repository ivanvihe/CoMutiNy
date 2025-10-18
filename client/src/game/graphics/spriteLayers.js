import {
  DEFAULT_PIXEL_OFFSET,
  DEFAULT_SPRITE_ANCHOR,
  DEFAULT_SPRITE_OFFSET,
  SPRITE_METRICS,
  clamp,
  toFiniteNumber
} from './spritePlacement.js';

const ensureNumber = (value, fallback) => {
  if (Number.isFinite(value)) {
    return value;
  }
  return toFiniteNumber(value, fallback);
};

export const registerShadowLayer = (
  helpers,
  {
    id = 'shadow',
    width,
    height,
    tileSize,
    color,
    radiusX,
    radiusY,
    radiusXFactor,
    radiusYFactor,
    centerX,
    centerY,
    centerYOffset,
    alpha,
    order,
    offset,
    offsetZ,
    pixelOffset,
    pixelOffsetY,
    pixelOffsetFactor,
    anchor,
    heightFactor
  } = {}
) => {
  if (!helpers?.registerLayer) {
    return null;
  }

  const layerMetrics = SPRITE_METRICS.layers?.shadow ?? {};
  const pixelWidth = Math.max(0, width * tileSize);
  const pixelHeight = Math.max(0, height * tileSize);

  const resolvedAnchor = anchor ? { ...anchor } : { ...DEFAULT_SPRITE_ANCHOR };
  const resolvedColor = typeof color === 'string' ? color : layerMetrics.color;
  const resolvedHeightFactor = Number.isFinite(heightFactor)
    ? heightFactor
    : layerMetrics.heightFactor ?? 0.6;
  const resolvedOffsetZ = ensureNumber(offsetZ, layerMetrics.offsetZ ?? -0.05);
  const resolvedAlpha = Number.isFinite(alpha) ? clamp(alpha, 0, 1) : layerMetrics.alpha ?? 0.8;
  const resolvedPixelOffsetFactor = Number.isFinite(pixelOffsetFactor)
    ? pixelOffsetFactor
    : layerMetrics.pixelOffsetFactor ?? 0.12;
  const resolvedCenterYOffset = Number.isFinite(centerYOffset)
    ? centerYOffset
    : layerMetrics.centerYOffset ?? 0.08;
  const resolvedRadiusXFactor = Number.isFinite(radiusXFactor)
    ? radiusXFactor
    : layerMetrics.radiusXFactor ?? 0.42;
  const resolvedRadiusYFactor = Number.isFinite(radiusYFactor)
    ? radiusYFactor
    : layerMetrics.radiusYFactor ?? 0.22;

  const shadowCenterX = Number.isFinite(centerX) ? centerX : pixelWidth / 2;
  const shadowCenterY = Number.isFinite(centerY)
    ? centerY
    : pixelHeight - tileSize * resolvedCenterYOffset;
  const shadowRadiusX = Number.isFinite(radiusX)
    ? radiusX
    : pixelWidth * resolvedRadiusXFactor;
  const shadowRadiusY = Number.isFinite(radiusY)
    ? radiusY
    : tileSize * resolvedRadiusYFactor;

  const defaultPixelOffsetY = -tileSize * resolvedPixelOffsetFactor;
  const mergedPixelOffset = {
    ...DEFAULT_PIXEL_OFFSET,
    ...pixelOffset,
    y: pixelOffset?.y ?? (Number.isFinite(pixelOffsetY) ? pixelOffsetY : defaultPixelOffsetY)
  };

  const mergedOffset = {
    ...DEFAULT_SPRITE_OFFSET,
    ...offset,
    z: offset?.z ?? resolvedOffsetZ
  };

  const layerHeight = Math.max(0.125, Math.min(1, height * resolvedHeightFactor));

  helpers.registerLayer(
    id,
    (shadowCtx) => {
      shadowCtx.fillStyle = resolvedColor;
      shadowCtx.beginPath();
      shadowCtx.ellipse(shadowCenterX, shadowCenterY, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2);
      shadowCtx.fill();
    },
    {
      width,
      height: layerHeight,
      anchor: resolvedAnchor,
      offset: mergedOffset,
      pixelOffset: mergedPixelOffset,
      alpha: resolvedAlpha,
      order: Number.isFinite(order) ? order : -10
    }
  );

  return true;
};
