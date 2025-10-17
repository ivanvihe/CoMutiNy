import LagCompensator from '../lagCompensation.js';

describe('LagCompensator', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('interpolates between samples using the configured buffer', () => {
    const compensator = new LagCompensator({ bufferMs: 50 });

    compensator.addSample({ x: 0, y: 0, z: 0 }, 0);
    compensator.addSample({ x: 10, y: 0, z: 0 }, 100);

    jest.setSystemTime(125);
    expect(compensator.getInterpolatedPosition()).toEqual({ x: 7.5, y: 0, z: 0 });

    jest.setSystemTime(150);
    expect(compensator.getInterpolatedPosition()).toEqual({ x: 10, y: 0, z: 0 });
  });

  it('extrapolates forward when updates arrive late', () => {
    const compensator = new LagCompensator({ bufferMs: 50, maxExtrapolationMs: 200 });

    compensator.addSample({ x: 0, y: 0, z: 0 }, 0);
    compensator.addSample({ x: 10, y: 0, z: 0 }, 100);

    jest.setSystemTime(300);
    // target time = 250ms, delta since last sample = 150ms, velocity = 0.1 units/ms.
    expect(compensator.getInterpolatedPosition()).toEqual({ x: 25, y: 0, z: 0 });
  });

  it('limits extrapolation to the configured maximum window', () => {
    const compensator = new LagCompensator({ bufferMs: 50, maxExtrapolationMs: 80 });

    compensator.addSample({ x: 0, y: 0, z: 0 }, 0);
    compensator.addSample({ x: 10, y: 0, z: 0 }, 100);

    jest.setSystemTime(400);
    // target time = 350ms, delta since last sample = 250ms -> clamped to 80ms.
    expect(compensator.getInterpolatedPosition()).toEqual({ x: 18, y: 0, z: 0 });
  });

  it('detects significant deviations against the latest sample', () => {
    const compensator = new LagCompensator();

    compensator.addSample({ x: 0, y: 0, z: 0 }, 0);

    expect(compensator.hasSignificantDeviation({ x: 0.001, y: 0, z: 0 })).toBe(false);
    expect(compensator.hasSignificantDeviation({ x: 5, y: 0, z: 0 })).toBe(true);
  });
});
