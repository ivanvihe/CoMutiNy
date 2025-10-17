import { CanvasEngine, Sprite, Animation, AnimationFrame } from './engine/index.js';
import { createIdleAnimation, createWalkAnimation } from './demo/characterFactory.js';

const canvas = document.getElementById('game-canvas');
const engine = new CanvasEngine(canvas, { clearColor: '#1f2231' });

engine.addLayer('background', { zIndex: 0 });
engine.addLayer('characters', { zIndex: 1 });
engine.addLayer('foreground', { zIndex: 2 });

function createBackgroundSprite(width, height) {
  const buffer = document.createElement('canvas');
  buffer.width = width;
  buffer.height = height;
  const ctx = buffer.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#25334d');
  gradient.addColorStop(1, '#1a1f2e');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let i = 0; i < 80; i += 1) {
    const size = 2 + Math.random() * 2;
    const x = Math.random() * width;
    const y = Math.random() * height * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const frame = new AnimationFrame({ image: buffer, dw: width, dh: height });
  const animation = new Animation({ name: 'static', frames: [frame], frameDuration: 1000, loop: false });

  return new Sprite({
    x: 0,
    y: 0,
    anchor: { x: 0, y: 0 },
    animations: { static: animation },
    defaultAnimation: 'static'
  });
}

const background = createBackgroundSprite(canvas.width, canvas.height);
engine.addSpriteToLayer('background', background);

const idleAnimation = createIdleAnimation();
const walkAnimation = createWalkAnimation();

const hero = new Sprite({
  x: canvas.width / 2,
  y: canvas.height - 32,
  scale: 2,
  animations: {
    idle: idleAnimation,
    walk: walkAnimation
  },
  defaultAnimation: 'idle'
});

engine.addSpriteToLayer('characters', hero);

let direction = 0;
const SPEED = 85;

function updateMovement() {
  hero.setVelocity(direction * SPEED, 0);
  if (direction === 0) {
    hero.play('idle');
  } else {
    hero.play('walk');
  }
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    direction = -1;
    updateMovement();
  } else if (event.key === 'ArrowRight') {
    direction = 1;
    updateMovement();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft' && direction === -1) {
    direction = 0;
    updateMovement();
  } else if (event.key === 'ArrowRight' && direction === 1) {
    direction = 0;
    updateMovement();
  }
});

engine.start();
