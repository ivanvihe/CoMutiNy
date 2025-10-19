import EasyStar from 'easystarjs';
import { Client, Room } from 'colyseus.js';
import Phaser from 'phaser';
import { clampIsoToBounds, isoToScreenPoint, screenToIsoPoint } from './isoMath';
import { TILESET_PLACEHOLDERS } from './tilesets';

const TILE_WIDTH = 128;
const TILE_HEIGHT = 64;
const HALF_TILE_HEIGHT = TILE_HEIGHT / 2;
const PLAYER_HEIGHT_OFFSET = 32;
const CAMERA_SMOOTHNESS = 0.1;
const CAMERA_ZOOM = 1.4;
const CAMERA_MIN_ZOOM = 0.8;
const CAMERA_MAX_ZOOM = 2.2;
const CAMERA_ZOOM_STEP = 0.1;
const DEFAULT_MAP_SIZE = 10;
const PLAYER_SPEED = 3.2;
const GROUND_TEXTURE_KEY = 'generated-ground-tile';
const PLAYER_SPRITE_KEY = 'player-sprite';
const POSITION_SYNC_INTERVAL = 150;

interface SerializedPlayer {
  id: string;
  displayName: string;
  x: number;
  y: number;
}

interface ChunkSnapshot {
  players: SerializedPlayer[];
}

interface CharacterVisual {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  isoPosition: Phaser.Math.Vector3;
  lastDirection: Phaser.Math.Vector2;
  displayName: string;
}

