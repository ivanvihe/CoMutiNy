import ProceduralGenerator from './ProceduralGenerator';

export default class PlantGenerator extends ProceduralGenerator {
  constructor(options = {}) {
    super({ cacheKeyPrefix: 'plant', ...options });
  }

  /**
   * Generates a simple potted plant sprite.
   * @param {object} options
   * @param {number} [options.width=48]
   * @param {number} [options.height=64]
   * @param {string} [options.potColor='#c77b30']
   * @param {string} [options.soilColor='#4b2e16']
   * @param {string[]} [options.leafColors=['#3a9d23', '#5cd147']]
   * @param {number} [options.leafCount=5]
   * @returns {HTMLCanvasElement}
   */
  generatePottedPlant(options = {}) {
    const {
      width = 48,
      height = 64,
      potColor = '#c77b30',
      soilColor = '#4b2e16',
      leafColors = ['#3a9d23', '#5cd147'],
      leafCount = 5,
    } = options;

    const cacheKey = this.buildCacheKey('pottedPlant', {
      width,
      height,
      potColor,
      soilColor,
      leafColors,
      leafCount,
    });

    return this.getOrCreateTexture(cacheKey, () => {
      const canvas = this.createCanvas(width, height);
      const ctx = this.getContext(canvas);

      const potHeight = height * 0.35;
      const potWidth = width * 0.7;
      const potX = (width - potWidth) / 2;
      const potY = height - potHeight;

      ctx.fillStyle = soilColor;
      ctx.fillRect(potX + potWidth * 0.1, potY - potHeight * 0.2, potWidth * 0.8, potHeight * 0.2);

      ctx.fillStyle = potColor;
      this.drawRoundedRect(ctx, potX, potY - potHeight * 0.1, potWidth, potHeight * 1.1, 6);

      ctx.fillStyle = potColor;
      ctx.fillRect(potX - potWidth * 0.05, potY + potHeight * 0.5, potWidth * 1.1, potHeight * 0.15);

      const centerX = width / 2;
      const baseY = potY - potHeight * 0.2;
      const radius = Math.min(width, height) * 0.35;

      for (let i = 0; i < leafCount; i += 1) {
        const angle = (i / leafCount) * Math.PI + Math.PI / 2;
        const leafLength = radius + Math.sin(i) * radius * 0.2;
        const leafWidth = radius * 0.35;
        ctx.save();
        ctx.translate(centerX, baseY);
        ctx.rotate(Math.cos(i) * 0.2 + angle - Math.PI / 2);
        const gradient = this.createLinearGradient(ctx, 0, -leafLength, leafWidth, leafLength, leafColors);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(leafWidth, -leafLength / 2, 0, -leafLength);
        ctx.quadraticCurveTo(-leafWidth, -leafLength / 2, 0, 0);
        ctx.fill();
        ctx.restore();
      }

      return canvas;
    });
  }
}
