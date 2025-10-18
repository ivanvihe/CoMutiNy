import Phaser from 'phaser';

export interface IsoPointLike {
  x: number;
  y: number;
  z?: number;
}

interface ProjectOptions {
  displayHeightOffset?: number;
  depthOffset?: number;
  positionOffset?: Phaser.Math.Vector2;
}

export default class IsometricPlugin extends Phaser.Plugins.ScenePlugin {
  private _tileWidth: number;
  private _tileHeight: number;

  constructor(scene: Phaser.Scene, pluginManager: Phaser.Plugins.PluginManager) {
    super(scene, pluginManager, 'isometric-plugin');
    this._tileWidth = 64;
    this._tileHeight = 32;
  }

  setTileSize(width: number, height: number): this {
    this._tileWidth = width;
    this._tileHeight = height;
    return this;
  }

  get tileWidth(): number {
    return this._tileWidth;
  }

  get tileHeight(): number {
    return this._tileHeight;
  }

  isoToScreen(point: IsoPointLike | Phaser.Math.Vector3): Phaser.Math.Vector2 {
    const { x, y, z = 0 } = point;
    const halfWidth = this._tileWidth / 2;
    const halfHeight = this._tileHeight / 2;

    const screenX = (x - y) * halfWidth;
    const screenY = (x + y) * halfHeight - z * this._tileHeight;

    return new Phaser.Math.Vector2(screenX, screenY);
  }

  screenToIso(
    point: Phaser.Math.Vector2 | Phaser.Math.Vector3 | { x: number; y: number }
  ): Phaser.Math.Vector3 {
    const { x: screenX, y: screenY } = point as Phaser.Math.Vector2;
    const halfWidth = this._tileWidth / 2;
    const halfHeight = this._tileHeight / 2;

    const isoX = (screenY / halfHeight + screenX / halfWidth) / 2;
    const isoY = (screenY / halfHeight - screenX / halfWidth) / 2;

    return new Phaser.Math.Vector3(isoX, isoY, 0);
  }

  projectGameObject(
    gameObject: Phaser.GameObjects.GameObject & {
      setPosition: (x: number, y: number) => void;
      setDepth?: (value: number) => void;
    },
    isoPoint: IsoPointLike,
    options: ProjectOptions = {}
  ): void {
    const { displayHeightOffset = 0, depthOffset = 0, positionOffset } = options;
    const screenPosition = this.isoToScreen(isoPoint);
    if (positionOffset) {
      screenPosition.subtract(positionOffset);
    }
    gameObject.setPosition(screenPosition.x, screenPosition.y - displayHeightOffset);
    if (gameObject.setDepth) {
      gameObject.setDepth(screenPosition.y + depthOffset);
    }
  }
}
