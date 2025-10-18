/**
 * Base class for procedural sprite generation.
 *
 * This implementation relies on the presence of a DOM-like environment that
 * provides `document.createElement('canvas')` and the 2D canvas API. When
 * running outside a browser you must provide a compatible implementation (for
 * example the `canvas` package in Node.js).
 */
export default class ProceduralGenerator {
  constructor({ defaultWidth = 64, defaultHeight = 64, cacheKeyPrefix = '' } = {}) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      throw new Error('ProceduralGenerator requires a DOM with canvas support.');
    }

    this.defaultWidth = defaultWidth;
    this.defaultHeight = defaultHeight;
    this.cacheKeyPrefix = cacheKeyPrefix;
    this.textureCache = new Map();
  }

  /**
   * Creates a canvas element and ensures it is configured with the provided size.
   * @param {number} [width]
   * @param {number} [height]
   * @returns {HTMLCanvasElement}
   */
  createCanvas(width = this.defaultWidth, height = this.defaultHeight) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Returns the 2D context for the given canvas and clears it.
   * @param {HTMLCanvasElement} canvas
   * @returns {CanvasRenderingContext2D}
   */
  getContext(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return ctx;
  }

  /**
   * Creates a cache key for a generation method using the provided parameters.
   * @param {string} methodName
   * @param {object} params
   * @returns {string}
   */
  buildCacheKey(methodName, params = {}) {
    const sortedEntries = Object.entries(params)
      .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0))
      .map(([key, value]) => {
        if (value && typeof value === 'object') {
          return `${key}:${JSON.stringify(value)}`;
        }
        return `${key}:${value}`;
      })
      .join('|');
    const prefix = this.cacheKeyPrefix ? `${this.cacheKeyPrefix}:` : '';
    return `${prefix}${methodName}::${sortedEntries}`;
  }

  /**
   * Retrieves a cached texture or executes the provided generator and stores it.
   * @param {string} cacheKey
   * @param {() => HTMLCanvasElement} generator
   * @returns {HTMLCanvasElement}
   */
  getOrCreateTexture(cacheKey, generator) {
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    const texture = generator();
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  /**
   * Utility to draw rounded rectangles.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {number} radius
   */
  drawRoundedRect(ctx, x, y, width, height, radius = 4) {
    const clampedRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + clampedRadius, y);
    ctx.lineTo(x + width - clampedRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
    ctx.lineTo(x + width, y + height - clampedRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - clampedRadius, y + height);
    ctx.lineTo(x + clampedRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
    ctx.lineTo(x, y + clampedRadius);
    ctx.quadraticCurveTo(x, y, x + clampedRadius, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Helper that renders a linear gradient.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {string[]} colors
   * @returns {CanvasGradient}
   */
  createLinearGradient(ctx, x, y, width, height, colors) {
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    const step = colors.length > 1 ? 1 / (colors.length - 1) : 1;
    colors.forEach((color, index) => {
      gradient.addColorStop(Math.min(1, index * step), color);
    });
    return gradient;
  }
}
