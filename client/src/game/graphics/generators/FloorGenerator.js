import ProceduralGenerator from './ProceduralGenerator';

export default class FloorGenerator extends ProceduralGenerator {
  constructor(options = {}) {
    super({ cacheKeyPrefix: 'floor', ...options });
  }

  /**
   * Generates a tiled floor texture.
   * @param {object} options
   * @param {number} [options.width=64]
   * @param {number} [options.height=64]
   * @param {number} [options.tileSize=16]
   * @param {string[]} [options.tileColors=['#cfcfcf', '#b4b4b4']]
   * @param {string} [options.groutColor='#dcdcdc']
   * @returns {HTMLCanvasElement}
   */
  generateTiledFloor(options = {}) {
    const {
      width = this.defaultWidth,
      height = this.defaultHeight,
      tileSize = 16,
      tileColors = ['#cfcfcf', '#b4b4b4'],
      groutColor = '#dcdcdc',
    } = options;

    const cacheKey = this.buildCacheKey('tiledFloor', {
      width,
      height,
      tileSize,
      tileColors,
      groutColor,
    });

    return this.getOrCreateTexture(cacheKey, () => {
      const canvas = this.createCanvas(width, height);
      const ctx = this.getContext(canvas);

      ctx.fillStyle = groutColor;
      ctx.fillRect(0, 0, width, height);

      const rows = Math.ceil(height / tileSize);
      const cols = Math.ceil(width / tileSize);

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = col * tileSize + 1;
          const y = row * tileSize + 1;
          const tileColor = tileColors[(row + col) % tileColors.length];
          ctx.fillStyle = tileColor;
          ctx.fillRect(x, y, tileSize - 2, tileSize - 2);

          ctx.strokeStyle = 'rgba(0,0,0,0.08)';
          ctx.strokeRect(x, y, tileSize - 2, tileSize - 2);
        }
      }

      return canvas;
    });
  }
}
