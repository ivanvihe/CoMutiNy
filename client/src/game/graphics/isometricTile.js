import { clamp } from './spritePlacement.js';

export const getIsometricDiamondPoints = (width, height, { inset = 0 } = {}) => {
  const effectiveWidth = Math.max(0, width - inset * 2);
  const effectiveHeight = Math.max(0, height - inset * 2);
  const halfWidth = effectiveWidth / 2;
  const halfHeight = effectiveHeight / 2;
  return [
    { x: inset + halfWidth, y: inset },
    { x: inset + effectiveWidth, y: inset + halfHeight },
    { x: inset + halfWidth, y: inset + effectiveHeight },
    { x: inset, y: inset + halfHeight }
  ];
};

const traceIsometricDiamond = (ctx, { x, y, width, height, inset = 0 }) => {
  const points = getIsometricDiamondPoints(width, height, { inset });
  ctx.beginPath();
  points.forEach((point, index) => {
    const drawX = x + point.x;
    const drawY = y + point.y;
    if (index === 0) {
      ctx.moveTo(drawX, drawY);
    } else {
      ctx.lineTo(drawX, drawY);
    }
  });
  ctx.closePath();
  return points;
};

export const fillIsometricTile = (
  ctx,
  { x, y, width, height, style, alpha = 1, inset = 0 }
) => {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  if (style) {
    ctx.fillStyle = style;
  }
  traceIsometricDiamond(ctx, { x, y, width, height, inset });
  ctx.fill();
  ctx.restore();
};

export const strokeIsometricTile = (
  ctx,
  { x, y, width, height, style, alpha = 1, inset = 0, lineWidth = 1 }
) => {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  if (style) {
    ctx.strokeStyle = style;
  }
  if (Number.isFinite(lineWidth)) {
    ctx.lineWidth = lineWidth;
  }
  traceIsometricDiamond(ctx, { x, y, width, height, inset });
  ctx.stroke();
  ctx.restore();
};

export const drawIsometricTile = (
  ctx,
  {
    x,
    y,
    width,
    height,
    fill,
    stroke,
    inset = 0
  }
) => {
  if (fill) {
    fillIsometricTile(ctx, { x, y, width, height, inset, ...fill });
  }
  if (stroke) {
    strokeIsometricTile(ctx, { x, y, width, height, inset, ...stroke });
  }
};
