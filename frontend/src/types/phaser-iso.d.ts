import IsometricPlugin from '../game/plugins/IsometricPlugin';

declare module 'phaser' {
  interface Scene {
    iso: IsometricPlugin;
  }
}
