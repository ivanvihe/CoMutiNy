import createSpriteCanvas from './objects/canvasSprites.js';

const DEFAULT_TILESET_CONFIG = {
  tileWidth: 48,
  tileHeight: 48
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
  { top: '#8eb5ff', bottom: '#6c8fe8', stroke: '#1b3a8a' },
  { top: '#f4a9a8', bottom: '#e27575', stroke: '#861b2b' },
  { top: '#ffe8a3', bottom: '#f5c65b', stroke: '#b58817' }
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

const DEFAULT_TILE_TYPE = {
  id: 'floor',
  name: 'Suelo',
  collides: false,
  transparent: true,
  color: '#8eb5ff'
};

const DEFAULT_CAMERA_CONFIG = {
  lerpSpeed: 8
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const DEFAULT_ZOOM = 1;

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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const clampZoomValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_ZOOM;
  }
  return clamp(numeric, MIN_ZOOM, MAX_ZOOM);
};

const normaliseHexColor = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{3,6}$/i.test(trimmed)) {
    return null;
  }
  if (trimmed.length === 3) {
    return `#${trimmed
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`.toLowerCase();
  }
  if (trimmed.length === 6) {
    return `#${trimmed.toLowerCase()}`;
  }
  return null;
};

const shadeColor = (color, amount) => {
  const hex = normaliseHexColor(color);
  if (!hex) {
    return null;
  }

  const numeric = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const r = (numeric >> 16) & 0xff;
  const g = (numeric >> 8) & 0xff;
  const b = numeric & 0xff;

  const transform = (channel) => {
    if (amount >= 0) {
      return clamp(Math.round(channel + (255 - channel) * amount), 0, 255);
    }
    return clamp(Math.round(channel * (1 + amount)), 0, 255);
  };

  const red = transform(r);
  const green = transform(g);
  const blue = transform(b);

  const combined = (red << 16) | (green << 8) | blue;
  return `#${combined.toString(16).padStart(6, '0')}`;
};

const derivePaletteFromColor = (color) => {
  const base = normaliseHexColor(color) ?? DEFAULT_TILE_TYPE.color;
  const top = shadeColor(base, 0.25) ?? base;
  const bottom = shadeColor(base, -0.2) ?? base;
  const stroke = shadeColor(base, -0.45) ?? '#1b3a8a';
  return { top, bottom, stroke };
};

const DEFAULT_TILE_PALETTE = derivePaletteFromColor(DEFAULT_TILE_TYPE.color);

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