export default class GameScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  private localCharacter?: CharacterVisual;

  private readonly pathfinder = new EasyStar.js();

  private movePath: Phaser.Math.Vector2[] = [];

  private currentTarget: Phaser.Math.Vector2 | null = null;

  private mapOffset = new Phaser.Math.Vector2();

  private mapSize = DEFAULT_MAP_SIZE;

  private groundLayer?: Phaser.GameObjects.Layer;

  private remotePlayers = new Map<string, CharacterVisual>();

  private client?: Client;

  private room?: Room;

  private lastSyncedPosition = new Phaser.Math.Vector2(0, 0);

  private hasSyncedPosition = false;

  private syncAccumulator = 0;

  private isCameraPanning = false;

  private lastPanPoint = new Phaser.Math.Vector2();

  private readonly onTilesetLoadError = (file: Phaser.Loader.File): void => {
    if (file.key.startsWith('tileset-')) {
      console.warn(
        `Tileset "${file.key}" could not be loaded from ${file.src}. Please download the asset manually and update the URL.`
      );
    }
  };

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.iso.setTileSize(TILE_WIDTH, TILE_HEIGHT);
    this.preloadTilesets();
    this.load.spritesheet(
      PLAYER_SPRITE_KEY,
      'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/animations/brawler48x48.png',
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    this.generateGroundTexture();
  }

  create(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard plugin is not available in this scene.');
    }
    this.cursors = keyboard.createCursorKeys();

    this.createAnimations();
    this.updateMapOffset();
    this.initializePathfindingGrid();
    this.createGroundLayer();

    const localCharacter = this.createCharacterVisual({
      displayName: 'You',
      textColor: '#ffe089',
    });
    localCharacter.isoPosition.set(2, 2, 0);
    this.localCharacter = localCharacter;
    this.projectCharacter(this.localCharacter);
    this.updateCharacterAnimation(this.localCharacter, null, false);

    this.configureCamera(this.localCharacter.sprite);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('wheel', this.handleCameraWheel, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUpGeneral, this);

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.on(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    this.connectToCommunityRoom();
  }

  update(_time: number, delta: number): void {
    if (!this.localCharacter) {
      return;
    }

    const deltaFactor = delta / (1000 / 60);
    const moveSpeed = PLAYER_SPEED * deltaFactor;

    let moved = false;
    let directionForAnimation: Phaser.Math.Vector2 | null = null;

    const isoDirection = new Phaser.Math.Vector2(0, 0);
    if (this.cursors?.left?.isDown) {
      isoDirection.x -= 1;
      isoDirection.y += 1;
    }
    if (this.cursors?.right?.isDown) {
      isoDirection.x += 1;
      isoDirection.y -= 1;
    }
    if (this.cursors?.up?.isDown) {
      isoDirection.x -= 1;
      isoDirection.y -= 1;
    }
    if (this.cursors?.down?.isDown) {
      isoDirection.x += 1;
      isoDirection.y += 1;
    }

    if (isoDirection.lengthSq() > 0) {
      isoDirection.normalize();
      this.clearPath();
      this.localCharacter.isoPosition.x += isoDirection.x * moveSpeed;
      this.localCharacter.isoPosition.y += isoDirection.y * moveSpeed;
      directionForAnimation = isoDirection;
      moved = true;
    } else if (this.currentTarget) {
      const toTarget = new Phaser.Math.Vector2(
        this.currentTarget.x - this.localCharacter.isoPosition.x,
        this.currentTarget.y - this.localCharacter.isoPosition.y
      );
      const distance = toTarget.length();

      if (distance > 0.001) {
        const direction = toTarget.clone().scale(1 / distance);
        const stepDistance = Math.min(distance, moveSpeed);
        this.localCharacter.isoPosition.x += direction.x * stepDistance;
        this.localCharacter.isoPosition.y += direction.y * stepDistance;
        directionForAnimation = direction;
        moved = true;

        if (stepDistance === distance) {
          this.advancePath();
        }
      } else {
        this.advancePath();
      }
    }

    clampIsoToBounds(this.localCharacter.isoPosition, this.mapSize);

    this.projectCharacter(this.localCharacter);
    this.updateCharacterAnimation(this.localCharacter, directionForAnimation, moved);

    this.remotePlayers.forEach((remote) => {
      this.projectCharacter(remote);
    });

    this.syncAccumulator += delta;
    if (this.syncAccumulator >= POSITION_SYNC_INTERVAL) {
      this.syncAccumulator = 0;
      this.sendPositionToServer();
    }

    this.pathfinder.calculate();
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonReleased()) {
      this.moveToPointer(pointer);
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.middleButtonDown()) {
      this.isCameraPanning = true;
      this.lastPanPoint.set(pointer.x, pointer.y);
      this.cameras.main.stopFollow();
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isCameraPanning || !pointer.middleButtonDown()) {
      return;
    }

    const camera = this.cameras.main;
    const deltaX = pointer.x - this.lastPanPoint.x;
    const deltaY = pointer.y - this.lastPanPoint.y;
    camera.scrollX -= deltaX / camera.zoom;
    camera.scrollY -= deltaY / camera.zoom;
    this.lastPanPoint.set(pointer.x, pointer.y);
  }

  private handlePointerUpGeneral(pointer: Phaser.Input.Pointer): void {
    if (!this.isCameraPanning) {
      return;
    }

    if (!pointer.middleButtonReleased()) {
      return;
    }

    this.isCameraPanning = false;
    if (this.localCharacter) {
      this.configureCameraFollow(this.localCharacter.sprite);
    }
  }

  private createPlayerSprite(): Phaser.GameObjects.Sprite {
    const sprite = this.add.sprite(0, 0, PLAYER_SPRITE_KEY);
    sprite.setOrigin(0.5, 1);
    return sprite;
  }

  private createCharacterVisual(options: {
    displayName: string;
    tint?: number;
    textColor?: string;
  }): CharacterVisual {
    const sprite = this.createPlayerSprite();
    if (typeof options.tint === 'number') {
      sprite.setTint(options.tint);
    }

    const label = this.add.text(0, 0, options.displayName, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: options.textColor ?? '#ffffff',
      align: 'center',
    });
    label.setOrigin(0.5, 1);
    label.setStroke('#000000', 4);
    label.setScrollFactor(1, 1);
    label.setShadow(0, 0, '#000000', 4, true, true);

    return {
      sprite,
      label,
      isoPosition: new Phaser.Math.Vector3(0, 0, 0),
      lastDirection: new Phaser.Math.Vector2(0, 1),
      displayName: options.displayName,
    };
  }

  private handleCameraWheel(
    _pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ): void {
    if (deltaY === 0) {
      return;
    }

    const camera = this.cameras.main;
    const direction = Math.sign(deltaY);
    const targetZoom = Phaser.Math.Clamp(
      camera.zoom - direction * CAMERA_ZOOM_STEP,
      CAMERA_MIN_ZOOM,
      CAMERA_MAX_ZOOM
    );

    camera.zoomTo(targetZoom, 150);
  }

  private configureCamera(target: Phaser.GameObjects.Sprite): void {
    const camera = this.cameras.main;
    const mapWidth = TILE_WIDTH * this.mapSize;
    const mapHeight = TILE_HEIGHT * this.mapSize;
    camera.setRoundPixels(true);
    camera.setBounds(-mapWidth, -mapHeight, mapWidth * 2, mapHeight * 2);
    camera.setBackgroundColor('#050b16');
    camera.setDeadzone(200, 150);
    camera.setLerp(CAMERA_SMOOTHNESS, CAMERA_SMOOTHNESS);
    camera.setZoom(CAMERA_ZOOM);
    this.configureCameraFollow(target);
  }

  private configureCameraFollow(target: Phaser.GameObjects.Sprite): void {
    const camera = this.cameras.main;
    camera.startFollow(target, true, CAMERA_SMOOTHNESS, CAMERA_SMOOTHNESS);
  }

  private createAnimations(): void {
    if (!this.anims.exists('player-walk')) {
      this.anims.create({
        key: 'player-walk',
        frames: this.anims.generateFrameNumbers(PLAYER_SPRITE_KEY, { frames: [0, 1, 2, 3] }),
        frameRate: 8,
        repeat: -1,
      });
    }

    if (!this.anims.exists('player-idle')) {
      this.anims.create({
        key: 'player-idle',
        frames: this.anims.generateFrameNumbers(PLAYER_SPRITE_KEY, { frames: [5, 6, 7, 8] }),
        frameRate: 4,
        repeat: -1,
      });
    }
  }

  private updateCharacterAnimation(
    character: CharacterVisual,
    direction: Phaser.Math.Vector2 | null,
    moving: boolean
  ): void {
    const sprite = character.sprite;

    if (direction && direction.lengthSq() > 0.001) {
      character.lastDirection.copy(direction).normalize();
    }

    const facingRight = character.lastDirection.x >= 0;
    sprite.setFlipX(!facingRight);

    const targetAnimation = moving ? 'player-walk' : 'player-idle';
    if (sprite.anims.currentAnim?.key !== targetAnimation) {
      sprite.anims.play(targetAnimation);
    }
  }

  private moveToPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.localCharacter) {
      return;
    }

    const camera = this.cameras.main;
    const worldPoint = pointer.positionToCamera(camera) as Phaser.Math.Vector2;
    const isoPoint = screenToIsoPoint(worldPoint, this.iso, { offset: this.mapOffset });

    const targetX = Math.round(isoPoint.x);
    const targetY = Math.round(isoPoint.y);

    if (!this.isTileWithinBounds(targetX, targetY)) {
      return;
    }

    const startX = Math.round(this.localCharacter.isoPosition.x);
    const startY = Math.round(this.localCharacter.isoPosition.y);

    this.pathfinder.findPath(startX, startY, targetX, targetY, (path) => {
      if (!path || path.length === 0) {
        return;
      }

      this.movePath = path.slice(1).map((node) => new Phaser.Math.Vector2(node.x, node.y));
      this.advancePath();
    });
    this.pathfinder.calculate();
  }

  private advancePath(): void {
    this.currentTarget = this.movePath.shift() ?? null;
  }

  private clearPath(): void {
    this.movePath = [];
    this.currentTarget = null;
  }

  private isTileWithinBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.mapSize && y < this.mapSize;
  }

  private projectCharacter(character: CharacterVisual): void {
    const screenPosition = isoToScreenPoint(character.isoPosition, this.iso, {
      offset: this.mapOffset,
      displayHeightOffset: PLAYER_HEIGHT_OFFSET,
    });

    character.sprite.setPosition(screenPosition.x, screenPosition.y);
    character.sprite.setDepth(screenPosition.y + PLAYER_HEIGHT_OFFSET);
    const labelY = screenPosition.y - character.sprite.displayHeight + PLAYER_HEIGHT_OFFSET - 8;
    character.label.setText(character.displayName);
    character.label.setPosition(screenPosition.x, labelY);
    character.label.setDepth(character.sprite.depth + 10);
  }

  private updateMapOffset(): void {
    this.mapOffset = this.iso.isoToScreen({
      x: (this.mapSize - 1) / 2,
      y: (this.mapSize - 1) / 2,
      z: 0,
    });
  }

  private initializePathfindingGrid(): void {
    const grid: number[][] = [];
    for (let y = 0; y < this.mapSize; y += 1) {
      const row: number[] = [];
      for (let x = 0; x < this.mapSize; x += 1) {
        row.push(0);
      }
      grid.push(row);
    }

    this.pathfinder.setGrid(grid);
    this.pathfinder.setAcceptableTiles([0]);
    this.pathfinder.enableSync();
  }

  private createGroundLayer(): void {
    this.groundLayer?.destroy(true);
    this.groundLayer = this.add.layer();

    for (let x = 0; x < this.mapSize; x += 1) {
      for (let y = 0; y < this.mapSize; y += 1) {
        const screenPosition = isoToScreenPoint({ x, y, z: 0 }, this.iso, {
          offset: this.mapOffset,
        });
        const tile = this.add.image(screenPosition.x, screenPosition.y, GROUND_TEXTURE_KEY);
        tile.setOrigin(0.5, 0.5);
        tile.setDepth(screenPosition.y - HALF_TILE_HEIGHT);
        this.groundLayer.add(tile);
      }
    }
  }

  private preloadTilesets(): void {
    const loader = this.load;
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onTilesetLoadError, this);
    loader.once(Phaser.Loader.Events.COMPLETE, () => {
      loader.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onTilesetLoadError, this);
    });

    TILESET_PLACEHOLDERS.forEach((tileset) => {
      if (this.textures.exists(tileset.key)) {
        return;
      }

      loader.image(tileset.key, tileset.url);
    });
  }

  private connectToCommunityRoom(): void {
    const endpoint = this.resolveServerEndpoint();
    const userId = this.resolveUserId();

    if (!endpoint || !userId) {
      console.warn('Skipping Colyseus connection. Missing endpoint or user id.');
      return;
    }

    try {
      this.client = new Client(endpoint);
      this.client
        .joinOrCreate('community', { userId })
        .then((room) => {
          this.room = room;
          this.registerRoomListeners(room);
        })
        .catch((error) => {
          console.error('Failed to join community room', error);
        });
    } catch (error) {
      console.error('Failed to connect to Colyseus server', error);
    }
  }

  private registerRoomListeners(room: Room): void {
    room.onMessage('chunk:snapshot', (payload: ChunkSnapshot) => {
      this.handleChunkSnapshot(payload);
    });

    room.onMessage('chunk:playerJoined', (payload: { player: SerializedPlayer }) => {
      this.handleRemotePlayerUpdate(payload.player);
    });

    room.onMessage('chunk:playerMoved', (payload: { player: SerializedPlayer }) => {
      this.handleRemotePlayerUpdate(payload.player);
    });

    room.onMessage('chunk:playerLeft', (payload: { playerId: string }) => {
      this.removeRemotePlayer(payload.playerId);
    });
  }

  private handleChunkSnapshot(snapshot: ChunkSnapshot): void {
    if (!this.room) {
      return;
    }

    const seen = new Set<string>();
    snapshot.players.forEach((player) => {
      if (player.id === this.room?.sessionId) {
        this.syncLocalWithServer(player);
      } else {
        this.handleRemotePlayerUpdate(player);
        seen.add(player.id);
      }
    });

    this.remotePlayers.forEach((_remote, id) => {
      if (!seen.has(id)) {
        this.removeRemotePlayer(id);
      }
    });
  }

  private syncLocalWithServer(player: SerializedPlayer): void {
    if (!this.localCharacter) {
      return;
    }

    this.localCharacter.isoPosition.set(player.x, player.y, 0);
    if (this.localCharacter.displayName !== player.displayName) {
      this.localCharacter.displayName = player.displayName;
    }
    this.projectCharacter(this.localCharacter);
    this.updateCharacterAnimation(this.localCharacter, null, false);
    this.lastSyncedPosition.set(player.x, player.y);
    this.hasSyncedPosition = true;
  }

  private handleRemotePlayerUpdate(player: SerializedPlayer): void {
    if (!this.room || player.id === this.room.sessionId) {
      return;
    }

    const existing = this.remotePlayers.get(player.id);
    if (existing) {
      const previous = existing.isoPosition.clone();
      existing.isoPosition.set(player.x, player.y, 0);
      if (existing.displayName !== player.displayName) {
        existing.displayName = player.displayName;
      }
      const movement = new Phaser.Math.Vector2(
        existing.isoPosition.x - previous.x,
        existing.isoPosition.y - previous.y
      );
      const hasMoved = movement.lengthSq() > 0.001;
      this.projectCharacter(existing);
      this.updateCharacterAnimation(existing, hasMoved ? movement.normalize() : null, hasMoved);
    } else {
      const remote = this.createCharacterVisual({
        displayName: player.displayName,
        tint: 0x6cf3ff,
        textColor: '#bdf6ff',
      });
      remote.isoPosition.set(player.x, player.y, 0);
      this.remotePlayers.set(player.id, remote);
      this.projectCharacter(remote);
      this.updateCharacterAnimation(remote, null, false);
    }
  }

  private removeRemotePlayer(playerId: string): void {
    const remote = this.remotePlayers.get(playerId);
    if (!remote) {
      return;
    }

    remote.sprite.destroy();
    remote.label.destroy();
    this.remotePlayers.delete(playerId);
  }

  private sendPositionToServer(): void {
    if (!this.room || !this.localCharacter) {
      return;
    }

    const { x, y } = this.localCharacter.isoPosition;
    if (!this.hasSyncedPosition) {
      this.room.send('player:move', { x, y });
      this.lastSyncedPosition.set(x, y);
      this.hasSyncedPosition = true;
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      x,
      y,
      this.lastSyncedPosition.x,
      this.lastSyncedPosition.y
    );
    if (distance > 0.05) {
      this.room.send('player:move', { x, y });
      this.lastSyncedPosition.set(x, y);
    }
  }

  private cleanup(): void {
    this.input.off('pointerup', this.handlePointerUp, this);
    this.input.off('wheel', this.handleCameraWheel, this);
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerup', this.handlePointerUpGeneral, this);
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onTilesetLoadError, this);
    this.remotePlayers.forEach((remote) => {
      remote.sprite.destroy();
      remote.label.destroy();
    });
    this.remotePlayers.clear();

    if (this.localCharacter) {
      this.localCharacter.sprite.destroy();
      this.localCharacter.label.destroy();
      this.localCharacter = undefined;
    }

    if (this.room) {
      this.room.leave(true).catch(() => {
        // ignore errors on shutdown
      });
      this.room = undefined;
    }

    this.client = undefined;
  }

  private resolveServerEndpoint(): string | null {
    const envEndpoint =
      (import.meta.env?.VITE_COLYSEUS_ENDPOINT as string | undefined) ?? undefined;
    if (envEndpoint) {
      return envEndpoint;
    }

    if (typeof window === 'undefined') {
      return null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname;
    const port = (import.meta.env?.VITE_COLYSEUS_PORT as string | undefined) ?? '2567';
    return `${protocol}://${host}:${port}`;
  }

  private resolveUserId(): string | null {
    const envUserId = import.meta.env?.VITE_COLYSEUS_USER_ID as string | undefined;
    if (envUserId) {
      return envUserId;
    }

    if (typeof window === 'undefined') {
      return null;
    }

    const stored = window.localStorage.getItem('colyseusUserId');
    if (stored) {
      return stored;
    }

    const generated = this.generateUserId();
    window.localStorage.setItem('colyseusUserId', generated);
    return generated;
  }

  private generateUserId(): string {
    if (typeof window !== 'undefined' && window.crypto && 'randomUUID' in window.crypto) {
      return window.crypto.randomUUID();
    }

    const random = Math.random().toString(16).slice(2, 10);
    return `guest-${Date.now().toString(16)}${random}`;
  }

  private generateGroundTexture(): void {
    if (this.textures.exists(GROUND_TEXTURE_KEY)) {
      return;
    }

    const graphics = this.add.graphics({ x: 0, y: 0 });
    graphics.setVisible(false);
    const diamondTop = { x: TILE_WIDTH / 2, y: 0 };
    const diamondRight = { x: TILE_WIDTH, y: HALF_TILE_HEIGHT };
    const diamondBottom = { x: TILE_WIDTH / 2, y: TILE_HEIGHT };
    const diamondLeft = { x: 0, y: HALF_TILE_HEIGHT };

    graphics.fillStyle(0x3b9c5c, 1);
    graphics.beginPath();
    graphics.moveTo(diamondTop.x, diamondTop.y);
    graphics.lineTo(diamondRight.x, diamondRight.y);
    graphics.lineTo(diamondBottom.x, diamondBottom.y);
    graphics.lineTo(diamondLeft.x, diamondLeft.y);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(2, 0x1f5d32, 1);
    graphics.beginPath();
    graphics.moveTo(diamondTop.x, diamondTop.y);
    graphics.lineTo(diamondRight.x, diamondRight.y);
    graphics.lineTo(diamondBottom.x, diamondBottom.y);
    graphics.lineTo(diamondLeft.x, diamondLeft.y);
    graphics.closePath();
    graphics.strokePath();

    graphics.generateTexture(GROUND_TEXTURE_KEY, TILE_WIDTH, TILE_HEIGHT);
    graphics.destroy();
  }
}
