import ProceduralGenerator from './ProceduralGenerator';

export default class FurnitureGenerator extends ProceduralGenerator {
  constructor(options = {}) {
    super({ cacheKeyPrefix: 'furniture', ...options });
  }

  /**
   * Generates a wooden furniture panel.
   * @param {object} options
   * @param {number} [options.width=64]
   * @param {number} [options.height=64]
   * @param {string} [options.baseColor='#8b5a2b']
   * @param {string} [options.highlightColor='#b07c44']
   * @param {string} [options.shadowColor='#5a3617']
   * @param {boolean} [options.addHandle=true]
   * @returns {HTMLCanvasElement}
   */
  generateWoodPanel(options = {}) {
    const {
      width = this.defaultWidth,
      height = this.defaultHeight,
      baseColor = '#8b5a2b',
      highlightColor = '#b07c44',
      shadowColor = '#5a3617',
      addHandle = true,
    } = options;

    const cacheKey = this.buildCacheKey('woodPanel', {
      width,
      height,
      baseColor,
      highlightColor,
      shadowColor,
      addHandle,
    });

    return this.getOrCreateTexture(cacheKey, () => {
      const canvas = this.createCanvas(width, height);
      const ctx = this.getContext(canvas);

      ctx.fillStyle = this.createLinearGradient(ctx, 0, 0, width, height, [shadowColor, baseColor, highlightColor]);
      this.drawRoundedRect(ctx, 0, 0, width, height, 6);

      ctx.fillStyle = shadowColor;
      ctx.fillRect(width * 0.1, height * 0.25, width * 0.8, height * 0.1);
      ctx.fillRect(width * 0.1, height * 0.65, width * 0.8, height * 0.1);

      if (addHandle) {
        const handleWidth = width * 0.2;
        const handleHeight = height * 0.1;
        ctx.fillStyle = '#d5cfa3';
        this.drawRoundedRect(
          ctx,
          width / 2 - handleWidth / 2,
          height / 2 - handleHeight / 2,
          handleWidth,
          handleHeight,
          handleHeight / 2
        );
      }

      return canvas;
    });
  }
}
