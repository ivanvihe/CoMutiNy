import Sprite from './Sprite.js';

export default class CanvasEngine {
  constructor(canvas, { clearColor = '#000000' } = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('CanvasEngine requiere una instancia de HTMLCanvasElement.');
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('No fue posible obtener el contexto 2D del canvas.');
    }

    this.clearColor = clearColor;
    this.layers = [];
    this.layerMap = new Map();
    this.running = false;
    this.lastTime = 0;
    this.requestId = null;
  }

  addLayer(name, { zIndex = 0, visible = true } = {}) {
    if (this.layerMap.has(name)) {
      throw new Error(`La capa "${name}" ya existe.`);
    }

    const layer = {
      name,
      zIndex,
      visible,
      sprites: new Set()
    };

    this.layers.push(layer);
    this.layers.sort((a, b) => a.zIndex - b.zIndex);
    this.layerMap.set(name, layer);

    return layer;
  }

  getLayer(name) {
    return this.layerMap.get(name);
  }

  addSpriteToLayer(name, sprite) {
    if (!(sprite instanceof Sprite)) {
      throw new Error('Solo se pueden añadir instancias de Sprite a una capa.');
    }

    const layer = this.layerMap.get(name);
    if (!layer) {
      throw new Error(`La capa "${name}" no existe.`);
    }

    layer.sprites.add(sprite);
    return sprite;
  }

  removeSpriteFromLayer(name, sprite) {
    const layer = this.layerMap.get(name);
    if (!layer) return false;
    return layer.sprites.delete(sprite);
  }

  setLayerVisibility(name, visible) {
    const layer = this.layerMap.get(name);
    if (!layer) return;
    layer.visible = visible;
  }

  setClearColor(color) {
    this.clearColor = color;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (timestamp) => {
      if (!this.running) return;
      const delta = timestamp - this.lastTime;
      this.lastTime = timestamp;
      this.update(delta);
      this.render();
      this.requestId = requestAnimationFrame(loop);
    };
    this.requestId = requestAnimationFrame(loop);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.requestId) {
      cancelAnimationFrame(this.requestId);
      this.requestId = null;
    }
  }

  update(delta) {
    for (const layer of this.layers) {
      for (const sprite of layer.sprites) {
        sprite.update(delta);
      }
    }
  }

  render() {
    const { width, height } = this.canvas;
    this.ctx.save();
    this.ctx.fillStyle = this.clearColor;
    this.ctx.fillRect(0, 0, width, height);

    for (const layer of this.layers) {
      if (!layer.visible) continue;
      for (const sprite of layer.sprites) {
        sprite.draw(this.ctx);
      }
    }

    this.ctx.restore();
  }
}
