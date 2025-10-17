const withRandom = (seed) => {
  if (!Number.isFinite(seed)) {
    return Math.random;
  }
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const drawBrickWall = (ctx, { width, height, tileSize, options = {} }) => {
  const brickW = tileSize;
  const brickH = tileSize / 2;
  const colors = options.colors ?? ['#8B4513', '#A0522D', '#9B5523', '#8A4513'];
  const random = withRandom(options.seed);

  for (let y = 0; y < height * 2; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y % 2 === 0 ? 0 : brickW / 2;
      const baseX = x * brickW + offset;
      const baseY = (y * brickH) / 2;

      const colorIndex = Math.floor(random() * colors.length);
      ctx.fillStyle = colors[(colorIndex + x + y) % colors.length];
      ctx.fillRect(baseX, baseY, brickW - 2, brickH - 2);

      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(baseX, baseY + brickH - 4, brickW - 2, 2);

      ctx.strokeStyle = options.strokeColor ?? '#5D3A1A';
      ctx.lineWidth = 1;
      ctx.strokeRect(baseX + 0.5, baseY + 0.5, brickW - 3, brickH - 3);
    }
  }
};

const drawMonstera = (ctx, { width, height, tileSize, options = {} }) => {
  const centerX = (width * tileSize) / 2;
  const stemColor = options.stemColor ?? '#2d5016';
  const leafColor = options.leafColor ?? '#3a7d2c';
  const darkLeaf = options.darkLeaf ?? '#2d6022';

  ctx.fillStyle = stemColor;
  ctx.fillRect(centerX - 3, tileSize, 6, height * tileSize - tileSize);

  const drawLeaf = (x, y, scale, rotation) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    ctx.fillStyle = leafColor;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.bezierCurveTo(-12, -10, -15, 5, -10, 15);
    ctx.bezierCurveTo(-5, 18, 5, 18, 10, 15);
    ctx.bezierCurveTo(15, 5, 12, -10, 0, -15);
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(-6, 0, 2, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, 0, 2, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = darkLeaf;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(0, 15);
    ctx.moveTo(0, -5);
    ctx.lineTo(-8, 5);
    ctx.moveTo(0, -5);
    ctx.lineTo(8, 5);
    ctx.stroke();

    ctx.restore();
  };

  drawLeaf(centerX - 15, tileSize * 0.5, 0.8, -0.3);
  drawLeaf(centerX + 15, tileSize * 0.8, 0.9, 0.4);
  drawLeaf(centerX - 12, tileSize * 1.2, 0.7, -0.5);
  drawLeaf(centerX + 10, tileSize * 1.5, 0.85, 0.2);
};

