import EasyStar from 'easystarjs';
import { Client, Room } from 'colyseus.js';
import Phaser from 'phaser';
import type { BuildBlueprint, ParcelDefinition, WorldInfoPayload } from '../buildings/types';
import { getBlueprintByType } from '../buildings/catalog';
import { loadSession } from '../auth/session';
import {
  emitBuildPlacementResult,
  gameEvents,
  GameEvent,
  type ChatHistoryEvent,
  type ChatMessageEvent,
  type ChatScope,
  type ChatSendPayload,
  type ChatTypingPayload,
  type ChatTypingStatusPayload,
} from './events';
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
const DEFAULT_MAP_WIDTH = 10;
const DEFAULT_MAP_HEIGHT = 10;
const PLAYER_SPEED = 3.2;
const GROUND_TEXTURE_KEY = 'generated-ground-tile';
const PLAYER_SPRITE_KEY = 'player-sprite';
const POSITION_SYNC_INTERVAL = 150;
const BUILD_PREVIEW_TEXTURE_KEY = 'build-preview-tile';

interface SerializedPlayer {
  id: string;
  displayName: string;
  x: number;
  y: number;
  chunkId: string;
}

interface ChunkSnapshot {
  chunkId: string;
  x: number;
  y: number;
  buildings: SerializedBuilding[];
  players: SerializedPlayer[];
}

interface SerializedBuilding {
  id: string;
  ownerId: string;
  type: string;
  x: number;
  y: number;
  chunkId: string;
}

interface BuildingRemovedPayload {
  buildingId: string;
  chunkId: string;
  x: number;
  y: number;
}

interface CharacterVisual {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  isoPosition: Phaser.Math.Vector3;
  lastDirection: Phaser.Math.Vector2;
  displayName: string;
}

interface BuildingVisual {
  image: Phaser.GameObjects.Image;
  isoPosition: Phaser.Math.Vector3;
  tintColor: number;
  chunkId: string;
}

