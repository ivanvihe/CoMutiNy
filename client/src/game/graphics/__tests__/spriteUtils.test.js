import { DEFAULT_SPRITE_ANCHOR, SPRITE_METRICS } from '../spritePlacement.js';
import { fillIsometricTile, getIsometricDiamondPoints } from '../isometricTile.js';
import { registerShadowLayer } from '../spriteLayers.js';

const createMockContext = () => ({
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  fill: jest.fn(),
  ellipse: jest.fn(),
  fillStyle: '',
  globalAlpha: 1
});

describe('sprite metrics', () => {
  it('shares placement defaults across sprites', () => {
    expect(SPRITE_METRICS.tile.anchor).toEqual({ x: 0.5, y: 0.5, z: 0 });
    expect(SPRITE_METRICS.object.anchor).toEqual(DEFAULT_SPRITE_ANCHOR);
    expect(SPRITE_METRICS.character.anchor).toEqual(DEFAULT_SPRITE_ANCHOR);
    expect(SPRITE_METRICS.character.frame).toEqual({ width: 48, height: 64 });
  });
});

describe('isometric tile helpers', () => {
  it('returns diamond points covering the expected area', () => {
    const points = getIsometricDiamondPoints(48, 48);
    expect(points).toEqual([
      { x: 24, y: 0 },
      { x: 48, y: 24 },
      { x: 24, y: 48 },
      { x: 0, y: 24 }
    ]);
  });

  it('draws a diamond with the provided context', () => {
    const ctx = createMockContext();

    fillIsometricTile(ctx, {
      x: 10,
      y: 20,
      width: 48,
      height: 48,
      style: '#fff',
      alpha: 0.5
    });

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(34, 20);
    expect(ctx.lineTo).toHaveBeenCalledWith(58, 44);
    expect(ctx.lineTo).toHaveBeenCalledWith(34, 68);
    expect(ctx.lineTo).toHaveBeenCalledWith(10, 44);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});

describe('shadow layer registration', () => {
  it('normalises configuration using shared metrics', () => {
    const helpers = { registerLayer: jest.fn() };
    const result = registerShadowLayer(helpers, {
      width: 1.5,
      height: 1.2,
      tileSize: 48
    });

    expect(result).toBe(true);
    expect(helpers.registerLayer).toHaveBeenCalledTimes(1);

    const [layerId, drawFn, config] = helpers.registerLayer.mock.calls[0];
    expect(layerId).toBe('shadow');
    expect(config.anchor).toEqual(DEFAULT_SPRITE_ANCHOR);
    expect(config.offset.z).toBeCloseTo(SPRITE_METRICS.layers.shadow.offsetZ);
    expect(config.pixelOffset.y).toBeCloseTo(-5.76);

    const mockContext = createMockContext();
    drawFn(mockContext);
    expect(mockContext.ellipse).toHaveBeenCalledTimes(1);
    const [centerX, centerY, radiusX, radiusY] = mockContext.ellipse.mock.calls[0];
    expect(centerX).toBeCloseTo((1.5 * 48) / 2);
    expect(centerY).toBeCloseTo(1.2 * 48 - 48 * 0.08);
    expect(radiusX).toBeCloseTo(1.5 * 48 * (SPRITE_METRICS.layers.shadow.radiusXFactor ?? 0.42));
    expect(radiusY).toBeCloseTo(48 * (SPRITE_METRICS.layers.shadow.radiusYFactor ?? 0.22));
  });
});
