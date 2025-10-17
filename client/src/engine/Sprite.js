export default class Sprite {
  constructor({
    x = 0,
    y = 0,
    scale = 1,
    anchor = { x: 0.5, y: 1 },
    animations = {},
    defaultAnimation = null
  } = {}) {
    this.position = { x, y };
    this.velocity = { x: 0, y: 0 };
    this.scale = scale;
    this.anchor = anchor;
    this.animations = new Map();
    this.currentAnimation = null;
    this.currentAnimationName = null;

    Object.entries(animations).forEach(([name, animation]) => {
      this.addAnimation(name, animation);
    });

    if (defaultAnimation) {
      this.play(defaultAnimation, { force: true });
    }
  }

  addAnimation(name, animation) {
    this.animations.set(name, animation);
    return this;
  }

  play(name, { force = false, reset = true } = {}) {
    if (!force && this.currentAnimationName === name) {
      return;
    }

    const animation = this.animations.get(name);
    if (!animation) {
      throw new Error(`Animación "${name}" no registrada.`);
    }

    if (reset) {
      animation.reset();
    }

    this.currentAnimation = animation;
    this.currentAnimationName = name;
  }

  setVelocity(vx, vy) {
    this.velocity.x = vx;
    this.velocity.y = vy;
  }

  update(delta) {
    const seconds = delta / 1000;
    this.position.x += this.velocity.x * seconds;
    this.position.y += this.velocity.y * seconds;

    if (this.currentAnimation) {
      this.currentAnimation.update(delta);
    }
  }

  draw(ctx) {
    if (!this.currentAnimation) return;

    const frame = this.currentAnimation.currentFrame;
    if (!frame) return;

    const width = (frame.dw ?? frame.sw) * this.scale;
    const height = (frame.dh ?? frame.sh) * this.scale;
    const drawX = this.position.x - width * this.anchor.x;
    const drawY = this.position.y - height * this.anchor.y;

    frame.draw(ctx, drawX, drawY, this.scale);
  }
}
