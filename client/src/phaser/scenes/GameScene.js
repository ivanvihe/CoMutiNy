import Phaser from 'phaser';
import gameState from '../../game/state/index.js';
import MapManager from '../managers/MapManager.js';
import Player from '../entities/Player.js';

const DEFAULT_TILE_SIZE = 64;
const DEFAULT_CHARACTER_TEXTURE = 'astronaut/classic';
const MOVEMENT_SPEED = 180;
const DEFAULT_BACKGROUND = '#10131a';

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
    this.mapManager = null;
    this.player = null;
    this.keyboard = null;
    this.speed = MOVEMENT_SPEED;
    this.playerColliders = [];
    this.collidableTiles = null;
    this.solidObjects = null;
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
    this.cameras.main.setBackgroundColor(DEFAULT_BACKGROUND);
    this.cameras.main.setZoom(1);

    this.layersContainer = this.add.layer();
    this.objectsContainer = this.add.layer();

    this.mapManager = new MapManager(this, {
      tileSize: this.tileSize,
      tileTextures: this.tileTextures,
      objectSprites: this.objectSprites,
      containers: {
        tileLayers: this.layersContainer,
        objects: this.objectsContainer
      }
    });

    this.collidableTiles = this.mapManager.collidableTiles;
    this.solidObjects = this.mapManager.solidObjects;

    this.keyboard = createKeyboardConfig(this);

    this.unsubscribe = gameState.subscribe((snapshot) => {
      this.loadMap(snapshot?.map ?? null);
    });

    this.events.once('shutdown', () => {
      this.playerColliders.forEach((collider) => collider?.destroy());
      this.playerColliders = [];

      if (typeof this.unsubscribe === 'function') {
        this.unsubscribe();
        this.unsubscribe = null;
      }

      if (this.mapManager) {
        this.mapManager.destroy();
        this.mapManager = null;
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

    if (this.mapManager) {
      this.mapManager.tileSize = this.tileSize;
      this.mapManager.setResources({
        tileTextures: this.tileTextures,
        objectSprites: this.objectSprites
      });
    }

    const result = this.mapManager?.load(map) ?? null;
    const pixelWidth = result?.pixelWidth ?? this.tileSize;
    const pixelHeight = result?.pixelHeight ?? this.tileSize;

    this.collidableTiles = result?.collidableTiles ?? this.mapManager?.collidableTiles ?? null;
    this.solidObjects = result?.solidObjects ?? this.mapManager?.solidObjects ?? null;

    this.physics.world.setBounds(0, 0, pixelWidth, pixelHeight);
    this.cameras.main.setBounds(0, 0, pixelWidth, pixelHeight);

    if (map?.theme?.borderColour) {
      this.cameras.main.setBackgroundColor(map.theme.borderColour);
    } else {
      this.cameras.main.setBackgroundColor(DEFAULT_BACKGROUND);
    }

    this.spawnPlayer(map);

    this.attachPlayerColliders([
      result?.collidableTiles ?? this.collidableTiles,
      result?.solidObjects ?? this.solidObjects
    ]);
  }

  resetScene() {
    this.playerColliders.forEach((collider) => collider?.destroy());
    this.playerColliders = [];

    if (this.mapManager) {
      this.mapManager.clear();
    }

    if (this.player) {
      this.cameras.main.stopFollow();
      this.player.destroy();
      this.player = null;
    }
  }

  attachPlayerColliders(groups = []) {
    if (!this.player) {
      return;
    }
    const list = Array.isArray(groups) ? groups : [groups];
    list.forEach((group) => {
      if (!group || typeof group !== 'object') {
        return;
      }
      const children = typeof group.getChildren === 'function' ? group.getChildren() : null;
      if (Array.isArray(children) && children.length === 0) {
        return;
      }
      const collider = this.physics.add.collider(this.player, group);
      this.playerColliders.push(collider);
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

    const x = (spawn.x + 0.5) * this.tileSize;
    const y = (spawn.y + 0.5) * this.tileSize;

    const avatarOptions = textureEntry
      ? { key: textureEntry.key, width: textureEntry.width, height: textureEntry.height }
      : {};

    this.player = new Player(this, x, y, {
      tileSize: this.tileSize,
      avatar: avatarOptions
    });

    this.player.setMovementSpeed(this.speed);

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
  }

  update() {
    if (!this.player || !this.player.body || !this.keyboard) {
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

    const speed = Number.isFinite(this.player.speed) ? this.player.speed : this.speed;

    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(speed);
      body.setVelocity(velocity.x, velocity.y);
    } else {
      body.setVelocity(0, 0);
    }
  }
}
