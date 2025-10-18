import Phaser from 'phaser';
import AvatarGenerator from '../../game/graphics/generators/AvatarGenerator.js';

const DEFAULT_TILE_SIZE = 64;

const sanitizeNumber = (value, fallback) => (Number.isFinite(value) ? value : fallback);

const resolveGenerator = (provided) => {
  if (provided instanceof AvatarGenerator) {
    return provided;
  }
  if (provided && typeof provided === 'object' && typeof provided.generateAvatar === 'function') {
    return provided;
  }
  if (!resolveGenerator.shared) {
    resolveGenerator.shared = new AvatarGenerator();
  }
  return resolveGenerator.shared;
};

const ensureTexture = (scene, generator, options = {}) => {
  const {
    width = generator.defaultWidth,
    height = generator.defaultHeight,
    skinColor,
    hairColor,
    eyeColor,
    shirtColor,
    hasSmile,
    key
  } = options;

  const generationOptions = {
    width,
    height,
    ...(skinColor ? { skinColor } : {}),
    ...(hairColor ? { hairColor } : {}),
    ...(eyeColor ? { eyeColor } : {}),
    ...(shirtColor ? { shirtColor } : {}),
    ...(hasSmile !== undefined ? { hasSmile } : {})
  };

  const cacheKey = generator.buildCacheKey('avatar', generationOptions);
  const textureKey = key ?? `avatar/${cacheKey}`;

  if (!scene.textures.exists(textureKey)) {
    const canvas = generator.generateAvatar(generationOptions);
    scene.textures.addCanvas(textureKey, canvas);
  }

  return { key: textureKey, options: generationOptions };
};

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, {
    tileSize = DEFAULT_TILE_SIZE,
    generator = null,
    avatar = {},
    name = 'player',
    collideWorldBounds = true
  } = {}) {
    const avatarGenerator = resolveGenerator(generator);
    const textureEntry = ensureTexture(scene, avatarGenerator, avatar ?? {});

    super(scene, sanitizeNumber(x, 0), sanitizeNumber(y, 0), textureEntry.key);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setName(name);
    this.setDataEnabled();
    this.setData('avatarOptions', textureEntry.options);

    if (collideWorldBounds && this.body && this.body instanceof Phaser.Physics.Arcade.Body) {
      this.body.setCollideWorldBounds(true);
    }

    const baseHeight = sanitizeNumber(textureEntry.options.height, avatarGenerator.defaultHeight);
    const scaleFactor = baseHeight > 0 ? (tileSize * 1.2) / baseHeight : 1;
    this.setScale(scaleFactor);
    this.setOrigin(0.5, 0.85);

    this.tileSize = tileSize;
    this.speed = 180;
  }

  setMovementSpeed(value) {
    this.speed = Number.isFinite(value) ? value : this.speed;
  }
}
