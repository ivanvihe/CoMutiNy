import Phaser from 'phaser';
import gameState from '../../game/state/index.js';
import MapManager from '../managers/MapManager.js';
import Player from '../entities/Player.js';

const DEFAULT_TILE_SIZE = 64;
const DEFAULT_CHARACTER_TEXTURE = 'astronaut/classic';
const MOVEMENT_SPEED = 180;
const DEFAULT_BACKGROUND = '#10131a';
const BROADCAST_INTERVAL_MS = 120;
const POSITION_EPSILON = 0.01;
const REMOTE_HIGHLIGHT_DURATION = 240;

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

const isValidString = (value) => typeof value === 'string' && value.trim().length > 0;

const sanitizePlayerSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const id = isValidString(snapshot.id) ? snapshot.id.trim() : null;
  if (!id) {
    return null;
  }

  const position = snapshot.position && typeof snapshot.position === 'object'
    ? {
        x: Number(snapshot.position.x) || 0,
        y: Number(snapshot.position.y) || 0,
        z: Number(snapshot.position.z) || 0
      }
    : { x: 0, y: 0, z: 0 };

  const direction = isValidString(snapshot.direction) ? snapshot.direction : 'down';
  const animation = isValidString(snapshot.animation) ? snapshot.animation : 'idle';

  return {
    ...snapshot,
    id,
    position,
    direction,
    animation
  };
};

const toPixelPosition = (position, tileSize) => {
  const baseX = Number(position?.x) || 0;
  const baseY = Number(position?.y) || 0;
  return {
    x: (baseX + 0.5) * tileSize,
    y: (baseY + 0.5) * tileSize
  };
};

const toTilePosition = (x, y, tileSize) => {
  const safeTileSize = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : DEFAULT_TILE_SIZE;
  return {
    x: x / safeTileSize - 0.5,
    y: y / safeTileSize - 0.5,
    z: 0
  };
};

