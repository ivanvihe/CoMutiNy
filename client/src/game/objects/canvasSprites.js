import {
  resolveSpriteGenerator,
  registerSpriteGeneratorDefinitions
} from './spriteGenerators.js';

export const getSpriteGenerator = (id) => {
  return resolveSpriteGenerator(id);
};

export const createSpriteCanvas = ({ generator, width, height, tileSize, options }) => {
  if (typeof document === 'undefined') {
    return null;
  }

  const generatorFn = getSpriteGenerator(generator);
  if (typeof generatorFn !== 'function') {
    return null;
  }

  const safeWidth = Math.max(1, Math.round(width * tileSize));
  const safeHeight = Math.max(1, Math.round(height * tileSize));

  const canvas = document.createElement('canvas');
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  generatorFn(ctx, { width, height, tileSize, options: options ?? {} });
  return canvas;
};

export const registerCanvasSpriteDefinitions = (definitions) => {
  return registerSpriteGeneratorDefinitions(definitions);
};

export default createSpriteCanvas;
