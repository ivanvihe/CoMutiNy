import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Vector2 {
    public x: number;
    public y: number;

    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }

    clone(): Vector2 {
      return new Vector2(this.x, this.y);
    }

    subtract(vector: Vector2): this {
      this.x -= vector.x;
      this.y -= vector.y;
      return this;
    }

    add(vector: Vector2): this {
      this.x += vector.x;
      this.y += vector.y;
      return this;
    }
  }

  class Vector3 {
    public x: number;
    public y: number;
    public z: number;

    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }

  class ScenePlugin {
    constructor(..._args: unknown[]) {}
  }

  return {
    default: {
      Math: {
        Vector2,
        Vector3,
        Clamp(value: number, min: number, max: number): number {
          return Math.min(Math.max(value, min), max);
        },
      },
      Plugins: {
        ScenePlugin,
      },
    },
  };
});

const Phaser = (await import('phaser')).default;
const { clampIsoToBounds, isoToScreenPoint, screenToIsoPoint } = await import('../isoMath');
import type IsometricPlugin from '../plugins/IsometricPlugin';

describe('isoMath helpers', () => {
  describe('isoToScreenPoint', () => {
    it('aplica offsets y corrige la altura mostrada', () => {
      const iso = new Phaser.Math.Vector3(2, 3, 0);
      const baseVector = new Phaser.Math.Vector2(20, 30);
      const plugin = {
        isoToScreen: vi.fn(() => baseVector.clone()),
      } as unknown as IsometricPlugin;

      const result = isoToScreenPoint(iso, plugin, {
        offset: new Phaser.Math.Vector2(5, 7),
        displayHeightOffset: 4,
      });

      expect(plugin.isoToScreen).toHaveBeenCalledWith(iso);
      expect(result.x).toBeCloseTo(15);
      expect(result.y).toBeCloseTo(19);
    });

    it('devuelve el vector proyectado cuando no recibe opciones', () => {
      const iso = new Phaser.Math.Vector3(1, 1, 0);
      const plugin = {
        isoToScreen: vi.fn(() => new Phaser.Math.Vector2(8, 12)),
      } as unknown as IsometricPlugin;

      const result = isoToScreenPoint(iso, plugin);

      expect(result.x).toBe(8);
      expect(result.y).toBe(12);
    });
  });

  describe('screenToIsoPoint', () => {
    it('suma el offset antes de delegar en el plugin', () => {
      const plugin = {
        screenToIso: vi.fn((vector: InstanceType<typeof Phaser.Math.Vector2>) => {
          expect(vector.x).toBeCloseTo(11);
          expect(vector.y).toBeCloseTo(16);
          return new Phaser.Math.Vector3(vector.x, vector.y, 0);
        }),
      } as unknown as IsometricPlugin;

      const screen = new Phaser.Math.Vector2(6, 9);
      const result = screenToIsoPoint(screen, plugin, {
        offset: new Phaser.Math.Vector2(5, 7),
      });

      expect(result.x).toBeCloseTo(11);
      expect(result.y).toBeCloseTo(16);
    });
  });

  describe('clampIsoToBounds', () => {
    it('limita las coordenadas según los límites', () => {
      const iso = new Phaser.Math.Vector3(-2, 9, 0);

      const result = clampIsoToBounds(iso, 5, 5);

      expect(result).toBe(iso);
      expect(result.x).toBe(0);
      expect(result.y).toBe(4);
    });
  });
});