const gridToScreen = (x, y, tileWidth, tileHeight) => ({
  x: x * tileWidth,
  y: y * tileHeight
});

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
    this.zoom = clampZoomValue(options.zoom ?? DEFAULT_ZOOM);

    this.scene = {
      map: null,
      blockedTiles: new Set(),
      objectTiles: new Set(),
      collisionTiles: new Set(),
      portalTiles: new Set(),
      layers: [],
      tileTypes: new Map(),
      player: null,
      remotePlayers: [],
      chatBubbles: new Map(),
      objects: []
    };

    this.animator = new SpriteAnimator(this.spriteConfig);
    this.objectSprites = new Map();

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

  getBaseTileWidth() {
    return this.tileConfig.tileWidth ?? DEFAULT_TILESET_CONFIG.tileWidth;
  }

  getBaseTileHeight() {
    return this.tileConfig.tileHeight ?? DEFAULT_TILESET_CONFIG.tileHeight;
  }

  getTileWidth() {
    return this.getBaseTileWidth() * this.zoom;
  }

  getTileHeight() {
    return this.getBaseTileHeight() * this.zoom;
  }

  getZoom() {
    return this.zoom;
  }

  setZoom(value) {
    const nextZoom = clampZoomValue(value);
    if (Math.abs(nextZoom - this.zoom) < 0.0001) {
      return;
    }
    this.zoom = nextZoom;
    this.buildObjectSprites(this.scene?.objects ?? []);
  }

  setScene({ map, player, remotePlayers = [], chatBubbles = [] } = {}) {
    if (!map) {
      this.scene = {
        map: null,
        blockedTiles: new Set(),
        objectTiles: new Set(),
        collisionTiles: new Set(),
        portalTiles: new Set(),
        layers: [],
        tileTypes: new Map(),
        player: null,
        remotePlayers: [],
        chatBubbles: new Map(),
        objects: []
      };
      this.objectSprites = new Map();
      return;
    }

    const blockedTiles = map.blockedTiles ?? new Set();

    const rawObjectLayers = Array.isArray(map.objectLayers) ? map.objectLayers : [];
    const objectLayers = rawObjectLayers
      .map((layer, index) => {
        const layerId =
          typeof layer?.id === 'string' && layer.id.trim() ? layer.id.trim() : `layer-${index + 1}`;
        const order = Number.isFinite(layer?.order) ? layer.order : index;
        const visible = layer?.visible !== false;
        const name =
          typeof layer?.name === 'string' && layer.name.trim() ? layer.name.trim() : layerId;
        const objects = Array.isArray(layer?.objects) ? layer.objects.filter(Boolean) : [];
        return { id: layerId, name, order, visible, objects };
      })
      .sort((a, b) => (a.order === b.order ? a.id.localeCompare(b.id) : a.order - b.order));

    const layerLookup = new Map();
    objectLayers.forEach((layer) => {
      if (layer.id) {
        layerLookup.set(layer.id, { order: layer.order, visible: layer.visible });
      }
    });

    const renderableObjects = Array.isArray(map.objects)
      ? map.objects
          .filter((object) => {
            if (!object) {
              return false;
            }
            if (object.layerVisible === false) {
              return false;
            }
            const layerId =
              typeof object.layerId === 'string' && object.layerId.trim()
                ? object.layerId.trim()
                : typeof object.layer?.id === 'string' && object.layer.id.trim()
                  ? object.layer.id.trim()
                  : null;
            if (!layerId) {
              return true;
            }
            const layer = layerLookup.get(layerId);
            if (layer && layer.visible === false) {
              return false;
            }
            return true;
          })
          .map((object) => {
            const layerId =
              typeof object.layerId === 'string' && object.layerId.trim()
                ? object.layerId.trim()
                : typeof object.layer?.id === 'string' && object.layer.id.trim()
                  ? object.layer.id.trim()
                  : null;
            const layer = layerId ? layerLookup.get(layerId) : null;
            const resolvedOrder = Number.isFinite(object.layerOrder)
              ? object.layerOrder
              : layer?.order ?? 0;
            const isLayerVisible =
              object.layerVisible !== false && (layer ? layer.visible !== false : true);

            return {
              ...object,
              layerId,
              layerOrder: resolvedOrder,
              layerVisible: isLayerVisible,
              appearance: object.appearance
                ? {
                    ...object.appearance,
                    options:
                      object.appearance.options && typeof object.appearance.options === 'object'
                        ? { ...object.appearance.options }
                        : {}
                  }
                : null
            };
          })
      : [];

    const objectTiles = new Set();
    renderableObjects.forEach((object) => {
      expandArea({ ...object.position, ...object.size }).forEach((tile) => objectTiles.add(tile));
    });

    const portalTiles = new Set();
    map.portals?.forEach((portal) => {
      expandArea({ ...portal.from }).forEach((tile) => portalTiles.add(tile));
    });

    const bubbleMap = new Map();
    if (Array.isArray(chatBubbles)) {
      chatBubbles.forEach((bubble) => {
        const playerId = typeof bubble?.playerId === 'string' ? bubble.playerId.trim() : null;
        const content = typeof bubble?.content === 'string' ? bubble.content.trim() : '';
        if (!playerId || !content) {
          return;
        }
        const receivedAt =
          typeof bubble.receivedAt === 'number' && Number.isFinite(bubble.receivedAt)
            ? bubble.receivedAt
            : Date.now();
        bubbleMap.set(playerId, { content, receivedAt });
      });
    }

    const collisionTiles = new Set();
    map.collidableTiles?.forEach((position) => {
      if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
        collisionTiles.add(toKey(position.x, position.y));
      }
    });

    const tileTypes = new Map();
    if (map.tileTypes && typeof map.tileTypes === 'object') {
      Object.entries(map.tileTypes).forEach(([key, value]) => {
        if (value && typeof value === 'object') {
          tileTypes.set(key, { ...value, id: value.id ?? key });
        }
      });
    }
    if (!tileTypes.size) {
      tileTypes.set(DEFAULT_TILE_TYPE.id, { ...DEFAULT_TILE_TYPE });
    }

    const layers = Array.isArray(map.layers)
      ? map.layers
          .filter((layer) => Array.isArray(layer?.tiles))
          .map((layer) => ({
            id: layer.id ?? layer.name ?? `layer-${Math.random().toString(16).slice(2)}`,
            name: layer.name ?? layer.id ?? 'Layer',
            order: Number.isFinite(layer.order) ? layer.order : 0,
            visible: layer.visible !== false,
            tiles: layer.tiles.map((row) =>
              Array.isArray(row) ? row.map((tile) => (tile === undefined ? null : tile)) : []
            )
          }))
          .sort((a, b) => (a.order === b.order ? a.id.localeCompare(b.id) : a.order - b.order))
      : [];

    const renderableLookup = new Map(renderableObjects.map((object) => [object.id, object]));
    const sceneObjectLayers = objectLayers.map((layer) => ({
      ...layer,
      objects: layer.objects
        .map((object) => {
          const identifier = typeof object?.id === 'string' ? object.id.trim() : null;
          if (!identifier) {
            return null;
          }
          return renderableLookup.get(identifier) ?? null;
        })
        .filter(Boolean)
    }));

    this.scene = {
      map,
      blockedTiles,
      objectTiles,
      collisionTiles,
      portalTiles,
      layers,
      tileTypes,
      player: player ?? null,
      remotePlayers: Array.isArray(remotePlayers) ? remotePlayers : [],
      chatBubbles: bubbleMap,
      objects: renderableObjects,
      objectLayers: sceneObjectLayers
    };

    this.buildObjectSprites(renderableObjects);

    if (player?.position) {
      this.camera = { ...player.position };
      this.cameraTarget = { ...player.position };
    } else {
      this.camera = { x: map.size.width / 2, y: map.size.height / 2 };
      this.cameraTarget = { ...this.camera };
    }
  }

  resolveTileType(tileId) {
    const lookup = this.scene?.tileTypes;
    if (lookup instanceof Map) {
      if (lookup.has(tileId)) {
        return lookup.get(tileId);
      }
      const stringKey = `${tileId}`;
      if (lookup.has(stringKey)) {
        return lookup.get(stringKey);
      }
    }
    return { ...DEFAULT_TILE_TYPE, id: tileId ?? DEFAULT_TILE_TYPE.id };
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
      collisionTiles: new Set(),
      portalTiles: new Set(),
      layers: [],
      tileTypes: new Map(),
      player: null,
      remotePlayers: [],
      chatBubbles: new Map(),
      objects: []
    };
    this.objectSprites = new Map();
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

    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();
    const originX = width / 2;
    const originY = height / 2;
    const camera = this.camera ?? { x: 0, y: 0 };

    const layers = Array.isArray(this.scene.layers) ? this.scene.layers : [];
    const hasLayers = layers.length > 0;

    for (let y = 0; y < map.size.height; y += 1) {
      for (let x = 0; x < map.size.width; x += 1) {
        const relX = x - camera.x;
        const relY = y - camera.y;
        const screen = gridToScreen(relX, relY, tileWidth, tileHeight);
        const drawX = originX + screen.x - tileWidth / 2;
        const drawY = originY + screen.y - tileHeight / 2;
        const key = toKey(x, y);

        if (hasLayers) {
          layers.forEach((layer) => {
            if (!layer?.visible) {
              return;
            }
            const row = Array.isArray(layer.tiles) ? layer.tiles[y] : null;
            if (!row) {
              return;
            }
            const tileId = row[x];
            if (tileId === null || tileId === undefined) {
              return;
            }
            const tileType = this.resolveTileType(tileId);
            this.drawTileType(tileType, drawX, drawY);
          });
        } else {
          let tileIndex = 0;
          if (this.scene.blockedTiles.has(key)) {
            tileIndex = 1;
          } else if (this.scene.objectTiles.has(key)) {
            tileIndex = 2;
          }
          this.drawTile(tileIndex, drawX, drawY);
        }

        if (this.scene.collisionTiles?.has?.(key)) {
          this.drawCollisionOverlay(drawX, drawY);
        } else if (this.scene.blockedTiles.has(key) && hasLayers) {
          this.drawHighlightOverlay(drawX, drawY, 'rgba(100, 181, 246, 0.18)');
        }

        if (this.scene.objectTiles.has(key)) {
          this.drawHighlightOverlay(drawX, drawY, 'rgba(255, 213, 79, 0.22)');
        }

        if (this.scene.portalTiles.has(key)) {
          this.drawPortalMarker(drawX + tileWidth / 2, drawY + tileHeight / 2);
        }
      }
    }

    this.drawObjects(width, height);
    this.drawPlayers(delta, width, height);
  }

  drawTile(tileIndex, x, y) {
    const palette = TILE_PALETTE[tileIndex] ?? TILE_PALETTE[0];
    this.drawStyledTile(palette, x, y, 1);
  }

  drawStyledTile(palette, x, y, alpha = 1) {
    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();
    const top = palette?.top ?? DEFAULT_TILE_PALETTE.top;
    const bottom = palette?.bottom ?? DEFAULT_TILE_PALETTE.bottom;
    const stroke = palette?.stroke ?? DEFAULT_TILE_PALETTE.stroke;

    const gradient = this.ctx.createLinearGradient(x, y, x, y + tileHeight);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);

    this.ctx.save();
    this.ctx.globalAlpha = clamp(alpha, 0, 1);
    this.ctx.fillStyle = gradient;
    this.ctx.strokeStyle = stroke;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.rect(x, y, tileWidth, tileHeight);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawTileType(tileType, x, y) {
    const palette = derivePaletteFromColor(tileType?.color);
    const alpha = tileType?.transparent === false ? 1 : 0.92;
    this.drawStyledTile(palette, x, y, alpha);
  }

  drawCollisionOverlay(x, y) {
    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(244, 67, 54, 0.18)';
    this.ctx.fillRect(x, y, tileWidth, tileHeight);
    this.ctx.strokeStyle = 'rgba(211, 47, 47, 0.85)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x + 1, y + 1, tileWidth - 2, tileHeight - 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + 2, y + 2);
    this.ctx.lineTo(x + tileWidth - 2, y + tileHeight - 2);
    this.ctx.moveTo(x + tileWidth - 2, y + 2);
    this.ctx.lineTo(x + 2, y + tileHeight - 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawHighlightOverlay(x, y, color) {
    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, tileWidth, tileHeight);
    this.ctx.restore();
  }

  drawPortalMarker(x, y) {
    const radius = 6 * this.zoom;
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
    gradient.addColorStop(0, 'rgba(129, 199, 132, 0.9)');
    gradient.addColorStop(1, 'rgba(129, 199, 132, 0)');

    this.ctx.save();
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y - 4 * this.zoom, radius * 1.2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  buildObjectSprites(objects) {
    this.objectSprites = new Map();

    if (!Array.isArray(objects) || !objects.length) {
      return;
    }

    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();

    objects.forEach((object) => {
      const appearance = object?.appearance;
      if (!appearance?.generator) {
        return;
      }

      const width = appearance.width ?? object.size?.width ?? 1;
      const height = appearance.height ?? object.size?.height ?? 1;
      const tileSize = appearance.tileSize ?? 16;

      const canvas = createSpriteCanvas({
        generator: appearance.generator,
        width,
        height,
        tileSize,
        options: {
          ...(appearance.options ?? {}),
          ...(appearance.variant ? { variant: appearance.variant } : {}),
          palette: Array.isArray(object.palette) ? [...object.palette] : undefined,
          metadata: object.metadata ?? {},
          objectId: object.objectId ?? null
        }
      });

      if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        return;
      }

      const coverageWidth = object.size?.width ?? width;
      const coverageHeight = object.size?.height ?? height;

      const scaleX = ((tileWidth * coverageWidth) / canvas.width) * (appearance.scale?.x ?? 1);
      const scaleY = ((tileHeight * coverageHeight) / canvas.height) * (appearance.scale?.y ?? 1);

      this.objectSprites.set(object.id, {
        canvas,
        scaleX,
        scaleY,
        anchor: appearance.anchor ?? { x: 0.5, y: 1 },
        offset: appearance.offset ?? { x: 0, y: 0 }
      });
    });
  }

  drawObjects(width, height) {
    const objects = Array.isArray(this.scene?.objects) ? this.scene.objects : [];
    if (!objects.length) {
      return;
    }

    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();
    const camera = this.camera ?? { x: 0, y: 0 };
    const originX = width / 2;
    const originY = height / 2;

    const sorted = [...objects].sort((a, b) => {
      const aLayer = Number.isFinite(a.layerOrder) ? a.layerOrder : 0;
      const bLayer = Number.isFinite(b.layerOrder) ? b.layerOrder : 0;
      if (aLayer !== bLayer) {
        return aLayer - bLayer;
      }
      const aPos = a.position ?? { x: 0, y: 0 };
      const bPos = b.position ?? { x: 0, y: 0 };
      const aDepth = (aPos.y ?? 0) + (a.size?.height ?? 1);
      const bDepth = (bPos.y ?? 0) + (b.size?.height ?? 1);
      if (aDepth !== bDepth) {
        return aDepth - bDepth;
      }
      return aPos.x - bPos.x;
    });

    sorted.forEach((object) => {
      if (object.layerVisible === false) {
        return;
      }
      const sprite = this.objectSprites.get(object.id);
      if (!sprite?.canvas) {
        return;
      }

      const position = object.position ?? { x: 0, y: 0 };
      const size = object.size ?? { width: 1, height: 1 };
      const relX = position.x - camera.x;
      const relY = position.y - camera.y;
      const areaX = originX + relX * tileWidth - tileWidth / 2;
      const areaY = originY + relY * tileHeight - tileHeight / 2;
      const areaWidth = tileWidth * (size.width ?? 1);
      const areaHeight = tileHeight * (size.height ?? 1);

      const drawWidth = sprite.canvas.width * sprite.scaleX;
      const drawHeight = sprite.canvas.height * sprite.scaleY;

      const anchorX = sprite.anchor?.x ?? 0.5;
      const anchorY = sprite.anchor?.y ?? 1;
      const offsetX = sprite.offset?.x ?? 0;
      const offsetY = sprite.offset?.y ?? 0;

      const drawX = areaX + areaWidth * anchorX - drawWidth * anchorX + offsetX * tileWidth;
      const drawY = areaY + areaHeight * anchorY - drawHeight * anchorY + offsetY * tileHeight;

      this.ctx.drawImage(sprite.canvas, drawX, drawY, drawWidth, drawHeight);
    });
  }

  drawPlayers(delta, width, height) {
    const { player, remotePlayers = [], chatBubbles = new Map() } = this.scene;
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
      if (aPos.y !== bPos.y) {
        return aPos.y - bPos.y;
      }
      return aPos.x - bPos.x;
    });

    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();
    const camera = this.camera ?? { x: 0, y: 0 };
    const originX = width / 2;
    const originY = height / 2;

    sorted.forEach((entity) => {
      const position = entity.position ?? { x: 0, y: 0 };
      const relX = position.x - camera.x;
      const relY = position.y - camera.y;
      const screen = gridToScreen(relX, relY, tileWidth, tileHeight);
      const screenX = originX + screen.x;
      const screenY = originY + screen.y;

      const { time } = this.animator.getFrame(
        entity.id ?? (entity.local ? 'local' : `remote-${screenX}-${screenY}`),
        entity.animation,
        entity.direction,
        delta
      );

      this.drawPlayerAvatar(entity, screenX, screenY, time);

      const nameY = this.computeNameplateY(screenY, entity.animation, time);

      if (entity.id) {
        const bubble = chatBubbles.get(entity.id);
        if (bubble) {
          const bubbleBottomY = nameY - 28;
          this.drawChatBubble(bubble.content, screenX, bubbleBottomY, bubble.receivedAt);
        }
      }

      if (entity.name) {
        this.drawNameplate(entity.name, screenX, nameY, entity.local);
      }
    });
  }

  drawChatBubble(content, centerX, bottomY, receivedAt) {
    if (!content) {
      return;
    }

    const now = Date.now();
    if (!Number.isFinite(receivedAt) || now - receivedAt >= 2000) {
      return;
    }

    const fadeDuration = 500;
    const lifetime = 2000;
    const elapsed = now - receivedAt;
    const fadeStart = lifetime - fadeDuration;
    const alpha =
      elapsed <= fadeStart
        ? 1
        : Math.max(0, 1 - (elapsed - fadeStart) / Math.max(fadeDuration, 1));

    const sanitized = content.replace(/\s+/g, ' ').trim();
    if (!sanitized) {
      return;
    }

    this.ctx.save();
    this.ctx.font = '12px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    const maxLineWidth = this.getTileWidth() * 2.2;
    const lineHeight = 16;
    const paddingX = 10;
    const paddingY = 6;

    const words = sanitized.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = this.ctx.measureText(candidate).width;
      if (width <= maxLineWidth || !currentLine) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    if (!lines.length) {
      this.ctx.restore();
      return;
    }

    if (lines.length > 3) {
      const truncated = lines.slice(0, 3);
      truncated[2] = `${truncated[2]}…`;
      lines.length = 0;
      truncated.forEach((line) => lines.push(line));
    }

    let textWidth = 0;
    lines.forEach((line) => {
      textWidth = Math.max(textWidth, this.ctx.measureText(line).width);
    });

    const bubbleWidth = textWidth + paddingX * 2;
    const bubbleHeight = lines.length * lineHeight + paddingY * 2;
    const rectX = centerX - bubbleWidth / 2;
    const rectY = bottomY - bubbleHeight;

    const backgroundAlpha = 0.85 * alpha;
    const strokeAlpha = 0.6 * alpha;

    this.ctx.fillStyle = `rgba(21, 101, 192, ${backgroundAlpha.toFixed(3)})`;
    this.ctx.strokeStyle = `rgba(144, 202, 249, ${strokeAlpha.toFixed(3)})`;
    this.ctx.lineWidth = 1.2;
    this.ctx.beginPath();
    this.ctx.roundRect(rectX, rectY, bubbleWidth, bubbleHeight, 10);
    this.ctx.fill();
    this.ctx.stroke();

    const tailWidth = 10;
    const tailHeight = 6;
    const tailX = centerX;
    const tailY = bottomY - 1;
    this.ctx.beginPath();
    this.ctx.moveTo(tailX, tailY);
    this.ctx.lineTo(tailX - tailWidth / 2, tailY - tailHeight);
    this.ctx.lineTo(tailX + tailWidth / 2, tailY - tailHeight);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = `rgba(240, 248, 255, ${alpha.toFixed(3)})`;
    let textY = rectY + paddingY;
    lines.forEach((line) => {
      this.ctx.fillText(line, centerX, textY);
      textY += lineHeight;
    });

    this.ctx.restore();
  }

  computeNameplateY(screenY, animation, time) {
    const tileHeight = this.getTileHeight();
    const bob = this.resolveBobOffset(animation, time);
    return screenY - tileHeight * 1.4 - bob;
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
    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();
    const bob = this.resolveBobOffset(entity.animation, time);

    this.ctx.save();

    // shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    this.ctx.beginPath();
    this.ctx.ellipse(screenX, screenY + tileHeight * 0.1, tileWidth * 0.35, tileHeight * 0.18, 0, 0, Math.PI * 2);
    this.ctx.fill();

    const baseY = screenY - tileHeight * 0.6 - bob;
    const bodyWidth = tileWidth * 0.5;
    const bodyHeight = tileHeight * 1.05;
    const torsoHeight = bodyHeight * 0.58;
    const headRadius = tileWidth * 0.2;

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
