import ProceduralGenerator from './ProceduralGenerator';

export default class WallGenerator extends ProceduralGenerator {
  constructor(options = {}) {
    super({ cacheKeyPrefix: 'wall', ...options });
  }

  /**
   * Generates a brick wall texture.
   * @param {object} options
   * @param {number} [options.width=64]
   * @param {number} [options.height=64]
   * @param {number} [options.brickWidth=16]
   * @param {number} [options.brickHeight=8]
   * @param {string} [options.brickColor='#b5563c']
   * @param {string} [options.highlightColor='#d96d43']
   * @param {string} [options.mortarColor='#e6d9c6']
   * @returns {HTMLCanvasElement}
   */
  generateBrickWall(options = {}) {
    const {
      width = this.defaultWidth,
      height = this.defaultHeight,
      brickWidth = 16,
      brickHeight = 8,
      brickColor = '#b5563c',
      highlightColor = '#d96d43',
      mortarColor = '#e6d9c6',
    } = options;

    const cacheKey = this.buildCacheKey('brickWall', {
      width,
      height,
      brickWidth,
      brickHeight,
      brickColor,
      highlightColor,
      mortarColor,
    });

    return this.getOrCreateTexture(cacheKey, () => {
      const canvas = this.createCanvas(width, height);
      const ctx = this.getContext(canvas);

      ctx.fillStyle = mortarColor;
      ctx.fillRect(0, 0, width, height);

      const rows = Math.ceil(height / brickHeight);
      const cols = Math.ceil(width / brickWidth) + 1;

      for (let row = 0; row < rows; row += 1) {
        const y = row * brickHeight;
        const offset = row % 2 === 0 ? 0 : brickWidth / 2;
        for (let col = -1; col < cols; col += 1) {
          const x = col * brickWidth + offset;
          ctx.fillStyle = brickColor;
          ctx.fillRect(x + 1, y + 1, brickWidth - 2, brickHeight - 2);

          ctx.fillStyle = highlightColor;
          ctx.fillRect(x + brickWidth - 5, y + 1, 4, brickHeight - 4);
        }
      }

      return canvas;
    });
  }

