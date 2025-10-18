const CANVAS_SIZE = { width: 96, height: 128 };

const isDocumentAvailable = typeof document !== 'undefined';
const isOffscreenSupported = typeof OffscreenCanvas !== 'undefined';

const createCanvas = (width = CANVAS_SIZE.width, height = CANVAS_SIZE.height) => {
  if (isDocumentAvailable) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  if (isOffscreenSupported) {
    return new OffscreenCanvas(width, height);
  }

  return null;
};

const createContext = (canvas) => {
  if (!canvas) {
    return null;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
};

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  const cornerRadius = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
  const [r1, r2, r3, r4] = cornerRadius.map((value) => Math.max(0, value));

  ctx.beginPath();
  ctx.moveTo(x + r1, y);
  ctx.lineTo(x + width - r2, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r2);
  ctx.lineTo(x + width, y + height - r3);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r3, y + height);
  ctx.lineTo(x + r4, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r4);
  ctx.lineTo(x, y + r1);
  ctx.quadraticCurveTo(x, y, x + r1, y);
  ctx.closePath();
};

const addNoise = (ctx, x, y, width, height, color, opacity = 0.06, density = 0.12) => {
  const pixels = Math.floor(width * height * density * 0.01);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  for (let index = 0; index < pixels; index += 1) {
    const px = x + Math.random() * width;
    const py = y + Math.random() * height;
    const size = 0.6 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawSuitPattern = (ctx, pattern, palette, bounds) => {
  const { x, y, width, height, radius } = bounds;
  const baseAccent = palette.accent ?? '#5b7cfa';
  const secondAccent = palette.visor ?? '#8ad0ff';

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.clip();

  switch (pattern) {
    case 'diagonal': {
      const spacing = height / 6;
      ctx.strokeStyle = baseAccent;
      ctx.lineWidth = Math.max(2, height * 0.06);
      for (let offset = -width; offset < width; offset += spacing) {
        ctx.beginPath();
        ctx.moveTo(x + offset, y + height);
        ctx.lineTo(x + offset + width, y);
        ctx.stroke();
      }
      break;
    }
    case 'grid': {
      const spacing = Math.max(6, width / 6);
      ctx.strokeStyle = `${baseAccent}90`;
      ctx.lineWidth = 1.5;
      for (let offset = x; offset <= x + width; offset += spacing) {
        ctx.beginPath();
        ctx.moveTo(offset, y);
        ctx.lineTo(offset, y + height);
        ctx.stroke();
      }
      for (let offset = y; offset <= y + height; offset += spacing * 0.85) {
        ctx.beginPath();
        ctx.moveTo(x, offset);
        ctx.lineTo(x + width, offset);
        ctx.stroke();
      }
      break;
    }
    case 'organic': {
      const seed = Math.floor(width * 0.4);
      ctx.fillStyle = `${secondAccent}aa`;
      for (let i = 0; i < seed; i += 1) {
        const px = x + Math.random() * width;
        const py = y + Math.random() * height;
        const radiusScale = Math.random() * 0.7 + 0.3;
        ctx.beginPath();
        ctx.ellipse(px, py, 4 * radiusScale, 6 * radiusScale, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'banded':
    default: {
      const bandHeight = height / 5;
      ctx.fillStyle = `${baseAccent}c0`;
      for (let index = 0; index < 3; index += 1) {
        ctx.fillRect(x, y + bandHeight * index * 1.4, width, bandHeight * 0.5);
      }
      ctx.fillStyle = `${secondAccent}80`;
      ctx.fillRect(x, y + bandHeight * 2.2, width, bandHeight * 0.6);
      break;
    }
  }

  ctx.restore();
};

const drawSuitDetails = (ctx, palette, bounds) => {
  const { x, y, width, height } = bounds;
  const accent = palette.accent ?? '#91a4ff';
  const darkerAccent = palette.suit ?? '#2f3a86';

  ctx.save();
  ctx.strokeStyle = `${darkerAccent}dd`;
  ctx.lineWidth = Math.max(2, width * 0.05);
  ctx.beginPath();
  ctx.moveTo(x + width * 0.18, y + height * 0.15);
  ctx.lineTo(x + width * 0.15, y + height * 0.65);
  ctx.lineTo(x + width * 0.5, y + height * 0.9);
  ctx.lineTo(x + width * 0.85, y + height * 0.65);
  ctx.lineTo(x + width * 0.82, y + height * 0.15);
  ctx.stroke();

  ctx.lineWidth = Math.max(1.5, width * 0.03);
  ctx.strokeStyle = `${accent}cc`;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.25, y + height * 0.35);
  ctx.lineTo(x + width * 0.5, y + height * 0.55);
  ctx.lineTo(x + width * 0.75, y + height * 0.35);
  ctx.stroke();

  ctx.fillStyle = `${accent}f0`;
  ctx.beginPath();
  ctx.roundRect(x + width * 0.4, y + height * 0.35, width * 0.2, height * 0.35, width * 0.06);
  ctx.fill();

  ctx.fillStyle = `${accent}bb`;
  ctx.fillRect(x + width * 0.48, y + height * 0.42, width * 0.04, height * 0.22);

  ctx.restore();
};

const drawHelmet = (ctx, palette, baseX, baseY, headRadius) => {
  const helmetColor = palette.helmet ?? '#f7f9ff';
  const visorColor = palette.visor ?? '#d8ecff';
  const accent = palette.accent ?? '#5d74d6';

  const helmetWidth = headRadius * 2.6;
  const helmetHeight = headRadius * 2.4;

  ctx.save();

  // glass reflection
  const gradient = ctx.createLinearGradient(baseX - helmetWidth / 2, baseY - helmetHeight, baseX + helmetWidth / 2, baseY);
  gradient.addColorStop(0, `${helmetColor}f5`);
  gradient.addColorStop(1, `${helmetColor}cc`);

  drawRoundedRect(
    ctx,
    baseX - helmetWidth / 2,
    baseY - helmetHeight,
    helmetWidth,
    helmetHeight,
    headRadius * 0.8
  );
  ctx.fillStyle = gradient;
  ctx.fill();

  // visor main area
  const visorGradient = ctx.createLinearGradient(
    baseX - helmetWidth * 0.35,
    baseY - helmetHeight * 0.8,
    baseX + helmetWidth * 0.35,
    baseY
  );
  visorGradient.addColorStop(0, `${visorColor}f0`);
  visorGradient.addColorStop(0.6, `${visorColor}d0`);
  visorGradient.addColorStop(1, `${accent}80`);

  drawRoundedRect(
    ctx,
    baseX - helmetWidth * 0.45,
    baseY - helmetHeight * 0.75,
    helmetWidth * 0.9,
    helmetHeight * 0.65,
    headRadius * 0.5
  );
  ctx.fillStyle = visorGradient;
  ctx.fill();

  // highlight streak
  ctx.strokeStyle = `${helmetColor}ff`;
  ctx.lineWidth = headRadius * 0.2;
  ctx.beginPath();
  ctx.arc(baseX - helmetWidth * 0.1, baseY - helmetHeight * 0.45, headRadius * 0.6, -Math.PI * 0.9, -Math.PI * 0.25);
  ctx.stroke();

  // visor reflection
  ctx.strokeStyle = `${helmetColor}aa`;
  ctx.lineWidth = headRadius * 0.12;
  ctx.beginPath();
  ctx.arc(baseX + helmetWidth * 0.1, baseY - helmetHeight * 0.2, headRadius * 0.45, Math.PI * 0.3, Math.PI * 0.9);
  ctx.stroke();

  ctx.restore();
};

const drawBackpack = (ctx, palette, bounds) => {
  const { x, y, width, height } = bounds;
  const base = palette.suit ?? '#31448f';
  const highlight = palette.accent ?? '#7d8cff';

  ctx.save();
  ctx.fillStyle = `${base}e0`;
  drawRoundedRect(ctx, x, y, width, height, width * 0.2);
  ctx.fill();

  ctx.fillStyle = `${highlight}80`;
  ctx.fillRect(x + width * 0.25, y + height * 0.15, width * 0.5, height * 0.7);

  addNoise(ctx, x, y, width, height, '#ffffff', 0.04, 0.2);

  ctx.restore();
};

export const createAstronautTexture = ({
  palette = {},
  pattern = 'banded',
  size = CANVAS_SIZE
} = {}) => {
  const canvas = createCanvas(size.width, size.height);
  const ctx = createContext(canvas);
  if (!canvas || !ctx) {
    return null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const suitColor = palette.suit ?? '#3f51b5';
  const baseX = canvas.width / 2;
  const baseY = canvas.height * 0.78;
  const torsoWidth = canvas.width * 0.52;
  const torsoHeight = canvas.height * 0.58;
  const headRadius = canvas.width * 0.18;

  // Backpack
  drawBackpack(ctx, palette, {
    x: baseX - torsoWidth * 0.45,
    y: baseY - torsoHeight * 0.85,
    width: torsoWidth * 0.9,
    height: torsoHeight * 0.65
  });

  // Suit base
  ctx.fillStyle = suitColor;
  drawRoundedRect(
    ctx,
    baseX - torsoWidth / 2,
    baseY - torsoHeight,
    torsoWidth,
    torsoHeight,
    torsoWidth * 0.28
  );
  ctx.fill();

  // Suit pattern overlay
  drawSuitPattern(
    ctx,
    pattern,
    palette,
    {
      x: baseX - torsoWidth / 2,
      y: baseY - torsoHeight,
      width: torsoWidth,
      height: torsoHeight,
      radius: torsoWidth * 0.25
    }
  );

  // Suit details and straps
  drawSuitDetails(
    ctx,
    palette,
    {
      x: baseX - torsoWidth / 2,
      y: baseY - torsoHeight,
      width: torsoWidth,
      height: torsoHeight
    }
  );

  // Utility belt
  ctx.fillStyle = `${palette.accent ?? '#8aa1ff'}d0`;
  drawRoundedRect(
    ctx,
    baseX - torsoWidth * 0.55,
    baseY - torsoHeight * 0.12,
    torsoWidth * 1.1,
    torsoHeight * 0.18,
    torsoHeight * 0.1
  );
  ctx.fill();

  // Belt buckle detail
  ctx.fillStyle = `${palette.helmet ?? '#f5f7ff'}c0`;
  ctx.fillRect(baseX - torsoWidth * 0.1, baseY - torsoHeight * 0.06, torsoWidth * 0.2, torsoHeight * 0.06);

  // Gloves
  ctx.fillStyle = `${palette.helmet ?? '#f2f4ff'}d0`;
  drawRoundedRect(
    ctx,
    baseX - torsoWidth * 0.65,
    baseY - torsoHeight * 0.05,
    torsoWidth * 0.16,
    torsoHeight * 0.32,
    torsoWidth * 0.1
  );
  ctx.fill();

  drawRoundedRect(
    ctx,
    baseX + torsoWidth * 0.49,
    baseY - torsoHeight * 0.05,
    torsoWidth * 0.16,
    torsoHeight * 0.32,
    torsoWidth * 0.1
  );
  ctx.fill();

  // Boots
  ctx.fillStyle = `${suitColor}d5`;
  drawRoundedRect(
    ctx,
    baseX - torsoWidth * 0.5,
    baseY - torsoHeight * -0.02,
    torsoWidth * 0.35,
    torsoHeight * 0.35,
    torsoWidth * 0.12
  );
  ctx.fill();

  drawRoundedRect(
    ctx,
    baseX + torsoWidth * 0.15,
    baseY - torsoHeight * -0.02,
    torsoWidth * 0.35,
    torsoHeight * 0.35,
    torsoWidth * 0.12
  );
  ctx.fill();

  // Helmet and visor
  drawHelmet(ctx, palette, baseX, baseY - torsoHeight, headRadius);

  // Ambient noise for texture depth
  addNoise(
    ctx,
    baseX - torsoWidth / 2,
    baseY - torsoHeight,
    torsoWidth,
    torsoHeight + headRadius,
    '#ffffff',
    0.08,
    0.18
  );

  return canvas;
};

export const createTextureSwatch = (palette, pattern = 'banded') => {
  const suit = palette.suit ?? '#4c6ef5';
  const accent = palette.accent ?? '#91a7ff';
  const visor = palette.visor ?? '#d0ebff';
  const helmet = palette.helmet ?? '#edf2ff';

  switch (pattern) {
    case 'diagonal':
      return `repeating-linear-gradient(135deg, ${suit} 0 12px, ${accent} 12px 24px)`;
    case 'grid':
      return `
        linear-gradient(${suit} 0 100%),
        linear-gradient(90deg, ${accent}22 1px, transparent 1px),
        linear-gradient(${accent}22 1px, transparent 1px)
      `;
    case 'organic':
      return `radial-gradient(circle at 20% 30%, ${visor}cc 0 30%, transparent 30%),
        radial-gradient(circle at 70% 60%, ${accent}aa 0 35%, transparent 35%),
        linear-gradient(${suit}, ${helmet})`;
    case 'banded':
    default:
      return `linear-gradient(180deg, ${helmet} 0 20%, ${suit} 20% 70%, ${accent} 70% 85%, ${visor} 85% 100%)`;
  }
};
