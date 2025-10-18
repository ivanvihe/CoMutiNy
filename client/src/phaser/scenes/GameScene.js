import Phaser from 'phaser';
import gameState from '../../game/state/index.js';

const DEFAULT_TILE_SIZE = 64;
const TILE_TEXTURE_PREFIX = 'tile/';
const DEFAULT_CHARACTER_TEXTURE = 'astronaut/classic';
const MOVEMENT_SPEED = 180;

const toArray = (value) => (Array.isArray(value) ? value : []);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normaliseOffset = (offset, fallback = { x: 0, y: 0, z: 0 }) => {
  if (Array.isArray(offset)) {
    const [x = 0, y = 0, z = 0] = offset;
    return { x, y, z };
  }
  if (!offset || typeof offset !== 'object') {
    return { ...fallback };
  }
  return {
    x: Number.isFinite(offset.x) ? offset.x : fallback.x,
    y: Number.isFinite(offset.y) ? offset.y : fallback.y,
    z: Number.isFinite(offset.z) ? offset.z : fallback.z
  };
};

const normaliseScale = (scale, fallback = { x: 1, y: 1 }) => {
  if (typeof scale === 'number' && Number.isFinite(scale)) {
    return { x: scale, y: scale };
  }
  if (!scale || typeof scale !== 'object') {
    return { ...fallback };
  }
  return {
    x: Number.isFinite(scale.x) ? scale.x : fallback.x,
    y: Number.isFinite(scale.y) ? scale.y : fallback.y
  };
};

const sortLayers = (layers = []) =>
  [...layers].sort((a, b) => {
    const aOrder = Number.isFinite(a?.order) ? a.order : 0;
    const bOrder = Number.isFinite(b?.order) ? b.order : 0;
    if (aOrder === bOrder) {
      return (a?.id ?? '').localeCompare(b?.id ?? '');
    }
    return aOrder - bOrder;
  });

const collectObjects = (map) => {
  const standalone = toArray(map?.objects);
  const layered = toArray(map?.objectLayers)
    .filter((layer) => layer && layer.visible !== false)
    .flatMap((layer) => toArray(layer.objects));
  const merged = [...standalone];
  layered.forEach((object) => {
    if (!object || !object.id) {
      return;
    }
    merged.push(object);
  });
  return merged;
};

const resolveObjectTextureId = (object) => {
  if (!object) {
    return null;
  }
  if (object.objectId) {
    return object.objectId;
  }
  if (object.definitionId) {
    return object.definitionId;
  }
  return object.id ?? null;
};

const resolveTileType = (map, tileId) => {
  if (!map || !tileId) {
    return null;
  }
  const lookup = map.tileTypes ?? {};
  return lookup[tileId] ?? null;
};

