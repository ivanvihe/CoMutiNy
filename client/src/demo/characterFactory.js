import Animation from '../engine/Animation.js';
import AnimationFrame from '../engine/AnimationFrame.js';

const WIDTH = 48;
const HEIGHT = 64;

function createCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return canvas;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

function drawCharacter({ armSwing = 0, legSwing = 0, bob = 0 }) {
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d');
  const centerX = WIDTH / 2;
  const groundY = HEIGHT - 4;

  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  const shadowWidth = 28 + Math.abs(legSwing) * 0.6;
  ctx.beginPath();
  ctx.ellipse(centerX, groundY, shadowWidth / 2, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const bobOffset = bob;

  // legs
  ctx.fillStyle = '#3b5dc9';
  drawRoundedRect(ctx, centerX - 14 + legSwing, groundY - 36 + bobOffset, 10, 36, 4);
  drawRoundedRect(ctx, centerX + 4 + legSwing * -1, groundY - 36 + bobOffset, 10, 36, 4);

  // torso
  ctx.fillStyle = '#ff7043';
  drawRoundedRect(ctx, centerX - 16, groundY - 64 + bobOffset, 32, 36, 8);

  // arms
  ctx.fillStyle = '#f5a25d';
  drawRoundedRect(ctx, centerX - 26 + armSwing, groundY - 56 + bobOffset, 10, 28, 6);
  drawRoundedRect(ctx, centerX + 16 + armSwing * -1, groundY - 56 + bobOffset, 10, 28, 6);

  // head
  ctx.fillStyle = '#ffd9b3';
  ctx.beginPath();
  ctx.arc(centerX, groundY - 74 + bobOffset, 16, 0, Math.PI * 2);
  ctx.fill();

  // hair
  ctx.fillStyle = '#2b1e1e';
  ctx.beginPath();
  ctx.arc(centerX, groundY - 80 + bobOffset, 18, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // eyes
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(centerX - 6, groundY - 74 + bobOffset, 4, 4);
  ctx.fillRect(centerX + 2, groundY - 74 + bobOffset, 4, 4);

  return canvas;
}

function createFrame(options) {
  const image = drawCharacter(options);
  return new AnimationFrame({ image, dw: WIDTH, dh: HEIGHT });
}

export function createIdleAnimation() {
  const frames = [
    createFrame({ bob: 0 }),
    createFrame({ bob: -2 })
  ];

  return new Animation({
    name: 'idle',
    frames,
    frameDuration: 550,
    loop: true
  });
}

export function createWalkAnimation() {
  const frames = [
    createFrame({ armSwing: -6, legSwing: -6, bob: -2 }),
    createFrame({ armSwing: 0, legSwing: 0, bob: 0 }),
    createFrame({ armSwing: 6, legSwing: 6, bob: -2 }),
    createFrame({ armSwing: 0, legSwing: 0, bob: 0 })
  ];

  return new Animation({
    name: 'walk',
    frames,
    frameDuration: 140,
    loop: true
  });
}
