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
}