export default class GameScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  private localCharacter?: CharacterVisual;

  private readonly pathfinder = new EasyStar.js();

  private movePath: Phaser.Math.Vector2[] = [];

  private currentTarget: Phaser.Math.Vector2 | null = null;

  private mapOffset = new Phaser.Math.Vector2();

  private mapWidth = DEFAULT_MAP_WIDTH;

  private mapHeight = DEFAULT_MAP_HEIGHT;

  private groundLayer?: Phaser.GameObjects.Layer;

  private remotePlayers = new Map<string, CharacterVisual>();

  private buildingVisuals = new Map<string, BuildingVisual>();

  private occupiedTiles = new Map<string, string>();

  private client?: Client;

  private room?: Room;

  private lastSyncedPosition = new Phaser.Math.Vector2(0, 0);

  private hasSyncedPosition = false;

  private syncAccumulator = 0;

  private isCameraPanning = false;

  private lastPanPoint = new Phaser.Math.Vector2();

  private pathfindingGrid: number[][] = [];

  private previewSprite?: Phaser.GameObjects.Image;

  private previewIso = new Phaser.Math.Vector3();

  private previewIsValid = false;

  private selectedBlueprint: BuildBlueprint | null = null;

  private buildableParcels: ParcelDefinition[] = [];

  private allParcels: ParcelDefinition[] = [];

  private assignedParcelIds = new Set<string>();

  private parcelLayer?: Phaser.GameObjects.Layer;

  private pendingPlacement: { key: string; type: string } | null = null;

  private isAwaitingBuildConfirmation = false;

  private userId: string | null = null;

  private trackedChunks = new Map<string, { chunkX: number; chunkY: number }>();

  private currentChunkId: string | null = null;

  private isConnecting = false;

  private isShuttingDown = false;

  private reconnectTimer?: Phaser.Time.TimerEvent;

  private chatStateCleanup?: () => void;

  private readonly handleRoomLeave = (): void => {
    this.chatStateCleanup?.();
    this.chatStateCleanup = undefined;
    const clearEvent: ChatHistoryEvent = { messages: [] };
    gameEvents.emit(GameEvent.ChatHistory, clearEvent);
    this.room = undefined;
    this.isConnecting = false;
    this.resetWorldState();

    if (this.isShuttingDown) {
      return;
    }

    this.scheduleReconnect();
  };

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
    this.generatePreviewTexture();
  }

  create(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard plugin is not available in this scene.');
    }
    this.isShuttingDown = false;
    this.clearReconnectTimer();
    this.trackedChunks.clear();
    this.currentChunkId = null;
    this.cursors = keyboard.createCursorKeys();

    this.createAnimations();
    this.updateMapOffset();
    this.initializePathfindingGrid();
    this.createGroundLayer();
    this.previewSprite = this.add.image(0, 0, BUILD_PREVIEW_TEXTURE_KEY);
    this.previewSprite.setOrigin(0.5, 0.5);
    this.previewSprite.setAlpha(0.8);
    this.previewSprite.setVisible(false);

    gameEvents.on(GameEvent.BuildSelect, this.handleBuildSelection, this);
    gameEvents.on(GameEvent.ChatSend, this.handleChatSendRequest, this);
    gameEvents.on(GameEvent.ChatTyping, this.handleChatTypingRequest, this);

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

    void this.connectToCommunityRoom();
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

    clampIsoToBounds(this.localCharacter.isoPosition, this.mapWidth, this.mapHeight);

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
    if (this.selectedBlueprint && pointer.leftButtonReleased()) {
      this.handleBuildPlacement(pointer);
      return;
    }

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
    if (this.isCameraPanning && pointer.middleButtonDown()) {
      const camera = this.cameras.main;
      const deltaX = pointer.x - this.lastPanPoint.x;
      const deltaY = pointer.y - this.lastPanPoint.y;
      camera.scrollX -= deltaX / camera.zoom;
      camera.scrollY -= deltaY / camera.zoom;
      this.lastPanPoint.set(pointer.x, pointer.y);
    }

    if (this.selectedBlueprint) {
      this.updatePlacementPreview(pointer);
    }
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
    const mapWidth = TILE_WIDTH * this.mapWidth;
    const mapHeight = TILE_HEIGHT * this.mapHeight;
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

    this.pathfinder.findPath(
      startX,
      startY,
      targetX,
      targetY,
      (path: Array<{ x: number; y: number }> | null) => {
      if (!path || path.length === 0) {
        return;
      }

      this.movePath = path
        .slice(1)
        .map((node: { x: number; y: number }) => new Phaser.Math.Vector2(node.x, node.y));
      this.advancePath();
    },
    );
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
    return x >= 0 && y >= 0 && x < this.mapWidth && y < this.mapHeight;
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
      x: (this.mapWidth - 1) / 2,
      y: (this.mapHeight - 1) / 2,
      z: 0,
    });
  }

  private initializePathfindingGrid(): void {
    const grid: number[][] = [];
    for (let y = 0; y < this.mapHeight; y += 1) {
      const row: number[] = [];
      for (let x = 0; x < this.mapWidth; x += 1) {
        row.push(0);
      }
      grid.push(row);
    }

    this.pathfindingGrid = grid;
    this.occupiedTiles.forEach((_value, key) => {
      const { x, y } = this.parseTileKey(key);
      if (this.pathfindingGrid[y] && typeof this.pathfindingGrid[y][x] !== 'undefined') {
        this.pathfindingGrid[y][x] = 1;
      }
    });

    this.pathfinder.setGrid(this.pathfindingGrid);
    this.pathfinder.setAcceptableTiles([0]);
    this.pathfinder.enableSync();
  }

  private createGroundLayer(): void {
    this.groundLayer?.destroy(true);
    this.groundLayer = this.add.layer();

    for (let x = 0; x < this.mapWidth; x += 1) {
      for (let y = 0; y < this.mapHeight; y += 1) {
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

  private tileKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  private parseTileKey(key: string): { x: number; y: number } {
    const [rawX, rawY] = key.split(',');
    return { x: Number.parseInt(rawX, 10), y: Number.parseInt(rawY, 10) };
  }

  private parseChunkId(chunkId: string): { chunkX: number; chunkY: number } | null {
    const [rawX, rawY] = chunkId.split(':');
    const chunkX = Number.parseInt(rawX ?? '', 10);
    const chunkY = Number.parseInt(rawY ?? '', 10);

    if (!Number.isFinite(chunkX) || !Number.isFinite(chunkY)) {
      return null;
    }

    return { chunkX, chunkY };
  }

  private colorStringToTint(color: string): number {
    try {
      return Phaser.Display.Color.HexStringToColor(color).color;
    } catch (error) {
      console.warn('Failed to parse color string for blueprint preview', color, error);
      return 0xffffff;
    }
  }

  private handleBuildSelection(payload: { blueprint: BuildBlueprint | null }): void {
    const previousBlueprint = this.selectedBlueprint;
    this.selectedBlueprint = payload.blueprint;
    this.pendingPlacement = null;
    this.isAwaitingBuildConfirmation = false;

    if (!this.previewSprite) {
      return;
    }

    if (!payload.blueprint) {
      this.previewSprite.setVisible(false);
      this.previewIsValid = false;
      if (previousBlueprint) {
        emitBuildPlacementResult({ status: 'pending', message: 'Modo construcción desactivado.' });
      }
      return;
    }

    const tint = this.colorStringToTint(payload.blueprint.previewColor);
    this.previewSprite.setTint(tint);
    this.previewSprite.setVisible(false);
  }

  private handleChatSendRequest(payload: ChatSendPayload): void {
    if (!this.room || !payload || typeof payload.content !== 'string') {
      return;
    }

    const trimmed = payload.content.trim();
    if (!trimmed) {
      return;
    }

    const normalized = trimmed.slice(0, 280);
    const scope: ChatScope = payload.scope === 'proximity' ? 'proximity' : 'global';
    const persist = typeof payload.persist === 'boolean' ? payload.persist : scope === 'global';

    const messagePayload = { content: normalized, persist };

    if (scope === 'proximity') {
      this.room.send('chat:proximity', messagePayload);
    } else {
      this.room.send('chat:global', messagePayload);
    }
  }

  private handleChatTypingRequest(payload: ChatTypingPayload): void {
    if (!this.room || !payload) {
      return;
    }

    const scope: ChatScope = payload.scope === 'proximity' ? 'proximity' : 'global';
    this.room.send('chat:typing', { scope, typing: Boolean(payload.typing) });
  }

  private updatePlacementPreview(pointer: Phaser.Input.Pointer): void {
    if (!this.selectedBlueprint || !this.previewSprite) {
      return;
    }

    const camera = this.cameras.main;
    const worldPoint = pointer.positionToCamera(camera) as Phaser.Math.Vector2;
    const isoPoint = screenToIsoPoint(worldPoint, this.iso, { offset: this.mapOffset });
    const tileX = Math.round(isoPoint.x);
    const tileY = Math.round(isoPoint.y);

    this.previewIso.set(tileX, tileY, 0);

    if (!Number.isFinite(tileX) || !Number.isFinite(tileY) || !this.isTileWithinBounds(tileX, tileY)) {
      this.previewSprite.setVisible(false);
      this.previewIsValid = false;
      return;
    }

    const valid = this.evaluatePlacement(tileX, tileY);
    this.previewIsValid = valid;
    this.updatePreviewVisual(tileX, tileY, valid);
  }

  private refreshPreviewValidity(): void {
    if (!this.selectedBlueprint || !this.previewSprite || !this.previewSprite.visible) {
      return;
    }

    const tileX = Math.round(this.previewIso.x);
    const tileY = Math.round(this.previewIso.y);

    if (!this.isTileWithinBounds(tileX, tileY)) {
      this.previewSprite.setVisible(false);
      this.previewIsValid = false;
      return;
    }

    const valid = this.evaluatePlacement(tileX, tileY);
    this.previewIsValid = valid;
    this.updatePreviewVisual(tileX, tileY, valid);
  }

  private updatePreviewVisual(tileX: number, tileY: number, valid: boolean): void {
    if (!this.previewSprite || !this.selectedBlueprint) {
      return;
    }

    const screenPosition = isoToScreenPoint({ x: tileX, y: tileY, z: 0 }, this.iso, {
      offset: this.mapOffset,
    });
    const baseTint = this.colorStringToTint(this.selectedBlueprint.previewColor);
    const tint = valid ? baseTint : 0xef5350;
    const alpha = valid ? 0.85 : 0.5;

    this.previewSprite.setPosition(screenPosition.x, screenPosition.y);
    this.previewSprite.setDepth(screenPosition.y + 6);
    this.previewSprite.setTint(tint);
    this.previewSprite.setAlpha(alpha);
    this.previewSprite.setVisible(true);
  }

  private evaluatePlacement(x: number, y: number): boolean {
    if (!this.selectedBlueprint) {
      return false;
    }

    if (!this.isTileWithinBounds(x, y)) {
      return false;
    }

    if (this.occupiedTiles.has(this.tileKey(x, y))) {
      return false;
    }

    if (this.buildableParcels.length === 0) {
      return true;
    }

    return this.buildableParcels.some((parcel) => this.isPointInsideParcel(parcel, x, y));
  }

  private isPointInsideParcel(parcel: ParcelDefinition, x: number, y: number): boolean {
    return x >= parcel.x && y >= parcel.y && x < parcel.x + parcel.width && y < parcel.y + parcel.height;
  }

  private handleBuildPlacement(pointer: Phaser.Input.Pointer): void {
    if (!this.selectedBlueprint || !this.room) {
      return;
    }

    if (this.isAwaitingBuildConfirmation) {
      emitBuildPlacementResult({
        status: 'pending',
        message: 'Esperando confirmación del servidor...',
      });
      return;
    }

    this.updatePlacementPreview(pointer);

    if (!this.previewIsValid) {
      emitBuildPlacementResult({ status: 'error', message: 'No puedes construir en esa baldosa.' });
      return;
    }

    const x = Math.round(this.previewIso.x);
    const y = Math.round(this.previewIso.y);

    this.room.send('build:place', { type: this.selectedBlueprint.type, x, y });
    this.pendingPlacement = { key: this.tileKey(x, y), type: this.selectedBlueprint.type };
    this.isAwaitingBuildConfirmation = true;

    emitBuildPlacementResult({ status: 'pending', message: 'Orden de construcción enviada...' });
  }

  private resolveBlueprintTint(type: string): number {
    const blueprint = getBlueprintByType(type);
    if (!blueprint) {
      return 0xb0bec5;
    }

    return this.colorStringToTint(blueprint.previewColor);
  }

  private projectBuildingVisual(visual: BuildingVisual): void {
    const screenPosition = isoToScreenPoint(visual.isoPosition, this.iso, { offset: this.mapOffset });
    visual.image.setPosition(screenPosition.x, screenPosition.y);
    visual.image.setDepth(screenPosition.y + 8);
    visual.image.setTint(visual.tintColor);
  }

  private createBuildingVisual(building: SerializedBuilding, tint: number): BuildingVisual {
    const image = this.add.image(0, 0, BUILD_PREVIEW_TEXTURE_KEY);
    image.setOrigin(0.5, 0.5);
    image.setAlpha(0.95);
    image.setTint(tint);

    const isoPosition = new Phaser.Math.Vector3(building.x, building.y, 0);
    const visual: BuildingVisual = { image, isoPosition, tintColor: tint, chunkId: building.chunkId };
    this.projectBuildingVisual(visual);
    return visual;
  }

  private setTileOccupancy(x: number, y: number, buildingId: string | null): void {
    if (!this.isTileWithinBounds(x, y)) {
      return;
    }

    const key = this.tileKey(x, y);
    if (buildingId) {
      this.occupiedTiles.set(key, buildingId);
    } else {
      this.occupiedTiles.delete(key);
    }

    if (this.pathfindingGrid[y] && typeof this.pathfindingGrid[y][x] !== 'undefined') {
      this.pathfindingGrid[y][x] = buildingId ? 1 : 0;
      this.pathfinder.setGrid(this.pathfindingGrid);
      this.pathfinder.enableSync();
    }

    this.refreshPreviewValidity();
  }

  private upsertBuilding(building: SerializedBuilding): void {
    const tint = this.resolveBlueprintTint(building.type);
    const existing = this.buildingVisuals.get(building.id);

    if (existing) {
      const previousX = Math.round(existing.isoPosition.x);
      const previousY = Math.round(existing.isoPosition.y);
      this.setTileOccupancy(previousX, previousY, null);
      existing.isoPosition.set(building.x, building.y, 0);
      existing.tintColor = tint;
      existing.chunkId = building.chunkId;
      existing.image.setTint(tint);
      this.projectBuildingVisual(existing);
      this.setTileOccupancy(building.x, building.y, building.id);
      return;
    }

    const visual = this.createBuildingVisual(building, tint);
    this.buildingVisuals.set(building.id, visual);
    this.setTileOccupancy(building.x, building.y, building.id);
  }

  private removeBuilding(buildingId: string): void {
    const visual = this.buildingVisuals.get(buildingId);
    if (!visual) {
      return;
    }

    const tileX = Math.round(visual.isoPosition.x);
    const tileY = Math.round(visual.isoPosition.y);
    this.setTileOccupancy(tileX, tileY, null);
    visual.image.destroy();
    this.buildingVisuals.delete(buildingId);
  }

  private reconcileBuildings(snapshot: ChunkSnapshot): void {
    const seen = new Set<string>();
    snapshot.buildings.forEach((building) => {
      seen.add(building.id);
      this.upsertBuilding(building);
    });

    const toRemove: string[] = [];
    this.buildingVisuals.forEach((visual, id) => {
      if (visual.chunkId === snapshot.chunkId && !seen.has(id)) {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => this.removeBuilding(id));
  }

  private handleBuildingPlaced(building: SerializedBuilding): void {
    this.upsertBuilding(building);

    if (
      this.pendingPlacement &&
      this.pendingPlacement.key === this.tileKey(building.x, building.y) &&
      building.ownerId === this.userId
    ) {
      this.isAwaitingBuildConfirmation = false;
      this.pendingPlacement = null;
      emitBuildPlacementResult({
        status: 'success',
        message: `Construcción completada en (${building.x}, ${building.y}).`,
      });
    }
  }

  private handleBuildingRemoved(payload: BuildingRemovedPayload): void {
    if (!payload || typeof payload.buildingId !== 'string') {
      return;
    }

    if (!this.buildingVisuals.has(payload.buildingId)) {
      this.setTileOccupancy(payload.x, payload.y, null);
    }

    this.removeBuilding(payload.buildingId);

    if (this.pendingPlacement && this.pendingPlacement.key === this.tileKey(payload.x, payload.y)) {
      this.isAwaitingBuildConfirmation = false;
      this.pendingPlacement = null;
    }
  }

  private handleServerError(message: string): void {
    this.isAwaitingBuildConfirmation = false;
    this.pendingPlacement = null;
    emitBuildPlacementResult({ status: 'error', message });
  }

  private applyWorldDimensions(width: number, height: number): void {
    const changed = width !== this.mapWidth || height !== this.mapHeight;
    this.mapWidth = width;
    this.mapHeight = height;

    if (!changed) {
      return;
    }

    this.updateMapOffset();

    const existingEntries = Array.from(this.buildingVisuals.entries());
    this.occupiedTiles.clear();

    existingEntries.forEach(([id, visual]) => {
      const tileX = Math.round(visual.isoPosition.x);
      const tileY = Math.round(visual.isoPosition.y);
      if (this.isTileWithinBounds(tileX, tileY)) {
        this.occupiedTiles.set(this.tileKey(tileX, tileY), id);
      } else {
        this.removeBuilding(id);
      }
    });

    this.initializePathfindingGrid();
    this.createGroundLayer();

    this.buildingVisuals.forEach((visual, id) => {
      if (this.buildingVisuals.has(id)) {
        this.projectBuildingVisual(visual);
      }
    });

    if (this.localCharacter) {
      clampIsoToBounds(this.localCharacter.isoPosition, this.mapWidth, this.mapHeight);
      this.projectCharacter(this.localCharacter);
    }

    this.renderParcelOverlay();
    this.refreshPreviewValidity();
  }

  private updateBuildableParcels(parcels: ParcelDefinition[]): void {
    this.allParcels = parcels;

    const userId = this.userId;
    this.buildableParcels = parcels.filter((parcel) => {
      if (parcel.allowPublic) {
        return true;
      }
      if (userId && parcel.ownerId === userId) {
        return true;
      }
      return this.assignedParcelIds.has(parcel.id);
    });

    this.renderParcelOverlay();
    this.refreshPreviewValidity();
  }

  private renderParcelOverlay(): void {
    this.parcelLayer?.destroy(true);
    this.parcelLayer = undefined;

    if (this.allParcels.length === 0 || this.assignedParcelIds.size === 0) {
      return;
    }

    const layer = this.add.layer();
    layer.setDepth(1);

    this.allParcels
      .filter((parcel) => this.assignedParcelIds.has(parcel.id))
      .forEach((parcel) => {
        for (let x = parcel.x; x < parcel.x + parcel.width; x += 1) {
          for (let y = parcel.y; y < parcel.y + parcel.height; y += 1) {
            if (!this.isTileWithinBounds(x, y)) {
              continue;
            }

            const screenPosition = isoToScreenPoint({ x, y, z: 0 }, this.iso, {
              offset: this.mapOffset,
            });
            const overlay = this.add.image(screenPosition.x, screenPosition.y, GROUND_TEXTURE_KEY);
            overlay.setOrigin(0.5, 0.5);
            overlay.setTint(0x66bb6a);
            overlay.setAlpha(0.28);
            overlay.setDepth(screenPosition.y - HALF_TILE_HEIGHT + 1);
            layer.add(overlay);
          }
        }
      });

    this.parcelLayer = layer;
  }

  private handleWorldInfo(payload: WorldInfoPayload): void {
    this.applyWorldDimensions(payload.width, payload.height);
    this.assignedParcelIds = new Set(payload.assignedParcelIds ?? []);
    this.updateBuildableParcels(payload.parcels ?? []);
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

  private async connectToCommunityRoom(isReconnecting = false): Promise<void> {
    if (this.isShuttingDown || this.isConnecting) {
      return;
    }

    const endpoint = this.resolveServerEndpoint();
    const credentials = this.resolveSessionCredentials();

    if (!endpoint || !credentials) {
      console.warn('Skipping Colyseus connection. Missing endpoint or session credentials.');
      return;
    }

    this.userId = credentials.userId;
    this.isConnecting = true;
    this.clearReconnectTimer();

    try {
      if (!this.client || (!isReconnecting && this.client)) {
        this.client = new Client(endpoint);
      }

      const room = await this.client.joinOrCreate('community', {
        userId: credentials.userId,
        authToken: credentials.authToken,
      });
      this.room = room;
      this.registerRoomListeners(room);

      if (isReconnecting) {
        this.resubscribeTrackedChunks(room);
      }
    } catch (error) {
      console.error('Failed to join community room', error);

      if (isReconnecting && !this.isShuttingDown) {
        this.scheduleReconnect();
      }
    } finally {
      this.isConnecting = false;
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

    room.onMessage('chunk:buildingPlaced', (payload: { building: SerializedBuilding }) => {
      this.handleBuildingPlaced(payload.building);
    });

    room.onMessage('chunk:buildingRemoved', (payload: BuildingRemovedPayload) => {
      this.handleBuildingRemoved(payload);
    });

    room.onMessage('world:info', (payload: WorldInfoPayload) => {
      this.handleWorldInfo(payload);
    });

    room.onMessage('error', (payload: { message: string }) => {
      this.handleServerError(payload.message);
    });

    room.onMessage('chat:message', (payload: ChatMessageEvent) => {
      gameEvents.emit(GameEvent.ChatMessage, payload);
    });

    room.onMessage('chat:typing', (payload: ChatTypingStatusPayload) => {
      gameEvents.emit(GameEvent.ChatTypingStatus, payload);
    });

    room.onLeave(this.handleRoomLeave);

    this.chatStateCleanup?.();
    this.bindChatState(room);
  }

  private resubscribeTrackedChunks(room: Room): void {
    this.trackedChunks.forEach(({ chunkX, chunkY }) => {
      if (Number.isFinite(chunkX) && Number.isFinite(chunkY)) {
        room.send('chunk:subscribe', { chunkX, chunkY });
      }
    });
  }

  private bindChatState(room: Room): void {
    const state = room.state as { chat?: { forEach: (cb: (message: unknown) => void) => void; onAdd?: (message: unknown) => void } };
    const chatCollection = state?.chat;

    const history: ChatMessageEvent[] = [];
    if (chatCollection && typeof chatCollection.forEach === 'function') {
      chatCollection.forEach((message: unknown) => {
        history.push(this.transformChatStateMessage(message));
      });
    }

    history.sort((a, b) => a.timestamp - b.timestamp);

    const historyEvent: ChatHistoryEvent = { messages: history };
    gameEvents.emit(GameEvent.ChatHistory, historyEvent);

    if (!chatCollection || typeof chatCollection.forEach !== 'function') {
      this.chatStateCleanup = undefined;
      return;
    }

    const handleAdd = (message: unknown) => {
      const serialized = this.transformChatStateMessage(message);
      gameEvents.emit(GameEvent.ChatMessage, serialized);
    };

    chatCollection.onAdd = handleAdd;

    this.chatStateCleanup = () => {
      if (chatCollection.onAdd === handleAdd) {
        chatCollection.onAdd = undefined;
      }
    };
  }

  private transformChatStateMessage(message: unknown): ChatMessageEvent {
    const data = (message ?? {}) as Record<string, unknown>;
    const fallbackId =
      typeof window !== 'undefined' && window.crypto && 'randomUUID' in window.crypto
        ? window.crypto.randomUUID()
        : `msg-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    const id = typeof data.id === 'string' && data.id.length > 0 ? data.id : fallbackId;
    const senderIdValue = typeof data.senderId === 'string' && data.senderId.length > 0 ? data.senderId : null;
    const senderNameValue = typeof data.senderName === 'string' ? data.senderName : 'Usuario';
    const contentValue = typeof data.content === 'string' ? data.content : '';
    const timestampValue = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
    const scopeValue = (typeof data.scope === 'string' ? data.scope : 'global') as ChatScope;
    const chunkIdValue = typeof data.chunkId === 'string' && data.chunkId.length > 0 ? data.chunkId : null;

    return {
      id,
      senderId: senderIdValue,
      senderName: senderNameValue,
      content: contentValue,
      timestamp: timestampValue,
      scope: scopeValue,
      persistent: Boolean(data.persistent),
      chunkId: chunkIdValue,
    };
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown || this.isConnecting) {
      return;
    }

    this.clearReconnectTimer();
    this.reconnectTimer = this.time.delayedCall(750, () => {
      if (!this.isShuttingDown) {
        void this.connectToCommunityRoom(true);
      }
    });
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      this.reconnectTimer.remove(false);
      this.reconnectTimer = undefined;
    }
  }

  private resetWorldState(): void {
    const buildingIds = Array.from(this.buildingVisuals.keys());
    buildingIds.forEach((id) => this.removeBuilding(id));
    this.buildingVisuals.clear();
    this.occupiedTiles.clear();
    this.pathfindingGrid.forEach((row) => {
      row.fill(0);
    });
    this.pathfinder.setGrid(this.pathfindingGrid);
    this.pathfinder.enableSync();

    this.remotePlayers.forEach((remote) => {
      remote.sprite.destroy();
      remote.label.destroy();
    });
    this.remotePlayers.clear();

    this.pendingPlacement = null;
    this.isAwaitingBuildConfirmation = false;
    this.previewIsValid = false;
    this.previewSprite?.setVisible(false);
    this.hasSyncedPosition = false;
    this.lastSyncedPosition.set(0, 0);
    this.syncAccumulator = 0;
    this.clearPath();
  }

  private handleChunkSnapshot(snapshot: ChunkSnapshot): void {
    if (!this.room) {
      return;
    }

    this.trackedChunks.set(snapshot.chunkId, { chunkX: snapshot.x, chunkY: snapshot.y });

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

    this.reconcileBuildings(snapshot);
  }

  private syncLocalWithServer(player: SerializedPlayer): void {
    if (!this.localCharacter) {
      return;
    }

    this.handleLocalChunkTransition(player.chunkId);

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

  private handleLocalChunkTransition(chunkId: string | undefined): void {
    if (!chunkId) {
      return;
    }

    if (this.currentChunkId === chunkId) {
      return;
    }

    if (this.currentChunkId) {
      this.removeChunkVisuals(this.currentChunkId);
      this.trackedChunks.delete(this.currentChunkId);
    }

    this.currentChunkId = chunkId;

    if (!this.trackedChunks.has(chunkId)) {
      const parsed = this.parseChunkId(chunkId);
      if (parsed) {
        this.trackedChunks.set(chunkId, parsed);
      }
    }
  }

  private removeChunkVisuals(chunkId: string): void {
    const toRemove: string[] = [];
    this.buildingVisuals.forEach((visual, id) => {
      if (visual.chunkId === chunkId) {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => this.removeBuilding(id));
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
    this.isShuttingDown = true;
    this.clearReconnectTimer();
    this.isConnecting = false;

    this.input.off('pointerup', this.handlePointerUp, this);
    this.input.off('wheel', this.handleCameraWheel, this);
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerup', this.handlePointerUpGeneral, this);
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onTilesetLoadError, this);
    gameEvents.off(GameEvent.BuildSelect, this.handleBuildSelection, this);
    gameEvents.off(GameEvent.ChatSend, this.handleChatSendRequest, this);
    gameEvents.off(GameEvent.ChatTyping, this.handleChatTypingRequest, this);

    this.chatStateCleanup?.();
    this.chatStateCleanup = undefined;
    const clearEvent: ChatHistoryEvent = { messages: [] };
    gameEvents.emit(GameEvent.ChatHistory, clearEvent);

    this.previewSprite?.destroy();
    this.previewSprite = undefined;

    this.parcelLayer?.destroy(true);
    this.parcelLayer = undefined;

    this.buildingVisuals.forEach((visual) => {
      visual.image.destroy();
    });
    this.buildingVisuals.clear();
    this.occupiedTiles.clear();
    this.pathfindingGrid = [];
    this.buildableParcels = [];
    this.allParcels = [];
    this.assignedParcelIds.clear();
    this.pendingPlacement = null;
    this.isAwaitingBuildConfirmation = false;

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
    this.userId = null;
    this.trackedChunks.clear();
    this.currentChunkId = null;
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

  private resolveSessionCredentials(): { userId: string; authToken: string } | null {
    const envUserId = import.meta.env?.VITE_COLYSEUS_USER_ID as string | undefined;
    const envToken = import.meta.env?.VITE_COLYSEUS_AUTH_TOKEN as string | undefined;

    if (envUserId && envToken) {
      return { userId: envUserId, authToken: envToken };
    }

    const session = loadSession();
    if (!session) {
      return null;
    }

    return { userId: session.user.id, authToken: session.token };
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

  private generatePreviewTexture(): void {
    if (this.textures.exists(BUILD_PREVIEW_TEXTURE_KEY)) {
      return;
    }

    const graphics = this.add.graphics({ x: 0, y: 0 });
    graphics.setVisible(false);

    graphics.lineStyle(3, 0xffffff, 0.9);
    graphics.fillStyle(0xffffff, 0.25);
    graphics.beginPath();
    graphics.moveTo(TILE_WIDTH / 2, 0);
    graphics.lineTo(TILE_WIDTH, HALF_TILE_HEIGHT);
    graphics.lineTo(TILE_WIDTH / 2, TILE_HEIGHT);
    graphics.lineTo(0, HALF_TILE_HEIGHT);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();

    graphics.generateTexture(BUILD_PREVIEW_TEXTURE_KEY, TILE_WIDTH, TILE_HEIGHT);
    graphics.destroy();
  }
}
