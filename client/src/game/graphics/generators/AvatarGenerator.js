import ProceduralGenerator from './ProceduralGenerator';

export default class AvatarGenerator extends ProceduralGenerator {
  constructor(options = {}) {
    super({ cacheKeyPrefix: 'avatar', defaultWidth: 64, defaultHeight: 64, ...options });
  }

  /**
   * Generates a simple stylised avatar head.
   * @param {object} options
   * @param {number} [options.width=64]
   * @param {number} [options.height=64]
   * @param {string} [options.skinColor='#f1c27d']
   * @param {string} [options.hairColor='#3c2a1e']
   * @param {string} [options.eyeColor='#2c2c2c']
   * @param {string} [options.shirtColor='#3a6ea5']
   * @param {boolean} [options.hasSmile=true]
   * @returns {HTMLCanvasElement}
   */
  generateAvatar(options = {}) {
    const {
      width = this.defaultWidth,
      height = this.defaultHeight,
      skinColor = '#f1c27d',
      hairColor = '#3c2a1e',
      eyeColor = '#2c2c2c',
      shirtColor = '#3a6ea5',
      hasSmile = true,
    } = options;

    const cacheKey = this.buildCacheKey('avatar', {
      width,
      height,
      skinColor,
      hairColor,
      eyeColor,
      shirtColor,
      hasSmile,
    });

    return this.getOrCreateTexture(cacheKey, () => {
      const canvas = this.createCanvas(width, height);
      const ctx = this.getContext(canvas);

      const centerX = width / 2;
      const centerY = height / 2 - height * 0.1;
      const radius = Math.min(width, height) * 0.35;

      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.arc(centerX, centerY - radius * 0.2, radius * 1.1, Math.PI, 0);
      ctx.fill();

      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = shirtColor;
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 1.1, centerY + radius * 0.8);
      ctx.lineTo(centerX + radius * 1.1, centerY + radius * 0.8);
      ctx.lineTo(centerX + radius * 0.8, height);
      ctx.lineTo(centerX - radius * 0.8, height);
      ctx.closePath();
      ctx.fill();

      const eyeRadius = radius * 0.12;
      const eyeOffsetX = radius * 0.45;
      const eyeY = centerY - radius * 0.1;
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.arc(centerX - eyeOffsetX, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.arc(centerX + eyeOffsetX, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX - eyeOffsetX, eyeY - eyeRadius * 0.3, eyeRadius * 0.4, 0, Math.PI * 2);
      ctx.arc(centerX + eyeOffsetX, eyeY - eyeRadius * 0.3, eyeRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      if (hasSmile) {
        ctx.strokeStyle = '#8a4b24';
        ctx.lineWidth = Math.max(2, radius * 0.12);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(centerX, centerY + radius * 0.25, radius * 0.5, 0, Math.PI);
        ctx.stroke();
      }

      return canvas;
    });
  }
}