const drawStonePath = (ctx, { width, height, tileSize, options = {} }) => {
  ctx.fillStyle = options.background ?? '#8B7355';
  ctx.fillRect(0, 0, width * tileSize, height * tileSize);

  const random = withRandom(options.seed);
  const palette = options.colors ?? ['#9CA3A8', '#B0B8BD', '#A5ADB2'];
  const stoneCount = Math.max(1, Math.round(width * height * 2.5));

  for (let i = 0; i < stoneCount; i += 1) {
    const x = random() * width * tileSize;
    const y = random() * height * tileSize;
    const size = 4 + random() * 8;
    const sides = 5 + Math.floor(random() * 3);

    ctx.fillStyle = palette[Math.floor(random() * palette.length)];
    ctx.beginPath();
    for (let j = 0; j < sides; j += 1) {
      const angle = (j / sides) * Math.PI * 2;
      const radius = size * (0.8 + random() * 0.4);
      const pointX = x + Math.cos(angle) * radius;
      const pointY = y + Math.sin(angle) * radius;
      if (j === 0) {
        ctx.moveTo(pointX, pointY);
      } else {
        ctx.lineTo(pointX, pointY);
      }
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
};

const drawTree = (ctx, { width, height, tileSize, options = {} }) => {
  const centerX = (width * tileSize) / 2;
  const trunkColor = options.trunkColor ?? '#5D4037';
  const leafColor = options.leafColor ?? '#2E7D32';
  const darkLeaf = options.darkLeaf ?? '#1B5E20';

  ctx.fillStyle = trunkColor;
  const trunkWidth = Math.max(10, tileSize * 0.4);
  const trunkHeight = height * tileSize - tileSize * 1.2;
  ctx.fillRect(centerX - trunkWidth / 2, tileSize * 1.2, trunkWidth, trunkHeight);

  ctx.strokeStyle = '#4E342E';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(centerX - trunkWidth / 2, tileSize * 1.4 + i * 10);
    ctx.lineTo(centerX + trunkWidth / 2, tileSize * 1.4 + i * 10);
    ctx.stroke();
  }

  const drawFoliage = (x, y, radius) => {
    ctx.fillStyle = leafColor;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = darkLeaf;
    ctx.beginPath();
    ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  };

  const baseY = tileSize;
  drawFoliage(centerX, baseY * 1.2, tileSize * 0.9);
  drawFoliage(centerX - tileSize * 0.4, baseY * 0.8, tileSize * 0.75);
  drawFoliage(centerX + tileSize * 0.4, baseY * 0.8, tileSize * 0.75);
  drawFoliage(centerX, baseY * 0.5, tileSize * 0.85);
};

const drawGrass = (ctx, { width, height, tileSize, options = {} }) => {
  ctx.fillStyle = options.background ?? '#6B5D4F';
  ctx.fillRect(0, 0, width * tileSize, height * tileSize);

  const random = withRandom(options.seed);
  const grassColors = options.colors ?? ['#4A7C2B', '#5A8C3B', '#3A6C1B'];
  const bladeCount = Math.max(4, Math.round(width * height * tileSize * 1.5));

  for (let i = 0; i < bladeCount; i += 1) {
    const x = random() * width * tileSize;
    const y = random() * height * tileSize;
    const h = 4 + random() * 8;

    ctx.strokeStyle = grassColors[Math.floor(random() * grassColors.length)];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    const cpX = x + random() * 2 - 1;
    const cpY = y + h / 2;
    const endX = x + random() * 3 - 1.5;
    ctx.quadraticCurveTo(cpX, cpY, endX, y);
    ctx.stroke();
  }
};

const drawChest = (ctx, { width, height, tileSize, options = {} }) => {
  const centerX = (width * tileSize) / 2;
  const centerY = (height * tileSize) / 2;

  ctx.fillStyle = options.baseColor ?? '#8B6914';
  ctx.fillRect(centerX - 12, centerY - 4, 24, 12);

  ctx.fillStyle = options.lidColor ?? '#9B7914';
  ctx.beginPath();
  ctx.moveTo(centerX - 12, centerY - 4);
  ctx.lineTo(centerX - 10, centerY - 10);
  ctx.lineTo(centerX + 10, centerY - 10);
  ctx.lineTo(centerX + 12, centerY - 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = options.metalColor ?? '#4A4A4A';
  ctx.fillRect(centerX - 10, centerY - 2, 2, 8);
  ctx.fillRect(centerX + 8, centerY - 2, 2, 8);
  ctx.fillRect(centerX - 12, centerY + 2, 24, 2);

  ctx.fillStyle = options.lockColor ?? '#FFD700';
  ctx.beginPath();
  ctx.arc(centerX, centerY + 2, 3, 0, Math.PI * 2);
  ctx.fill();
};

const drawTerminalPanel = (ctx, { width, height, tileSize, options = {} }) => {
  const baseColor = options.baseColor ?? '#1f2933';
  const screenColor = options.screenColor ?? '#4fc3f7';
  const accentColor = options.accentColor ?? '#82e9ff';
  const standColor = options.standColor ?? '#263238';
  const glowColor = options.glowColor ?? 'rgba(79, 195, 247, 0.35)';

  ctx.fillStyle = standColor;
  ctx.fillRect(width * tileSize * 0.35, height * tileSize * 0.75, width * tileSize * 0.3, height * tileSize * 0.25);

  ctx.fillStyle = baseColor;
  const panelWidth = width * tileSize * 0.9;
  const panelHeight = height * tileSize * 0.65;
  const panelX = (width * tileSize - panelWidth) / 2;
  const panelY = height * tileSize * 0.05;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelWidth, panelHeight, tileSize * 0.1);
  ctx.fill();

  const screenPadding = tileSize * 0.2;
  ctx.fillStyle = screenColor;
  ctx.beginPath();
  ctx.roundRect(
    panelX + screenPadding,
    panelY + screenPadding,
    panelWidth - screenPadding * 2,
    panelHeight - screenPadding * 2,
    tileSize * 0.1
  );
  ctx.fill();

  const gradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
  gradient.addColorStop(0, glowColor);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelWidth, panelHeight, tileSize * 0.1);
  ctx.fill();

  ctx.fillStyle = accentColor;
  const lightCount = 3;
  for (let i = 0; i < lightCount; i += 1) {
    const radius = tileSize * 0.12;
    const x = panelX + panelWidth * (0.2 + i * 0.3);
    const y = panelY + panelHeight * 0.85;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(panelX + panelWidth * 0.2, panelY + panelHeight * 0.35);
  ctx.lineTo(panelX + panelWidth * 0.8, panelY + panelHeight * 0.35);
  ctx.moveTo(panelX + panelWidth * 0.3, panelY + panelHeight * 0.5);
  ctx.lineTo(panelX + panelWidth * 0.7, panelY + panelHeight * 0.5);
  ctx.stroke();
};

const drawCommunityDoor = (ctx, { width, height, tileSize, options = {} }) => {
  const frameColor = options.frameColor ?? '#37474f';
  const panelColor = options.panelColor ?? '#546e7a';
  const accentColor = options.accentColor ?? '#ffca28';
  const glowColor = options.glowColor ?? 'rgba(255, 202, 40, 0.4)';

  const doorWidth = width * tileSize * 0.8;
  const doorHeight = height * tileSize * 0.95;
  const doorX = (width * tileSize - doorWidth) / 2;
  const doorY = height * tileSize * 0.05;

  ctx.fillStyle = frameColor;
  ctx.beginPath();
  ctx.roundRect(doorX - tileSize * 0.1, doorY - tileSize * 0.05, doorWidth + tileSize * 0.2, doorHeight + tileSize * 0.1, tileSize * 0.15);
  ctx.fill();

  ctx.fillStyle = panelColor;
  ctx.beginPath();
  ctx.roundRect(doorX, doorY, doorWidth, doorHeight, tileSize * 0.1);
  ctx.fill();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = tileSize * 0.08;
  ctx.strokeRect(doorX + tileSize * 0.15, doorY + tileSize * 0.2, doorWidth - tileSize * 0.3, doorHeight - tileSize * 0.4);

  ctx.fillStyle = glowColor;
  ctx.beginPath();
  ctx.roundRect(doorX + tileSize * 0.2, doorY + tileSize * 0.25, doorWidth - tileSize * 0.4, doorHeight - tileSize * 0.5, tileSize * 0.08);
  ctx.fill();

  const stripeCount = 4;
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = tileSize * 0.04;
  for (let i = 0; i < stripeCount; i += 1) {
    const stripeY = doorY + doorHeight * (0.25 + i * 0.15);
    ctx.beginPath();
    ctx.moveTo(doorX + tileSize * 0.25, stripeY);
    ctx.lineTo(doorX + doorWidth - tileSize * 0.25, stripeY);
    ctx.stroke();
  }

  const knobRadius = tileSize * 0.12;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(doorX + doorWidth * 0.7, doorY + doorHeight * 0.55, knobRadius, 0, Math.PI * 2);
  ctx.fill();
};

const BUILTIN_SPRITE_GENERATORS = {
  brickWall: drawBrickWall,
  monstera: drawMonstera,
  stonePath: drawStonePath,
  tree: drawTree,
  grass: drawGrass,
  chest: drawChest,
  terminalPanel: drawTerminalPanel,
  communityDoor: drawCommunityDoor
};

const CUSTOM_SPRITE_GENERATORS = new Map();

const buildGeneratorFromSource = (source) => {
  if (typeof source !== 'string') {
    return null;
  }

  const trimmed = source.trim();
  if (!trimmed) {
    return null;
  }

  try {
    // eslint-disable-next-line no-new-func
    const factory = new Function(`return (${trimmed});`);
    const generator = factory();
    return typeof generator === 'function' ? generator : null;
  } catch (error) {
    console.warn('[objects] No se pudo interpretar el generador Canvas remoto', error);
    return null;
  }
};

export const resolveSpriteGenerator = (id) => {
  if (!id) {
    return null;
  }

  const key = `${id}`.trim();
  if (!key) {
    return null;
  }

  if (CUSTOM_SPRITE_GENERATORS.has(key)) {
    return CUSTOM_SPRITE_GENERATORS.get(key);
  }

  return BUILTIN_SPRITE_GENERATORS[key] ?? null;
};

export const registerSpriteGenerator = (id, generator) => {
  if (typeof id !== 'string' || typeof generator !== 'function') {
    return null;
  }

  const key = id.trim();
  if (!key) {
    return null;
  }

  CUSTOM_SPRITE_GENERATORS.set(key, generator);
  return { id: key, generator };
};

export const registerSpriteGeneratorSource = (id, source) => {
  const generator = buildGeneratorFromSource(source);
  if (!generator) {
    return null;
  }
  return registerSpriteGenerator(id, generator);
};

export const registerSpriteGeneratorDefinitions = (definitions = []) => {
  const registered = [];

  definitions.forEach((definition) => {
    if (!definition || typeof definition !== 'object') {
      return;
    }

    const identifier =
      (typeof definition.id === 'string' && definition.id.trim()) ||
      (typeof definition.name === 'string' && definition.name.trim()) ||
      null;

    if (!identifier) {
      return;
    }

    try {
      if (typeof definition.generator === 'function') {
        const result = registerSpriteGenerator(identifier, definition.generator);
        if (result) {
          registered.push(result);
        }
        return;
      }

      const source =
        (typeof definition.source === 'string' && definition.source.trim()) ||
        (typeof definition.generatorSource === 'string' && definition.generatorSource.trim()) ||
        null;

      if (source) {
        const result = registerSpriteGeneratorSource(identifier, source);
        if (result) {
          registered.push(result);
        }
      }
    } catch (error) {
      console.warn(`[objects] No se pudo registrar el generador Canvas ${identifier}`, error);
    }
  });

  return registered;
};

export const SPRITE_GENERATORS = BUILTIN_SPRITE_GENERATORS;

export default SPRITE_GENERATORS;