const resolveTextureEntryForSnapshot = (textures, snapshot) => {
  if (!(textures instanceof Map)) {
    return null;
  }

  const spriteId = [
    snapshot?.sprite,
    snapshot?.avatar?.sprite,
    snapshot?.metadata?.avatar?.sprite
  ].find(isValidString);

  if (spriteId && textures.has(spriteId)) {
    return textures.get(spriteId);
  }

  return null;
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

    this.remotePlayersGroup = null;
    this.remotePlayers = new Map();
    this.remotePlayerSnapshots = new Map();
    this.pendingObjectEvents = new Map();
    this.interactiveObjectLookup = new Map();
    this.interactiveObjectListeners = new Map();

    this.socket = null;
    this.socketHandlers = new Map();
    this.localPlayerId = null;
    this.profile = null;
    this.lastBroadcastState = { x: null, y: null, animation: null, direction: null };
    this.lastBroadcastTime = 0;
    this.playerDirection = 'down';
    this.initialCurrentMap = null;
  }

  init(data) {
    this.initialCurrentMap = data?.currentMap ?? null;
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
    if (data?.socket) {
      this.socket = data.socket;
    }
    if (this.initialCurrentMap && typeof this.initialCurrentMap === 'object') {
      gameState.registerMap(this.initialCurrentMap);
      gameState.handleMapChange({ definition: this.initialCurrentMap }).catch(() => {});
    }
    if (isValidString(data?.localPlayerId)) {
      this.localPlayerId = data.localPlayerId.trim();
    }
    if (data?.profile && typeof data.profile === 'object') {
      this.profile = { ...data.profile };
    }
    if (Array.isArray(data?.players)) {
      this.handlePlayersSnapshotChanged(this.registry, data.players);
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

    this.remotePlayersGroup = this.add.group();
    this.keyboard = createKeyboardConfig(this);

    this.registerRegistryListeners();
    this.refreshFromRegistry();

    this.unsubscribe = gameState.subscribe((snapshot) => {
      this.loadMap(snapshot?.map ?? null);
    });

    if (this.initialCurrentMap) {
      this.loadMap(this.initialCurrentMap);
      this.initialCurrentMap = null;
    }

    this.events.once('shutdown', () => {
      this.playerColliders.forEach((collider) => collider?.destroy());
      this.playerColliders = [];

      this.unregisterRegistryListeners();
      this.detachSocket();
      this.destroyRemotePlayers();
      this.remotePlayerSnapshots.clear();
      this.pendingObjectEvents.clear();
      this.clearInteractiveObjectListeners();

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

  registerRegistryListeners() {
    if (!this.registry?.events) {
      return;
    }
    this.registry.events.on('changedata-network:socket', this.handleRegistrySocket, this);
    this.registry.events.on('changedata-player:localId', this.handleLocalIdChanged, this);
    this.registry.events.on('changedata-player:profile', this.handleProfileChanged, this);
    this.registry.events.on('changedata-world:players', this.handlePlayersSnapshotChanged, this);
  }

  unregisterRegistryListeners() {
    if (!this.registry?.events) {
      return;
    }
    this.registry.events.off('changedata-network:socket', this.handleRegistrySocket, this);
    this.registry.events.off('changedata-player:localId', this.handleLocalIdChanged, this);
    this.registry.events.off('changedata-player:profile', this.handleProfileChanged, this);
    this.registry.events.off('changedata-world:players', this.handlePlayersSnapshotChanged, this);
  }

  refreshFromRegistry() {
    if (!this.registry) {
      return;
    }
    this.handleLocalIdChanged(this.registry, this.registry.get('player:localId'));
    this.handleProfileChanged(this.registry, this.registry.get('player:profile'));
    this.handlePlayersSnapshotChanged(this.registry, this.registry.get('world:players'));
    this.handleRegistrySocket(this.registry, this.registry.get('network:socket'));
  }

  handleRegistrySocket(_, value) {
    if (value === this.socket) {
      return;
    }
    this.attachSocket(value);
  }

  handleLocalIdChanged(_, value) {
    if (isValidString(value)) {
      this.localPlayerId = value.trim();
      this.remotePlayerSnapshots.delete(this.localPlayerId);
      this.removeRemotePlayer(this.localPlayerId);
    } else {
      this.localPlayerId = null;
    }
  }

  handleProfileChanged(_, value) {
    if (value && typeof value === 'object') {
      this.profile = { ...value };
    } else {
      this.profile = null;
    }
  }

  handlePlayersSnapshotChanged(_, players) {
    if (!Array.isArray(players)) {
      return;
    }

    const activeIds = new Set();
    players.forEach((entry) => {
      const snapshot = sanitizePlayerSnapshot(entry);
      if (!snapshot || snapshot.id === this.localPlayerId) {
        return;
      }
      activeIds.add(snapshot.id);
      this.remotePlayerSnapshots.set(snapshot.id, snapshot);
    });

    Array.from(this.remotePlayerSnapshots.keys()).forEach((id) => {
      if (!activeIds.has(id)) {
        this.remotePlayerSnapshots.delete(id);
        this.removeRemotePlayer(id);
      }
    });

    this.syncRemotePlayers();
  }

  attachSocket(socket) {
    if (!socket || typeof socket.on !== 'function') {
      this.detachSocket();
      return;
    }

    if (this.socket === socket) {
      return;
    }

    this.detachSocket();
    this.socket = socket;

    const onWorldState = (snapshot) => this.handleWorldState(snapshot);
    const onPlayerJoined = (payload) => this.handlePlayerSnapshot(payload);
    const onPlayerUpdated = (payload) => this.handlePlayerSnapshot(payload);
    const onPlayerMoved = (payload) => this.handlePlayerSnapshot(payload);
    const onPlayerLeft = (payload) => this.handlePlayerLeft(payload);
    const onObjectEvent = (payload) => this.handleObjectEvent(payload);

    socket.on('world:state', onWorldState);
    socket.on('player:joined', onPlayerJoined);
    socket.on('player:updated', onPlayerUpdated);
    socket.on('player:moved', onPlayerMoved);
    socket.on('player:left', onPlayerLeft);
    socket.on('object:event', onObjectEvent);
    socket.on('object:interacted', onObjectEvent);

    this.socketHandlers.set('world:state', onWorldState);
    this.socketHandlers.set('player:joined', onPlayerJoined);
    this.socketHandlers.set('player:updated', onPlayerUpdated);
    this.socketHandlers.set('player:moved', onPlayerMoved);
    this.socketHandlers.set('player:left', onPlayerLeft);
    this.socketHandlers.set('object:event', onObjectEvent);
    this.socketHandlers.set('object:interacted', onObjectEvent);
  }

  detachSocket() {
    if (!this.socket) {
      this.socketHandlers.clear();
      return;
    }

    this.socketHandlers.forEach((handler, event) => {
      this.socket.off(event, handler);
    });

    this.socketHandlers.clear();
    this.socket = null;
  }

  handleWorldState(snapshot) {
    const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
    this.handlePlayersSnapshotChanged(this.registry, players);
  }

  handlePlayerSnapshot(payload) {
    const snapshot = sanitizePlayerSnapshot(payload);
    if (!snapshot || snapshot.id === this.localPlayerId) {
      return;
    }
    this.remotePlayerSnapshots.set(snapshot.id, snapshot);
    this.updateRemotePlayer(snapshot.id, snapshot);
  }

  handlePlayerLeft(payload) {
    const id = isValidString(payload?.id) ? payload.id.trim() : null;
    if (!id || id === this.localPlayerId) {
      return;
    }
    this.remotePlayerSnapshots.delete(id);
    this.removeRemotePlayer(id);
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

    this.indexInteractiveObjects();
    this.syncRemotePlayers();
    this.flushPendingObjectEvents();
    this.broadcastImmediateState();
  }

  resetScene() {
    this.playerColliders.forEach((collider) => collider?.destroy());
    this.playerColliders = [];

    this.clearInteractiveObjectListeners();
    this.destroyRemotePlayers();

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

  resolvePlayerTextureForSnapshot(snapshot) {
    return resolveTextureEntryForSnapshot(this.characterTextures, snapshot) ?? this.resolveCharacterTexture();
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
    this.player.setDepth(this.resolvePlayerDepth());
    this.playerDirection = 'down';
    this.player.setData('direction', this.playerDirection);
    this.player.setData('animation', 'idle');

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
  }

  spawnRemotePlayer(snapshot) {
    const textureEntry = this.resolvePlayerTextureForSnapshot(snapshot);
    const { x, y } = toPixelPosition(snapshot.position, this.tileSize);

    const avatarOptions = textureEntry
      ? { key: textureEntry.key, width: textureEntry.width, height: textureEntry.height }
      : {};

    const remote = new Player(this, x, y, {
      tileSize: this.tileSize,
      avatar: avatarOptions,
      name: snapshot.name ?? snapshot.alias ?? 'Jugador',
      collideWorldBounds: false
    });

    remote.setDepth(this.resolvePlayerDepth());
    remote.setData('playerId', snapshot.id);
    remote.setData('direction', snapshot.direction);
    remote.setData('animation', snapshot.animation);

    const body = /** @type {Phaser.Physics.Arcade.Body | null} */ (remote.body ?? null);
    if (body) {
      body.setAllowGravity(false);
      body.setImmovable(true);
      body.moves = false;
      body.setVelocity(0, 0);
      body.setCollideWorldBounds(false);
    }

    this.updateSpriteDirection(remote, snapshot.direction);
    this.remotePlayersGroup.add(remote);
    this.remotePlayers.set(snapshot.id, remote);
    return remote;
  }

  updateRemotePlayer(id, snapshot) {
    const normalised = sanitizePlayerSnapshot(snapshot);
    if (!normalised) {
      return;
    }

    if (normalised.id === this.localPlayerId) {
      return;
    }

    this.remotePlayerSnapshots.set(normalised.id, normalised);

    const existing = this.remotePlayers.get(normalised.id) ?? this.spawnRemotePlayer(normalised);
    const { x, y } = toPixelPosition(normalised.position, this.tileSize);
    existing.setPosition(x, y);
    existing.setData('animation', normalised.animation);
    this.updateSpriteDirection(existing, normalised.direction);
  }

  syncRemotePlayers() {
    if (!this.currentMap) {
      return;
    }

    this.remotePlayerSnapshots.forEach((snapshot, id) => {
      this.updateRemotePlayer(id, snapshot);
    });

    Array.from(this.remotePlayers.keys()).forEach((id) => {
      if (!this.remotePlayerSnapshots.has(id)) {
        this.removeRemotePlayer(id);
      }
    });
  }

  removeRemotePlayer(id) {
    const remote = this.remotePlayers.get(id);
    if (!remote) {
      return;
    }
    this.remotePlayers.delete(id);
    this.remotePlayersGroup.remove(remote, false);
    remote.destroy();
  }

  destroyRemotePlayers() {
    this.remotePlayers.forEach((remote) => {
      if (remote && typeof remote.destroy === 'function') {
        remote.destroy();
      }
    });
    this.remotePlayers.clear();
    this.remotePlayersGroup?.clear(false, false);
  }

  updateSpriteDirection(sprite, direction) {
    if (!sprite || typeof sprite.setFlipX !== 'function') {
      return;
    }

    const normalised = typeof direction === 'string' ? direction : 'down';
    if (normalised === 'left') {
      sprite.setFlipX(true);
    } else if (normalised === 'right') {
      sprite.setFlipX(false);
    }

    sprite.setData('direction', normalised);
  }

  resolvePlayerDepth() {
    const order = Number.isFinite(this.currentMap?.playerLayerOrder)
      ? this.currentMap.playerLayerOrder
      : null;
    return order ?? 1000;
  }

  indexInteractiveObjects() {
    this.clearInteractiveObjectListeners();

    const objects = this.mapManager?.interactiveObjects?.getChildren?.() ?? [];
    objects.forEach((object) => {
      if (!object || typeof object.on !== 'function') {
        return;
      }

      const handler = (payload) => this.handleLocalObjectInteraction(payload, object);
      object.on('behaviour', handler);
      this.interactiveObjectListeners.set(object, handler);

      const identifiers = [object.objectId, object.definitionId];
      if (typeof object.getData === 'function') {
        identifiers.push(object.getData('objectId'));
        identifiers.push(object.getData('definitionId'));
      }

      identifiers
        .filter(isValidString)
        .forEach((id) => this.interactiveObjectLookup.set(id.trim(), object));

      if (typeof object.once === 'function') {
        object.once('destroy', () => {
          this.interactiveObjectListeners.delete(object);
          Array.from(this.interactiveObjectLookup.entries()).forEach(([key, value]) => {
            if (value === object) {
              this.interactiveObjectLookup.delete(key);
            }
          });
        });
      }
    });
  }

  clearInteractiveObjectListeners() {
    this.interactiveObjectListeners.forEach((handler, object) => {
      if (object && typeof object.off === 'function') {
        object.off('behaviour', handler);
      }
    });
    this.interactiveObjectListeners.clear();
    this.interactiveObjectLookup.clear();
  }

  handleLocalObjectInteraction(payload, object) {
    this.emitObjectInteraction(payload, object);
  }

  emitObjectInteraction(payload = {}, object = null) {
    if (!this.socket || this.socket.disconnected) {
      return;
    }

    const objectId = isValidString(payload?.objectId)
      ? payload.objectId.trim()
      : isValidString(object?.objectId)
        ? object.objectId.trim()
        : typeof object?.getData === 'function' && isValidString(object.getData('objectId'))
          ? object.getData('objectId').trim()
          : null;

    if (!objectId) {
      return;
    }

    const action = isValidString(payload?.action)
      ? payload.action.trim()
      : isValidString(payload?.metadata?.action)
        ? payload.metadata.action.trim()
        : 'interact';

    const mapId = isValidString(payload?.mapId)
      ? payload.mapId.trim()
      : isValidString(this.currentMap?.id)
        ? this.currentMap.id.trim()
        : null;

    const request = {
      objectId,
      action,
      ...(mapId ? { mapId } : {})
    };

    this.socket.emit('object:interact', request);
  }

  handleObjectEvent(event) {
    if (!event || typeof event !== 'object') {
      return;
    }

    if (!this.applyObjectEvent(event)) {
      const objectId = isValidString(event?.objectId)
        ? event.objectId.trim()
        : isValidString(event?.metadata?.objectId)
          ? event.metadata.objectId.trim()
          : null;

      if (!objectId) {
        return;
      }

      if (!this.pendingObjectEvents.has(objectId)) {
        this.pendingObjectEvents.set(objectId, []);
      }
      this.pendingObjectEvents.get(objectId).push(event);
    }
  }

  applyObjectEvent(event) {
    const objectId = isValidString(event?.objectId)
      ? event.objectId.trim()
      : isValidString(event?.metadata?.objectId)
        ? event.metadata.objectId.trim()
        : null;

    if (!objectId) {
      return false;
    }

    const object = this.interactiveObjectLookup.get(objectId);
    if (!object) {
      return false;
    }

    if (typeof object.setData === 'function') {
      object.setData('lastEvent', event);
    }

    this.highlightInteractiveObject(object);
    if (typeof object.emit === 'function') {
      object.emit('remote:interaction', event, object);
    }

    return true;
  }

  highlightInteractiveObject(object) {
    if (!object || typeof object.setTint !== 'function' || typeof object.clearTint !== 'function') {
      return;
    }

    object.setTint(0xffd54f);
    this.time.delayedCall(REMOTE_HIGHLIGHT_DURATION, () => {
      if (object.active) {
        object.clearTint();
      }
    });
  }

  flushPendingObjectEvents() {
    this.pendingObjectEvents.forEach((events, objectId) => {
      const remaining = events.filter((event) => !this.applyObjectEvent(event));
      if (remaining.length === 0) {
        this.pendingObjectEvents.delete(objectId);
      } else {
        this.pendingObjectEvents.set(objectId, remaining);
      }
    });
  }

  broadcastPlayerState({ force = false } = {}) {
    if (!this.player || !this.socket || this.socket.disconnected) {
      return;
    }

    const now = this.time.now;
    if (!force && now - this.lastBroadcastTime < BROADCAST_INTERVAL_MS) {
      return;
    }

    const position = toTilePosition(this.player.x, this.player.y, this.tileSize);
    const animation = this.player.getData('animation') ?? 'idle';
    const direction = this.player.getData('direction') ?? this.playerDirection ?? 'down';

    const last = this.lastBroadcastState;
    const changed =
      force ||
      !last ||
      Math.abs(position.x - (last.x ?? 0)) > POSITION_EPSILON ||
      Math.abs(position.y - (last.y ?? 0)) > POSITION_EPSILON ||
      animation !== last.animation ||
      direction !== last.direction;

    if (!changed) {
      return;
    }

    const metadata = {};
    const alias = isValidString(this.profile?.alias) ? this.profile.alias.trim() : null;
    if (alias) {
      metadata.alias = alias;
    }
    if (this.profile?.avatar && typeof this.profile.avatar === 'object') {
      metadata.avatar = { ...this.profile.avatar };
    }

    const payload = {
      position,
      animation,
      direction,
      ...(alias ? { alias } : {}),
      ...(Object.keys(metadata).length ? { metadata } : {})
    };

    if (isValidString(this.profile?.sprite)) {
      payload.sprite = this.profile.sprite.trim();
    }
    if (isValidString(this.profile?.name)) {
      payload.name = this.profile.name.trim();
    }

    this.socket.emit('player:update', payload);
    this.lastBroadcastState = { ...position, animation, direction };
    this.lastBroadcastTime = now;
  }

  broadcastImmediateState() {
    this.lastBroadcastState = { x: null, y: null, animation: null, direction: null };
    this.lastBroadcastTime = 0;
    this.broadcastPlayerState({ force: true });
  }

  updateLocalAnimationState(moving, directionVector) {
    if (!this.player) {
      return;
    }

    const animation = moving ? 'walk' : 'idle';
    if (this.player.getData('animation') !== animation) {
      this.player.setData('animation', animation);
    }

    if (moving) {
      let direction = this.playerDirection;
      const absX = Math.abs(directionVector.x);
      const absY = Math.abs(directionVector.y);

      if (absX >= absY) {
        direction = directionVector.x >= 0 ? 'right' : 'left';
      } else if (absY > 0) {
        direction = directionVector.y >= 0 ? 'down' : 'up';
      }

      this.playerDirection = direction;
      this.updateSpriteDirection(this.player, direction);
    } else if (!this.player.getData('direction')) {
      this.player.setData('direction', this.playerDirection);
    }
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

    const movementVector = velocity.clone();
    const speed = Number.isFinite(this.player.speed) ? this.player.speed : this.speed;

    if (movementVector.lengthSq() > 0) {
      velocity.normalize().scale(speed);
      body.setVelocity(velocity.x, velocity.y);
    } else {
      body.setVelocity(0, 0);
    }

    this.updateLocalAnimationState(movementVector.lengthSq() > 0, movementVector);
    this.broadcastPlayerState();
  }
}