  generateModularWall(options = {}) {
    const {
      width = this.defaultWidth,
      height = this.defaultHeight,
      baseColor = '#8897b3',
      highlightColor = '#b6c4de',
      shadowColor = '#4b5569',
      frameColor = '#1f2633',
      panelCount = 3,
      frameWidth = 4
    } = options;

    const cacheKey = this.buildCacheKey('modularWall', {
      width,
      height,
      baseColor,
      highlightColor,
      shadowColor,
      frameColor,
      panelCount,
      frameWidth
    });

    return this.getOrCreateTexture(cacheKey, () => {
      const canvas = this.createCanvas(width, height);
      const ctx = this.getContext(canvas);

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, highlightColor);
      gradient.addColorStop(0.45, baseColor);
      gradient.addColorStop(1, shadowColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = frameColor;
      ctx.fillRect(0, 0, width, frameWidth);
      ctx.fillRect(0, height - frameWidth, width, frameWidth);

      const effectiveHeight = height - frameWidth * 2;
      const panelWidth = width / Math.max(1, panelCount);
      for (let index = 1; index < panelCount; index += 1) {
        const x = Math.round(index * panelWidth);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.fillRect(x - 1, frameWidth, 2, effectiveHeight);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fillRect(x + 1, frameWidth + 1, 1, effectiveHeight - 2);
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(0, frameWidth + effectiveHeight * 0.65, width, 2);

      return canvas;
    });
  }

  generateWindowWall(options = {}) {
    const {
      width = this.defaultWidth,
      height = this.defaultHeight,
      baseColor = '#7d8fb0',
      highlightColor = '#b7c4e0',
      shadowColor = '#48526b',
      frameColor = '#202838',
      glassTop = '#a9e7ff',
      glassBottom = '#3687c2',
      mullionColor = '#e2f3ff',
      panelCount = 3,
      frameWidth = 4
    } = options;

    const cacheKey = this.buildCacheKey('windowWall', {
      width,
      height,
      baseColor,
      highlightColor,
      shadowColor,
      frameColor,
      glassTop,
      glassBottom,
      mullionColor,
      panelCount,
      frameWidth
    });

    return this.getOrCreateTexture(cacheKey, () => {
      const canvas = this.createCanvas(width, height);
      const ctx = this.getContext(canvas);

      const base = this.generateModularWall({
        width,
        height,
        baseColor,
        highlightColor,
        shadowColor,
        frameColor,
        panelCount,
        frameWidth
      });
      ctx.drawImage(base, 0, 0);

      const inset = frameWidth + 2;
      const windowHeight = Math.max(24, height * 0.45);
      const windowTop = Math.max(frameWidth + 4, Math.round(height * 0.22));
      const windowBottom = Math.min(height - frameWidth - 4, windowTop + windowHeight);
      const windowLeft = inset;
      const windowRight = width - inset;
      const windowWidth = windowRight - windowLeft;

      ctx.fillStyle = frameColor;
      ctx.fillRect(windowLeft - 3, windowTop - 3, windowWidth + 6, windowBottom - windowTop + 6);

      const glassGradient = ctx.createLinearGradient(0, windowTop, 0, windowBottom);
      glassGradient.addColorStop(0, glassTop);
      glassGradient.addColorStop(1, glassBottom);
      ctx.fillStyle = glassGradient;
      ctx.fillRect(windowLeft, windowTop, windowWidth, windowBottom - windowTop);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(windowLeft + windowWidth * 0.12, windowTop);
      ctx.lineTo(windowLeft + windowWidth * 0.5, windowTop);
      ctx.lineTo(windowLeft + windowWidth * 0.28, windowBottom);
      ctx.lineTo(windowLeft - windowWidth * 0.04, windowBottom);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const mullionCount = Math.max(2, Math.round(windowWidth / 28));
      ctx.fillStyle = mullionColor;
      for (let i = 1; i < mullionCount; i += 1) {
        const x = windowLeft + (windowWidth / mullionCount) * i;
        ctx.fillRect(Math.round(x) - 1, windowTop, 2, windowBottom - windowTop);
      }
      const horizontalBar = Math.round(windowTop + (windowBottom - windowTop) * 0.55);
      ctx.fillRect(windowLeft, horizontalBar - 1, windowWidth, 2);

      return canvas;
    });
  }

  generateDoorWall(options = {}) {
    const {
      width = this.defaultWidth,
      height = this.defaultHeight,
      baseColor = '#6d7a96',
      highlightColor = '#aab5cf',
      shadowColor = '#424a5f',
      frameColor = '#1d2330',
      doorTop = '#d49b6a',
      doorBottom = '#7a4e2c',
      accentColor = '#ffd7a3',
      panelCount = 3,
      frameWidth = 4
    } = options;

    const cacheKey = this.buildCacheKey('doorWall', {
      width,
      height,
      baseColor,
      highlightColor,
      shadowColor,
      frameColor,
      doorTop,
      doorBottom,
      accentColor,
      panelCount,
      frameWidth
    });

    return this.getOrCreateTexture(cacheKey, () => {
      const canvas = this.createCanvas(width, height);
      const ctx = this.getContext(canvas);

      const base = this.generateModularWall({
        width,
        height,
        baseColor,
        highlightColor,
        shadowColor,
        frameColor,
        panelCount,
        frameWidth
      });
      ctx.drawImage(base, 0, 0);

      const doorWidth = Math.round(width * 0.42);
      const doorHeight = Math.round(height * 0.68);
      const doorLeft = Math.round((width - doorWidth) / 2);
      const doorTopY = height - doorHeight - frameWidth;
      const doorGradient = ctx.createLinearGradient(0, doorTopY, 0, doorTopY + doorHeight);
      doorGradient.addColorStop(0, doorTop);
      doorGradient.addColorStop(1, doorBottom);

      ctx.fillStyle = frameColor;
      ctx.fillRect(doorLeft - 4, doorTopY - 2, doorWidth + 8, doorHeight + 6);

      ctx.fillStyle = doorGradient;
      ctx.fillRect(doorLeft, doorTopY, doorWidth, doorHeight);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(doorLeft + doorWidth / 2 - 1, doorTopY + 6, 2, doorHeight - 12);

      ctx.fillStyle = accentColor;
      const handleY = doorTopY + doorHeight / 2;
      ctx.fillRect(Math.round(doorLeft + doorWidth * 0.72), Math.round(handleY) - 2, 6, 4);
      ctx.fillRect(Math.round(doorLeft + doorWidth * 0.28) - 6, Math.round(handleY) - 2, 6, 4);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.moveTo(doorLeft + 6, doorTopY + 6);
      ctx.lineTo(doorLeft + doorWidth * 0.45, doorTopY + 6);
      ctx.lineTo(doorLeft + doorWidth * 0.25, doorTopY + doorHeight - 6);
      ctx.lineTo(doorLeft + 6, doorTopY + doorHeight - 6);
      ctx.closePath();
      ctx.fill();

      return canvas;
    });
  }
}
