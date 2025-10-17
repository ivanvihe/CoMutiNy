export default class Animation {
  constructor({ name, frames = [], frameDuration = 120, loop = true }) {
    if (!frames.length) {
      throw new Error(`La animación "${name}" necesita al menos un frame.`);
    }

    this.name = name;
    this.frames = frames;
    this.frameDuration = frameDuration;
    this.loop = loop;
    this.elapsed = 0;
    this.index = 0;
    this.completed = false;
  }

  get currentFrame() {
    return this.frames[this.index];
  }

  reset() {
    this.elapsed = 0;
    this.index = 0;
    this.completed = false;
  }

  update(delta) {
    if (this.completed) return;

    this.elapsed += delta;

    while (this.elapsed >= this.frameDuration) {
      this.elapsed -= this.frameDuration;
      this.index += 1;

      if (this.index >= this.frames.length) {
        if (this.loop) {
          this.index = 0;
        } else {
          this.index = this.frames.length - 1;
          this.completed = true;
          break;
        }
      }
    }
  }
}
