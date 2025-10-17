const DEFAULT_TILESET_CONFIG = {
  tileWidth: 64,
  tileHeight: 32
};

const DEFAULT_SPRITE_CONFIG = {
  frameWidth: 48,
  frameHeight: 64,
  framesPerDirection: 4,
  directions: {
    down: 0,
    left: 1,
    right: 2,
    up: 3
  },
  animationSpeed: 110
};

const TILE_PALETTE = [
  { top: '#8eb5ff', bottom: '#5575d9', stroke: '#1b3a8a' },
  { top: '#f4a9a8', bottom: '#d25b5b', stroke: '#861b2b' },
  { top: '#ffe8a3', bottom: '#f0c14b', stroke: '#b58817' }
];

const PLAYER_COLORS = {
  local: {
    body: '#4dd0e1',
    suit: '#0097a7',
    head: '#ffe082',
    visor: '#b2ebf2'
  },
  remote: {
    body: '#b39ddb',
    suit: '#7e57c2',
    head: '#ffe0b2',
    visor: '#d1c4e9'
  }
};

const DEFAULT_CAMERA_CONFIG = {
  lerpSpeed: 8
};

const KEY_SEPARATOR = ',';

const directionFallback = (direction) => {
  switch (direction) {
    case 'left':
    case 'right':
    case 'up':
    case 'down':
      return direction;
    default:
      return 'down';
  }
};

const toKey = (x, y) => `${x}${KEY_SEPARATOR}${y}`;

const expandArea = ({ x = 0, y = 0, width = 1, height = 1 }) => {
  const tiles = [];
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      tiles.push(toKey(x + dx, y + dy));
    }
  }
  return tiles;
};

class SpriteAnimator {
  constructor(config = {}) {
    this.config = { ...DEFAULT_SPRITE_CONFIG, ...config };
    this.entities = new Map();
  }

  reset(entityId) {
    if (entityId) {
      this.entities.delete(entityId);
    } else {
      this.entities.clear();
    }
  }

  resolveRow(direction = 'down') {
    const safeDirection = directionFallback(direction);
    const { directions } = this.config;
    return directions[safeDirection] ?? directions.down ?? 0;
  }

  getFrame(entityId, animation = 'idle', direction = 'down', delta) {
    if (!entityId) {
      return { frame: 0, row: this.resolveRow(direction), time: 0 };
    }

    const row = this.resolveRow(direction);
    const entry = this.entities.get(entityId) ?? {
      frame: 0,
      accumulator: 0,
      animation,
      row,
      time: 0
    };

    if (animation !== entry.animation || row !== entry.row) {
      entry.frame = 0;
      entry.accumulator = 0;
      entry.animation = animation;
      entry.row = row;
      entry.time = 0;
    }

    const { framesPerDirection, animationSpeed } = this.config;
    const frameDuration = Math.max(animationSpeed, 16);

    if (animation === 'walk') {
      entry.accumulator += delta;
      entry.time += delta;
      while (entry.accumulator >= frameDuration) {
        entry.accumulator -= frameDuration;
        entry.frame = (entry.frame + 1) % framesPerDirection;
      }
    } else {
      entry.frame = 0;
      entry.accumulator = 0;
      entry.time += delta;
    }

    this.entities.set(entityId, entry);
    return { frame: entry.frame, row, time: entry.time };
  }
}

const isoToScreen = (x, y, tileWidth, tileHeight) => {
  return {
    x: (x - y) * (tileWidth / 2),
    y: (x + y) * (tileHeight / 2)
  };
};

export class IsometricEngine {
  constructor(canvas, options = {}) {
    if (!canvas) {
      throw new Error('IsometricEngine requiere un canvas válido.');
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('No se pudo obtener el contexto 2D del canvas.');
    }

    this.tileConfig = { ...DEFAULT_TILESET_CONFIG, ...options.tileset };
    this.spriteConfig = { ...DEFAULT_SPRITE_CONFIG, ...options.sprites };
    this.cameraConfig = { ...DEFAULT_CAMERA_CONFIG, ...options.camera };

    this.scene = {
      map: null,
      blockedTiles: new Set(),
      objectTiles: new Set(),
      portalTiles: new Set(),
      player: null,
      remotePlayers: []
    };

    this.animator = new SpriteAnimator(this.spriteConfig);

    this.camera = { x: 0, y: 0 };
    this.cameraTarget = { x: 0, y: 0 };
    this.lastTimestamp = null;
    this.frameRequest = null;
    this.running = false;

    this.resizeObserver = null;
    this.handleResize = this.handleResize.bind(this);

    this.dpr = window.devicePixelRatio || 1;
    this.ctx.imageSmoothingEnabled = false;

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(canvas);
    }

