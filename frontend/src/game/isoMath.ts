import Phaser from 'phaser';
import IsometricPlugin from './plugins/IsometricPlugin';
import type { IsoPointLike } from './plugins/IsometricPlugin';

export interface IsoToScreenOptions {
  offset?: Phaser.Math.Vector2;
  displayHeightOffset?: number;
}

export interface ScreenToIsoOptions {
  offset?: Phaser.Math.Vector2;
}

export const isoToScreenPoint = (
  iso: IsoPointLike | Phaser.Math.Vector3,
  isoPlugin: IsometricPlugin,
  options: IsoToScreenOptions = {}
): Phaser.Math.Vector2 => {
  const { offset, displayHeightOffset = 0 } = options;
  const screen = isoPlugin.isoToScreen(iso);
  if (offset) {
    screen.subtract(offset);
  }
  if (displayHeightOffset !== 0) {
    screen.y -= displayHeightOffset;
  }
  return screen;
};

export const screenToIsoPoint = (
  screen: Phaser.Math.Vector2 | Phaser.Math.Vector3,
  isoPlugin: IsometricPlugin,
  options: ScreenToIsoOptions = {}
): Phaser.Math.Vector3 => {
  const { offset } = options;
  const point = new Phaser.Math.Vector2(screen.x, screen.y);
  if (offset) {
    point.add(offset);
  }
  return isoPlugin.screenToIso(point);
};

export const clampIsoToBounds = (
  iso: Phaser.Math.Vector3,
  width: number,
  height: number
): Phaser.Math.Vector3 => {
  iso.x = Phaser.Math.Clamp(iso.x, 0, width - 1);
  iso.y = Phaser.Math.Clamp(iso.y, 0, height - 1);
  return iso;
};
