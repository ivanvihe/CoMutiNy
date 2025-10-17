export default class AnimationFrame {
  constructor({ image, sx = 0, sy = 0, sw, sh, dx = 0, dy = 0, dw, dh }) {
    if (!image) {
      throw new Error('AnimationFrame requiere una imagen o un canvas.');
    }
    this.image = image;
    this.sx = sx;
    this.sy = sy;
    this.sw = sw ?? image.width;
    this.sh = sh ?? image.height;
    this.dx = dx;
    this.dy = dy;
    this.dw = dw ?? this.sw;
    this.dh = dh ?? this.sh;
  }

  draw(ctx, x, y, scale = 1) {
    const drawX = x + this.dx * scale;
    const drawY = y + this.dy * scale;
    const width = this.dw * scale;
    const height = this.dh * scale;

    ctx.drawImage(
      this.image,
      this.sx,
      this.sy,
      this.sw,
      this.sh,
      Math.round(drawX),
      Math.round(drawY),
      Math.round(width),
      Math.round(height)
    );
  }
}