const createKeyboardConfig = (scene) => {
  const cursors = scene.input.keyboard.createCursorKeys();
  const wasd = scene.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D
  });
  return { cursors, wasd };
};

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.tileSize = DEFAULT_TILE_SIZE;
    this.tileTextures = new Map();
    this.objectSprites = new Map();
    this.characterTextures = new Map();
    this.unsubscribe = null;
    this.currentMap = null;
    this.layersContainer = null;
    this.objectsContainer = null;
    this.collidableTiles = null;
    this.solidObjects = null;
    this.player = null;
    this.keyboard = null;
    this.speed = MOVEMENT_SPEED;
  }

  init(data) {
    if (data?.tileSize) {
      this.tileSize = data.tileSize;
    }
    if (data?.tileTextures instanceof Map) {
      this.tileTextures = data.tileTextures;
    }
    if (data?.objectSprites instanceof Map) {
      this.objectSprites = data.objectSprites;
    }
    if (data?.characterTextures instanceof Map) {
      this.characterTextures = data.characterTextures;
    }
  }

  create() {
    this.physics.world.setBounds(0, 0, this.tileSize, this.tileSize);
    this.cameras.main.setBackgroundColor('#10131a');
    this.cameras.main.setZoom(1);

    this.layersContainer = this.add.layer();
    this.objectsContainer = this.add.layer();
    this.collidableTiles = this.physics.add.staticGroup();
    this.solidObjects = this.physics.add.staticGroup();

    this.keyboard = createKeyboardConfig(this);

    this.unsubscribe = gameState.subscribe((snapshot) => {
      this.loadMap(snapshot?.map ?? null);
    });

    this.events.once('shutdown', () => {
      if (typeof this.unsubscribe === 'function') {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    });
  }

  loadMap(map) {
    if (!map) {
      return;
    }

    if (this.currentMap && this.currentMap.id === map.id) {
      return;
    }

    this.currentMap = map;
    this.resetScene();

    const width = Math.max(1, map?.size?.width ?? 1);
    const height = Math.max(1, map?.size?.height ?? 1);
    const pixelWidth = width * this.tileSize;
    const pixelHeight = height * this.tileSize;

    this.physics.world.setBounds(0, 0, pixelWidth, pixelHeight);
    this.cameras.main.setBounds(0, 0, pixelWidth, pixelHeight);

    if (map?.theme?.borderColour) {
      this.cameras.main.setBackgroundColor(map.theme.borderColour);
    }

    this.buildTileLayers(map);
    this.buildObjects(map);
    this.spawnPlayer(map);
  }

  resetScene() {
    this.layersContainer.removeAll(true);
    this.objectsContainer.removeAll(true);
    this.collidableTiles?.clear(true, true);
    this.solidObjects?.clear(true, true);
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }

  buildTileLayers(map) {
    const layers = sortLayers(map?.layers);
    layers.forEach((layer) => {
      if (!layer || layer.visible === false) {
        return;
      }
      const layerGroup = this.add.layer();
      layer.tiles.forEach((row, y) => {
        row.forEach((tileId, x) => {
          if (!tileId) {
            return;
          }
          const tileEntry = this.tileTextures.get(tileId);
          const textureKey = tileEntry?.key ?? `${TILE_TEXTURE_PREFIX}${tileId}`;
          if (!textureKey || !this.textures.exists(textureKey)) {
            return;
          }
          const posX = x * this.tileSize + this.tileSize / 2;
          const posY = y * this.tileSize + this.tileSize / 2;
          const image = this.add.image(posX, posY, textureKey);
          image.setDisplaySize(this.tileSize, this.tileSize);
          layerGroup.add(image);

          const tileType = resolveTileType(map, tileId);
          if (tileType?.collides) {
            this.physics.add.existing(image, true);
            this.collidableTiles.add(image);
          }
        });
      });
      if (Number.isFinite(layer.opacity)) {
        layerGroup.setAlpha(clamp(layer.opacity, 0, 1));
      }
      this.layersContainer.add(layerGroup);
    });
  }

  buildObjects(map) {
    const objects = collectObjects(map);
    objects.forEach((object) => {
      const textureId = resolveObjectTextureId(object);
      if (!textureId) {
        return;
      }
      const spriteEntry = this.objectSprites.get(textureId);
      if (!spriteEntry?.key || !this.textures.exists(spriteEntry.key)) {
        return;
      }

      const size = object?.size ?? { width: 1, height: 1 };
      const offset = normaliseOffset(spriteEntry.appearance?.offset);
      const scale = normaliseScale(spriteEntry.appearance?.scale);
      const origin = spriteEntry.composite?.origin ?? { x: 0.5, y: 1 };

      const scaleFactor = this.tileSize / (spriteEntry.sprite?.tileSize ?? this.tileSize);
      const displayScaleX = scaleFactor * scale.x;
      const displayScaleY = scaleFactor * scale.y;

      const baseX = (object.position?.x ?? 0) * this.tileSize;
      const baseY = (object.position?.y ?? 0) * this.tileSize;
      const centerX = baseX + (size.width ?? 1) * this.tileSize * 0.5 + offset.x * this.tileSize;
      const bottomY = baseY + (size.height ?? 1) * this.tileSize + offset.y * this.tileSize;

      const sprite = this.add.image(centerX, bottomY, spriteEntry.key);
      sprite.setOrigin(origin.x, origin.y);
      sprite.setScale(displayScaleX, displayScaleY);
      sprite.setData('objectId', object.id);
      this.objectsContainer.add(sprite);

      if (object.solid) {
        this.physics.add.existing(sprite, true);
        this.solidObjects.add(sprite);
      }
    });
  }

  resolveCharacterTexture() {
    if (this.characterTextures.has(DEFAULT_CHARACTER_TEXTURE)) {
      return this.characterTextures.get(DEFAULT_CHARACTER_TEXTURE);
    }
    const iterator = this.characterTextures.values();
    const next = iterator.next();
    if (!next.done) {
      return next.value;
    }
    return null;
  }

  spawnPlayer(map) {
    const spawn = map?.spawn ?? { x: 0, y: 0 };
    const textureEntry = this.resolveCharacterTexture();
    const textureKey = textureEntry?.key ?? null;

    const x = (spawn.x + 0.5) * this.tileSize;
    const y = (spawn.y + 0.5) * this.tileSize;

    if (textureKey && this.textures.exists(textureKey)) {
      this.player = this.physics.add.sprite(x, y, textureKey);
      const baseHeight = textureEntry?.height ?? this.tileSize * 2;
      const scaleFactor = (this.tileSize * 1.2) / baseHeight;
      this.player.setScale(scaleFactor);
      this.player.setOrigin(0.5, 0.85);
    } else {
      this.player = this.physics.add.sprite(x, y, Phaser.Textures.Texture.DEFAULT);
      this.player.setDisplaySize(this.tileSize * 0.6, this.tileSize * 0.6);
    }

    this.player.body.setCollideWorldBounds(true);

    if (this.collidableTiles) {
      this.physics.add.collider(this.player, this.collidableTiles);
    }
    if (this.solidObjects) {
      this.physics.add.collider(this.player, this.solidObjects);
    }

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
  }

  update() {
    if (!this.player || !this.player.body) {
      return;
    }

    const body = /** @type {Phaser.Physics.Arcade.Body} */ (this.player.body);
    const velocity = new Phaser.Math.Vector2(0, 0);

    if (this.keyboard.cursors.left.isDown || this.keyboard.wasd.left.isDown) {
      velocity.x -= 1;
    }
    if (this.keyboard.cursors.right.isDown || this.keyboard.wasd.right.isDown) {
      velocity.x += 1;
    }
    if (this.keyboard.cursors.up.isDown || this.keyboard.wasd.up.isDown) {
      velocity.y -= 1;
    }
    if (this.keyboard.cursors.down.isDown || this.keyboard.wasd.down.isDown) {
      velocity.y += 1;
    }

    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(this.speed);
      body.setVelocity(velocity.x, velocity.y);
    } else {
      body.setVelocity(0, 0);
    }
  }
}