    this.handleResize();
  }

  setScene({ map, player, remotePlayers = [] } = {}) {
    if (!map) {
      this.scene = {
        map: null,
        blockedTiles: new Set(),
        objectTiles: new Set(),
        portalTiles: new Set(),
        player: null,
        remotePlayers: []
      };
      return;
    }

    const blockedTiles = map.blockedTiles ?? new Set();
    const objectTiles = new Set();
    map.objects?.forEach((object) => {
      expandArea({ ...object.position, ...object.size }).forEach((tile) => objectTiles.add(tile));
    });

    const portalTiles = new Set();
    map.portals?.forEach((portal) => {
      expandArea({ ...portal.from }).forEach((tile) => portalTiles.add(tile));
    });

    this.scene = {
      map,
      blockedTiles,
      objectTiles,
      portalTiles,
      player: player ?? null,
      remotePlayers: Array.isArray(remotePlayers) ? remotePlayers : []
    };

    if (player?.position) {
      this.camera = { ...player.position };
      this.cameraTarget = { ...player.position };
    } else {
      this.camera = { x: map.size.width / 2, y: map.size.height / 2 };
      this.cameraTarget = { ...this.camera };
    }
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTimestamp = null;
    this.frameRequest = requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  stop() {
    this.running = false;
    if (this.frameRequest) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
    }
  }

  destroy() {
    this.stop();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.scene = {
      map: null,
      blockedTiles: new Set(),
      objectTiles: new Set(),
      portalTiles: new Set(),
      player: null,
      remotePlayers: []
    };
  }

  handleResize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    const width = Math.max(Math.floor(rect.width * dpr), 1);
    const height = Math.max(Math.floor(rect.height * dpr), 1);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  loop(timestamp) {
    if (!this.running) {
      return;
    }

    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }

    const delta = Math.min(timestamp - this.lastTimestamp, 1000);
    this.lastTimestamp = timestamp;

    this.update(delta);
    this.render(delta);

    this.frameRequest = requestAnimationFrame((next) => this.loop(next));
  }

  update(delta) {
    const { player } = this.scene;
    if (player?.position) {
      if (!this.camera) {
        this.camera = { ...player.position };
      }
      if (!this.cameraTarget) {
        this.cameraTarget = { ...player.position };
      }
      this.cameraTarget.x = player.position.x;
      this.cameraTarget.y = player.position.y;
    }

    if (this.camera && this.cameraTarget) {
      const lerpFactor = 1 - Math.exp(-this.cameraConfig.lerpSpeed * (delta / 1000));
      this.camera.x += (this.cameraTarget.x - this.camera.x) * lerpFactor;
      this.camera.y += (this.cameraTarget.y - this.camera.y) * lerpFactor;
    }
  }

  render(delta) {
    const { map } = this.scene;
    if (!map) {
      this.ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
      return;
    }

    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    this.ctx.clearRect(0, 0, width, height);

    const { tileWidth, tileHeight } = this.tileConfig;
    const originX = width / 2;
    const originY = height / 2;
    const camera = this.camera ?? { x: 0, y: 0 };

    for (let y = 0; y < map.size.height; y += 1) {
      for (let x = 0; x < map.size.width; x += 1) {
        const relX = x - camera.x;
        const relY = y - camera.y;
        const iso = isoToScreen(relX, relY, tileWidth, tileHeight);
        const drawX = originX + iso.x - tileWidth / 2;
        const drawY = originY + iso.y - tileHeight;
        const key = toKey(x, y);

        let tileIndex = 0;
        if (this.scene.blockedTiles.has(key)) {
          tileIndex = 1;
        } else if (this.scene.objectTiles.has(key)) {
          tileIndex = 2;
        }

        this.drawTile(tileIndex, drawX, drawY);

        if (this.scene.portalTiles.has(key)) {
          this.drawPortalMarker(drawX + tileWidth / 2, drawY + tileHeight / 2);
        }
      }
    }

    this.drawPlayers(delta, width, height);
  }

  drawTile(tileIndex, x, y) {
    const { tileWidth, tileHeight } = this.tileConfig;
    const palette = TILE_PALETTE[tileIndex] ?? TILE_PALETTE[0];

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(x + tileWidth / 2, y);
    this.ctx.lineTo(x + tileWidth, y + tileHeight / 2);
    this.ctx.lineTo(x + tileWidth / 2, y + tileHeight);
    this.ctx.lineTo(x, y + tileHeight / 2);
    this.ctx.closePath();

    const gradient = this.ctx.createLinearGradient(x, y, x, y + tileHeight);
    gradient.addColorStop(0, palette.top);
    gradient.addColorStop(1, palette.bottom);

    this.ctx.fillStyle = gradient;
    this.ctx.strokeStyle = palette.stroke;
    this.ctx.lineWidth = 1.2;
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawPortalMarker(x, y) {
    const radius = 6;
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
    gradient.addColorStop(0, 'rgba(129, 199, 132, 0.9)');
    gradient.addColorStop(1, 'rgba(129, 199, 132, 0)');

    this.ctx.save();
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y - 4, radius * 1.2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  drawPlayers(delta, width, height) {
    const { player, remotePlayers = [] } = this.scene;
    const allPlayers = [];

    if (player) {
      allPlayers.push({ ...player, local: true });
    }

    remotePlayers.forEach((remote) => {
      if (!remote?.position) {
        return;
      }
      allPlayers.push({ ...remote, local: false });
    });

    if (!allPlayers.length) {
      return;
    }

    const sorted = allPlayers.sort((a, b) => {
      const aPos = a.position ?? { x: 0, y: 0 };
      const bPos = b.position ?? { x: 0, y: 0 };
      return aPos.x + aPos.y - (bPos.x + bPos.y);
    });

    const { tileWidth, tileHeight } = this.tileConfig;
    const camera = this.camera ?? { x: 0, y: 0 };
    const originX = width / 2;
    const originY = height / 2;

    sorted.forEach((entity) => {
      const position = entity.position ?? { x: 0, y: 0 };
      const relX = position.x - camera.x;
      const relY = position.y - camera.y;
      const iso = isoToScreen(relX, relY, tileWidth, tileHeight);
      const screenX = originX + iso.x;
      const screenY = originY + iso.y;

      const { time } = this.animator.getFrame(
        entity.id ?? (entity.local ? 'local' : `remote-${screenX}-${screenY}`),
        entity.animation,
        entity.direction,
        delta
      );

      this.drawPlayerAvatar(entity, screenX, screenY, time);

      if (entity.name) {
        const nameY = this.computeNameplateY(screenY, entity.animation, time);
        this.drawNameplate(entity.name, screenX, nameY, entity.local);
      }
    });
  }

  computeNameplateY(screenY, animation, time) {
    const { tileHeight } = this.tileConfig;
    const bob = this.resolveBobOffset(animation, time);
    return screenY - tileHeight * 1.8 - bob;
  }

  resolveBobOffset(animation, time) {
    if (!time) {
      return 0;
    }
    const base = animation === 'walk' ? 5 : 2;
    const speed = animation === 'walk' ? 200 : 1200;
    return Math.sin((time / speed) * Math.PI * 2) * base;
  }

  drawPlayerAvatar(entity, screenX, screenY, time) {
    const palette = entity.local ? PLAYER_COLORS.local : PLAYER_COLORS.remote;
    const { tileWidth, tileHeight } = this.tileConfig;
    const bob = this.resolveBobOffset(entity.animation, time);

    this.ctx.save();

    // shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    this.ctx.beginPath();
    this.ctx.ellipse(screenX, screenY + tileHeight * 0.15, tileWidth * 0.35, tileHeight * 0.2, 0, 0, Math.PI * 2);
    this.ctx.fill();

    const baseY = screenY - tileHeight / 2 - bob;
    const bodyWidth = tileWidth * 0.55;
    const bodyHeight = tileHeight * 1.2;
    const torsoHeight = bodyHeight * 0.6;
    const headRadius = tileWidth * 0.22;

    this.ctx.translate(screenX, baseY);

    // body
    this.ctx.fillStyle = palette.body;
    this.ctx.beginPath();
    this.ctx.roundRect(-bodyWidth / 2, -torsoHeight, bodyWidth, torsoHeight, bodyWidth * 0.35);
    this.ctx.fill();

    // suit accent
    this.ctx.fillStyle = palette.suit;
    this.ctx.beginPath();
    this.ctx.roundRect(-bodyWidth * 0.3, -torsoHeight * 0.8, bodyWidth * 0.6, torsoHeight * 0.8, bodyWidth * 0.2);
    this.ctx.fill();

    // head
    this.ctx.fillStyle = palette.head;
    this.ctx.beginPath();
    this.ctx.arc(0, -torsoHeight - headRadius * 1.1, headRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // visor / direction indicator
    const angleMap = {
      up: -Math.PI / 2,
      down: Math.PI / 2,
      left: Math.PI,
      right: 0
    };
    const direction = directionFallback(entity.direction);
    const angle = angleMap[direction] ?? angleMap.down;

    this.ctx.save();
    this.ctx.rotate(angle);
    this.ctx.fillStyle = palette.visor;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -headRadius * 0.3);
    this.ctx.quadraticCurveTo(headRadius * 1.2, 0, 0, headRadius * 0.3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();

    this.ctx.restore();
  }

  drawNameplate(name, x, y, local) {
    this.ctx.save();
    this.ctx.font = '12px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const paddingX = 8;
    const metrics = this.ctx.measureText(name);
    const width = metrics.width + paddingX * 2;
    const height = 18;

    this.ctx.fillStyle = local ? 'rgba(41, 182, 246, 0.8)' : 'rgba(0, 0, 0, 0.7)';
    this.ctx.strokeStyle = local ? 'rgba(128, 222, 234, 0.8)' : 'rgba(255, 255, 255, 0.25)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.roundRect(x - width / 2, y - height / 2, width, height, 8);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = local ? '#0d1f2d' : '#f0f4ff';
    this.ctx.fillText(name, x, y + 1);
    this.ctx.restore();
  }
}

export default IsometricEngine;
