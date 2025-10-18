import Phaser from 'phaser';
import GameScene from './GameScene';
import IsometricPlugin from './plugins/IsometricPlugin';

export const createGameConfig = (): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#050b16',
  pixelArt: true,
  render: {
    antialias: false,
  },
  plugins: {
    scene: [
      {
        key: 'IsometricPlugin',
        plugin: IsometricPlugin,
        mapping: 'iso',
      },
    ],
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});
