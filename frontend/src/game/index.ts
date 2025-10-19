export { default as GameScene } from './GameScene';
export { createGameConfig } from './config';
export { default as IsometricPlugin } from './plugins/IsometricPlugin';
export type { IsoPointLike } from './plugins/IsometricPlugin';
export { isoToScreenPoint, screenToIsoPoint, clampIsoToBounds } from './isoMath';
export { TILESET_PLACEHOLDERS } from './tilesets';
export {
  createCharacterTexture,
  type CharacterAppearanceConfig,
  type CharacterFactoryOptions,
} from './rendering/CharacterFactory';
export { ObjectFactory, type DiamondTextureConfig } from './rendering/ObjectFactory';
export { darken, lighten } from './rendering/colors';
