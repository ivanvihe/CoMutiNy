import Phaser from 'phaser';
const TILE_WIDTH = 128;
const TILE_HEIGHT = 64;
const HALF_TILE_HEIGHT = TILE_HEIGHT / 2;
const PLAYER_HEIGHT_OFFSET = 32;
const CAMERA_SMOOTHNESS = 0.1;
const CAMERA_ZOOM = 1.4;
const MAP_SIZE = 10;
const PLAYER_SPEED = 3.2;
const GROUND_TEXTURE_KEY = 'generated-ground-tile';

export default class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private playerIsoPosition = new Phaser.Math.Vector3(2, 2, 0);
  private player!: Phaser.GameObjects.Rectangle;
  private mapOffset = new Phaser.Math.Vector2();

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.iso.setTileSize(TILE_WIDTH, TILE_HEIGHT);
    this.generateGroundTexture();
  }

  create(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard plugin is not available in this scene.');
    }
    this.cursors = keyboard.createCursorKeys();

    this.mapOffset = this.iso.isoToScreen({ x: (MAP_SIZE - 1) / 2, y: (MAP_SIZE - 1) / 2, z: 0 });

    for (let x = 0; x < MAP_SIZE; x += 1) {
      for (let y = 0; y < MAP_SIZE; y += 1) {
        const screenPosition = this.iso.isoToScreen({ x, y, z: 0 }).subtract(this.mapOffset);
        const tile = this.add.image(screenPosition.x, screenPosition.y, GROUND_TEXTURE_KEY);
        tile.setOrigin(0.5, 0.5);
        tile.setDepth(screenPosition.y - HALF_TILE_HEIGHT);
      }
    }

    this.player = this.add.rectangle(0, 0, 28, 48, 0xffe066);
    this.player.setStrokeStyle(2, 0x1f1f2e, 1);
    this.player.setOrigin(0.5, 1);
    this.projectPlayer();

    const camera = this.cameras.main;
    const mapWidth = TILE_WIDTH * MAP_SIZE;
    const mapHeight = TILE_HEIGHT * MAP_SIZE;
    camera.setRoundPixels(true);
    camera.setBounds(-mapWidth, -mapHeight, mapWidth * 2, mapHeight * 2);
    camera.startFollow(this.player, true, CAMERA_SMOOTHNESS, CAMERA_SMOOTHNESS);
    camera.setZoom(CAMERA_ZOOM);
    camera.setLerp(CAMERA_SMOOTHNESS, CAMERA_SMOOTHNESS);
    camera.setBackgroundColor('#050b16');

  }

  update(_time: number, delta: number): void {
    if (!this.cursors) {
      return;
    }

    const deltaFactor = delta / (1000 / 60);
    const moveSpeed = PLAYER_SPEED * deltaFactor;

    const isoDirection = new Phaser.Math.Vector2(0, 0);

    if (this.cursors.left?.isDown) {
      isoDirection.x -= 1;
      isoDirection.y += 1;
    }
    if (this.cursors.right?.isDown) {
      isoDirection.x += 1;
      isoDirection.y -= 1;
    }
    if (this.cursors.up?.isDown) {
      isoDirection.x -= 1;
      isoDirection.y -= 1;
    }
    if (this.cursors.down?.isDown) {
      isoDirection.x += 1;
      isoDirection.y += 1;
    }

    if (isoDirection.lengthSq() > 0) {
      isoDirection.normalize().scale(moveSpeed);
      this.playerIsoPosition.x += isoDirection.x;
      this.playerIsoPosition.y += isoDirection.y;
    }

    this.projectPlayer();
  }

  private projectPlayer(): void {
    this.iso.projectGameObject(this.player, this.playerIsoPosition, {
      displayHeightOffset: PLAYER_HEIGHT_OFFSET,
      depthOffset: PLAYER_HEIGHT_OFFSET,
      positionOffset: this.mapOffset,
    });
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
