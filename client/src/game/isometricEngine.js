import createSpriteCanvas from './objects/canvasSprites.js';
import {
  CHARACTER_MESHES,
  CHARACTER_TEXTURES,
  DEFAULT_CHARACTER_APPEARANCE,
  normaliseCharacterAppearance
} from './characters/customization.js';
import { ensureCharacterTexture } from './characters/textureLoader.js';
import {
  DEFAULT_PIXEL_OFFSET,
  DEFAULT_SPRITE_ANCHOR,
  DEFAULT_SPRITE_OFFSET,
  DEFAULT_VOLUME,
  SPRITE_METRICS,
  clamp,
  normaliseAnchor,
  normaliseOffset,
  normalisePixelOffset,
  normaliseVolume,
  toFiniteNumber
} from './graphics/spritePlacement.js';
import {
  fillIsometricTile,
  getIsometricDiamondPoints,
  strokeIsometricTile
} from './graphics/isometricTile.js';

const DEFAULT_TILESET_CONFIG = {
  tileWidth: SPRITE_METRICS.tile.pixelWidth,
  tileHeight: SPRITE_METRICS.tile.pixelHeight
};

const DEFAULT_SPRITE_CONFIG = {
  frameWidth: SPRITE_METRICS.character.frame.width,
  frameHeight: SPRITE_METRICS.character.frame.height,
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

const DEFAULT_DEBUG_OPTIONS = {
  showTileOverlays: false
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

const hashStringToSeed = (value) => {
  if (!value) {
    return 0x1a2b3c4d;
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return hash || 0x1a2b3c4d;
};

const createSeededRandom = (seedValue) => {
  let state = hashStringToSeed(seedValue);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const DEFAULT_SPRITE_SCALE = { x: 1, y: 1 };
const UNASSIGNED_LAYER_ID = '__unassigned__';
const DEFAULT_MESH_ID = 'compact';

const resolveMeshDefinition = (meshId) => {
  if (typeof meshId === 'string' && CHARACTER_MESHES[meshId]) {
    return CHARACTER_MESHES[meshId];
  }
  return CHARACTER_MESHES[DEFAULT_MESH_ID] ?? CHARACTER_MESHES.compact ?? {};
};

const normaliseLayerPlacement = (value) => {
  if (typeof value !== 'string') {
    return 'ground';
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return 'ground';
  }

  if (['overlay', 'ceiling', 'upper', 'canopy', 'above'].includes(trimmed)) {
    return 'overlay';
  }

  if (['elevated', 'raised', 'mid', 'detail'].includes(trimmed)) {
    return 'elevated';
  }

  return 'ground';
};

const normaliseLayerOpacity = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return clamp(numeric, 0, 1);
};

const normaliseLayerElevation = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normaliseAnchorValue = (value, fallback = DEFAULT_SPRITE_ANCHOR) =>
  normaliseAnchor(value, fallback);

const normaliseOffsetValue = (value, fallback = DEFAULT_SPRITE_OFFSET) =>
  normaliseOffset(value, fallback);

const normalisePixelOffsetValue = (value, fallback = DEFAULT_PIXEL_OFFSET) =>
  normalisePixelOffset(value, fallback);

const normaliseScaleValue = (value, fallback = DEFAULT_SPRITE_SCALE) => {
  if (typeof value === 'number') {
    const numeric = clamp(toFiniteNumber(value, fallback.x), 0.05, 8);
    return { x: numeric, y: numeric };
  }

  if (Array.isArray(value) && value.length) {
    const x = clamp(toFiniteNumber(value[0], fallback.x), 0.05, 8);
    const y = clamp(toFiniteNumber(value[1] ?? value[0], fallback.y), 0.05, 8);
    return { x, y };
  }

  if (value && typeof value === 'object') {
    const rawX = value.x ?? value[0];
    const rawY = value.y ?? value[1];
    const x = clamp(toFiniteNumber(rawX, fallback.x), 0.05, 8);
    const y = clamp(toFiniteNumber(rawY, fallback.y), 0.05, 8);
    return { x, y };
  }

  return { ...fallback };
};

const combineAnchor = (base, override) => {
  const baseAnchor = normaliseAnchorValue(base, DEFAULT_SPRITE_ANCHOR);
  if (override === null || override === undefined) {
    return baseAnchor;
  }

  const extra = normaliseAnchorValue(override, baseAnchor);
  return {
    x: extra.x,
    y: extra.y,
    z: extra.z
  };
};

const combineOffset = (base, override) => {
  const baseOffset = normaliseOffsetValue(base, DEFAULT_SPRITE_OFFSET);
  if (override === null || override === undefined) {
    return baseOffset;
  }

  const extra = normaliseOffsetValue(override, DEFAULT_SPRITE_OFFSET);
  return {
    x: baseOffset.x + extra.x,
    y: baseOffset.y + extra.y,
    z: (baseOffset.z ?? 0) + (extra.z ?? 0)
  };
};

const combinePixelOffset = (base, override) => {
  const baseOffset = normalisePixelOffsetValue(base, DEFAULT_PIXEL_OFFSET);
  if (override === null || override === undefined) {
    return baseOffset;
  }

  const extra = normalisePixelOffsetValue(override, DEFAULT_PIXEL_OFFSET);
  return {
    x: baseOffset.x + extra.x,
    y: baseOffset.y + extra.y,
    z: (baseOffset.z ?? 0) + (extra.z ?? 0)
  };
};

const combineScale = (base, override) => {
  const baseScale = normaliseScaleValue(base, DEFAULT_SPRITE_SCALE);
  if (override === null || override === undefined) {
    return baseScale;
  }

  return normaliseScaleValue(override, baseScale);
};

const enforceMinimumLayerScale = (scale, canvas, tileWidth, tileHeight) => {
  if (!canvas) {
    return scale;
  }

  const current = scale ?? DEFAULT_SPRITE_SCALE;
  const width = Number.isFinite(canvas.width) ? canvas.width : 0;
  const height = Number.isFinite(canvas.height) ? canvas.height : 0;

  if (width <= 0 && height <= 0) {
    return current;
  }

  const minScaleX = width > 0 ? tileWidth / width : current.x;
  const minScaleY = height > 0 ? tileHeight / height : current.y;

  const enforcedX = Math.max(current.x ?? 1, minScaleX || 0);
  const enforcedY = Math.max(current.y ?? 1, minScaleY || 0);

  if (enforcedX === current.x && enforcedY === current.y) {
    return current;
  }

  return { x: enforcedX, y: enforcedY };
};

const normaliseVolumeValue = (value, fallback = DEFAULT_VOLUME) => normaliseVolume(value, fallback);

const combineVolume = (base, override) => {
  const baseVolume = normaliseVolumeValue(base, DEFAULT_VOLUME);
  if (override === null || override === undefined) {
    return baseVolume;
  }

  return normaliseVolumeValue(override, baseVolume);
};

const groupObjectsByLayer = (objects = []) => {
  const groups = new Map();

  objects.forEach((object) => {
    if (!object) {
      return;
    }
    const layerId =
      (typeof object.layerId === 'string' && object.layerId.trim()) ||
      UNASSIGNED_LAYER_ID;
    if (!groups.has(layerId)) {
      groups.set(layerId, []);
    }
    groups.get(layerId).push(object);
  });

  return groups;
};

const collectLayerGroups = (groups, layerLookup) => {
  const entries = [];

  groups.forEach((objects, layerId) => {
    if (!objects.length) {
      return;
    }

    const layer = layerLookup.get(layerId);
    const visible = layer ? layer.visible !== false : true;

    const orderCandidates = [layer?.order];
    objects.forEach((object) => {
      if (Number.isFinite(object?.layerOrder)) {
        orderCandidates.push(object.layerOrder);
      }
    });

    let order = 0;
    for (const candidate of orderCandidates) {
      if (Number.isFinite(candidate)) {
        order = candidate;
        break;
      }
    }

    entries.push({ id: layerId, order, visible, objects });
  });

  entries.sort((a, b) => {
    if (a.order === b.order) {
      return `${a.id}`.localeCompare(`${b.id}`);
    }
    return a.order - b.order;
  });

  return entries;
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

    const mergedTileset = { ...DEFAULT_TILESET_CONFIG, ...options.tileset };
    const widthCandidate = toFiniteNumber(mergedTileset.tileWidth, Number.NaN);
    const heightCandidate = toFiniteNumber(mergedTileset.tileHeight, Number.NaN);
    const resolvedTileSize = Number.isFinite(widthCandidate) && widthCandidate > 0
      ? widthCandidate
      : Number.isFinite(heightCandidate) && heightCandidate > 0
        ? heightCandidate
        : DEFAULT_TILESET_CONFIG.tileWidth;
    this.tileConfig = {
      ...mergedTileset,
      tileWidth: resolvedTileSize,
      tileHeight: resolvedTileSize
    };
    this.spriteConfig = { ...DEFAULT_SPRITE_CONFIG, ...options.sprites };
    this.cameraConfig = { ...DEFAULT_CAMERA_CONFIG, ...options.camera };
    this.zoom = clampZoomValue(options.zoom ?? DEFAULT_ZOOM);
    this.debugConfig = { ...DEFAULT_DEBUG_OPTIONS, ...(options.debug ?? {}) };

    this.scene = {
      map: null,
      blockedTiles: new Set(),
      objectTiles: new Set(),
      collisionTiles: new Set(),
      portalTiles: new Set(),
      layers: [],
      tileLayerGroups: { all: [], ground: [], overlay: [] },
      tileTypes: new Map(),
      player: null,
      remotePlayers: [],
      chatBubbles: new Map(),
      objects: []
    };

    this.animator = new SpriteAnimator(this.spriteConfig);
    this.objectSprites = new Map();
    this.tileTextureCache = new Map();

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

  setDebugOptions(options = {}) {
    if (!options || typeof options !== 'object') {
      return;
    }
    this.debugConfig = { ...this.debugConfig, ...options };
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
    this.tileTextureCache.clear();
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
        tileLayerGroups: { all: [], ground: [], overlay: [] },
        tileTypes: new Map(),
        player: null,
        remotePlayers: [],
        chatBubbles: new Map(),
        objects: [],
        objectLayers: [],
        playerLayerOrder: null,
        objectsBeforePlayers: [],
        objectsAfterPlayers: []
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

    const sortedObjects = [...renderableObjects].sort((a, b) => {
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

    const objectTiles = new Set();
    sortedObjects.forEach((object) => {
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

    const layerCandidates = Array.isArray(map.layers)
      ? map.layers.filter((layer) => Array.isArray(layer?.tiles))
      : [];

    const layers = layerCandidates
      .map((layer) => {
        const identifier =
          layer.id ?? layer.name ?? `layer-${Math.random().toString(16).slice(2)}`;
        const placement = normaliseLayerPlacement(layer.placement ?? layer.mode ?? layer.type);
        const elevation = Number.isFinite(layer.elevation)
          ? layer.elevation
          : normaliseLayerElevation(layer.height ?? layer.level ?? layer.offset);
        const opacity = normaliseLayerOpacity(layer.opacity ?? layer.alpha);
        return {
          id: identifier,
          name: layer.name ?? layer.id ?? 'Layer',
          order: Number.isFinite(layer.order) ? layer.order : 0,
          visible: layer.visible !== false,
          placement,
          elevation,
          ...(opacity !== null ? { opacity } : {}),
          tiles: layer.tiles.map((row) =>
            Array.isArray(row) ? row.map((tile) => (tile === undefined ? null : tile)) : []
          )
        };
      })
      .sort((a, b) => (a.order === b.order ? a.id.localeCompare(b.id) : a.order - b.order));

    const tileLayerGroups = {
      all: layers,
      ground: [],
      overlay: []
    };

    layers.forEach((layer) => {
      if (layer.placement === 'overlay') {
        tileLayerGroups.overlay.push(layer);
      } else {
        tileLayerGroups.ground.push(layer);
      }
    });

    const renderableLookup = new Map(sortedObjects.map((object) => [object.id, object]));
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

    const playerLayerOrderCandidates = [
      map.playerLayerOrder,
      map.playerLayer?.order,
      map.metadata?.playerLayerOrder,
      map.metadata?.playerLayer?.order
    ];

    let playerLayerOrder = null;
    for (const candidate of playerLayerOrderCandidates) {
      const numeric = Number.parseFloat(candidate);
      if (Number.isFinite(numeric)) {
        playerLayerOrder = numeric;
        break;
      }
    }

    const threshold = Number.isFinite(playerLayerOrder)
      ? playerLayerOrder
      : Number.POSITIVE_INFINITY;

    const objectsBeforePlayers = [];
    const objectsAfterPlayers = [];

    sortedObjects.forEach((object) => {
      const order = Number.isFinite(object.layerOrder) ? object.layerOrder : 0;
      if (order > threshold) {
        objectsAfterPlayers.push(object);
      } else {
        objectsBeforePlayers.push(object);
      }
    });

    this.scene = {
      map,
      blockedTiles,
      objectTiles,
      collisionTiles,
      portalTiles,
      layers,
      tileLayerGroups,
      tileTypes,
      player: player ?? null,
      remotePlayers: Array.isArray(remotePlayers) ? remotePlayers : [],
      chatBubbles: bubbleMap,
      objects: sortedObjects,
      objectLayers: sceneObjectLayers,
      playerLayerOrder,
      objectsBeforePlayers,
      objectsAfterPlayers
    };

    this.buildObjectSprites(sortedObjects);

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
      tileLayerGroups: { all: [], ground: [], overlay: [] },
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

    const tileLayerGroups = this.scene?.tileLayerGroups ?? {
      all: [],
      ground: [],
      overlay: []
    };
    const hasTileLayers = Array.isArray(tileLayerGroups.all) && tileLayerGroups.all.length > 0;
    const showTileOverlays = Boolean(this.debugConfig?.showTileOverlays);

    if (hasTileLayers) {
      const groundLayers = tileLayerGroups.ground?.length
        ? tileLayerGroups.ground
        : tileLayerGroups.all;
      this.drawTileLayerCollection(groundLayers, {
        originX,
        originY,
        tileWidth,
        tileHeight,
        camera,
        includeDebug: showTileOverlays
      });
    } else {
      for (let y = 0; y < map.size.height; y += 1) {
        for (let x = 0; x < map.size.width; x += 1) {
          const relX = x - camera.x;
          const relY = y - camera.y;
          const screen = gridToScreen(relX, relY, tileWidth, tileHeight);
          const drawX = originX + screen.x - tileWidth / 2;
          const drawY = originY + screen.y - tileHeight / 2;
          const key = toKey(x, y);

          let tileIndex = 0;
          if (this.scene.blockedTiles.has(key)) {
            tileIndex = 1;
          } else if (this.scene.objectTiles.has(key)) {
            tileIndex = 2;
          }
          this.drawTile(tileIndex, drawX, drawY);

          if (!showTileOverlays) {
            continue;
          }

          if (this.scene.collisionTiles?.has?.(key)) {
            this.drawCollisionOverlay(drawX, drawY);
          } else if (this.scene.blockedTiles.has(key)) {
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
    }

    this.drawLayeredObjects(delta, width, height);

    if (hasTileLayers && tileLayerGroups.overlay?.length) {
      this.drawTileLayerCollection(tileLayerGroups.overlay, {
        originX,
        originY,
        tileWidth,
        tileHeight,
        camera,
        includeDebug: false
      });
    }
  }

  drawTile(tileIndex, x, y) {
    const palette = TILE_PALETTE[tileIndex] ?? TILE_PALETTE[0];
    this.drawStyledTile(palette, x, y, { alpha: 1, useTexture: true });
  }

  buildFloorTextureCanvas({ top, bottom }) {
    const baseTileWidth = Math.round(this.getBaseTileWidth());
    const key = `${top}|${bottom}|${baseTileWidth}`;
    if (this.tileTextureCache.has(key)) {
      return this.tileTextureCache.get(key);
    }

    const baseSize = Math.max(baseTileWidth, 16);
    const canvas = document.createElement('canvas');
    canvas.width = baseSize;
    canvas.height = baseSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    const random = createSeededRandom(key);

    const gradient = ctx.createLinearGradient(0, 0, baseSize, baseSize);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, baseSize, baseSize);

    const radial = ctx.createRadialGradient(
      baseSize / 2,
      baseSize / 2,
      baseSize * 0.1,
      baseSize / 2,
      baseSize / 2,
      baseSize * 0.75
    );
    radial.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    radial.addColorStop(0.6, 'rgba(255, 255, 255, 0.04)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0.15)');

    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, baseSize, baseSize);
    ctx.restore();

    const streakGradient = ctx.createLinearGradient(0, 0, baseSize * 1.2, baseSize * 0.6);
    streakGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    streakGradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.18)');
    streakGradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.08)');
    streakGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = streakGradient;
    ctx.fillRect(0, 0, baseSize, baseSize);
    ctx.restore();

    const speckCount = Math.max(18, Math.round((baseSize * baseSize) / 36));
    for (let i = 0; i < speckCount; i += 1) {
      const size = Math.max(1, Math.round((random() * baseSize) / 16));
      const x = random() * baseSize;
      const y = random() * baseSize;
      const alpha = 0.06 + random() * 0.12;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
      ctx.fillRect(x, y, size, size);

      const shadowAlpha = 0.05 + random() * 0.1;
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha.toFixed(3)})`;
      ctx.fillRect(x + size * 0.4, y + size * 0.4, size, size * 0.6);
    }

    this.tileTextureCache.set(key, canvas);
    return canvas;
  }

  shouldUseTextureForTile(tileType) {
    if (!tileType) {
      return true;
    }

    const rawId = typeof tileType.id === 'string' ? tileType.id.trim().toLowerCase() : '';
    const rawName = typeof tileType.name === 'string' ? tileType.name.trim().toLowerCase() : '';

    if (rawId === 'floor') {
      return true;
    }

    if (rawName.includes('suelo') || rawName.includes('piso')) {
      return true;
    }

    const textureId =
      typeof tileType.texture === 'string' ? tileType.texture.trim().toLowerCase() : null;
    return textureId === 'floor' || textureId === 'floor_texture';
  }

  drawStyledTile(palette, x, y, { alpha = 1, useTexture = false } = {}) {
    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();
    const top = palette?.top ?? DEFAULT_TILE_PALETTE.top;
    const bottom = palette?.bottom ?? DEFAULT_TILE_PALETTE.bottom;

    const padding = 0.5;
    const drawX = x - padding;
    const drawY = y - padding;
    const drawWidth = tileWidth + padding * 2;
    const drawHeight = tileHeight + padding * 2;

    const gradient = this.ctx.createLinearGradient(drawX, drawY, drawX, drawY + drawHeight);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);

    const fillWithStyle = (style, alphaValue) => {
      fillIsometricTile(this.ctx, {
        x: drawX,
        y: drawY,
        width: drawWidth,
        height: drawHeight,
        style,
        alpha: clamp(alphaValue, 0, 1)
      });
    };

    this.ctx.save();
    const resolvedAlpha = clamp(alpha, 0, 1);
    if (useTexture) {
      const textureCanvas = this.buildFloorTextureCanvas({ top, bottom });
      if (textureCanvas) {
        const pattern = this.ctx.createPattern(textureCanvas, 'repeat');
        if (pattern) {
          if (typeof pattern.setTransform === 'function') {
            const baseWidth = textureCanvas.width || this.getBaseTileWidth();
            const baseHeight = textureCanvas.height || this.getBaseTileHeight();
            const scaleX = baseWidth > 0 ? tileWidth / baseWidth : 1;
            const scaleY = baseHeight > 0 ? tileHeight / baseHeight : 1;
            const matrix = {
              a: scaleX,
              b: 0,
              c: 0,
              d: scaleY,
              e: 0,
              f: 0
            };
            try {
              pattern.setTransform(matrix);
            } catch (error) {
              if (typeof window !== 'undefined' && typeof window.DOMMatrix === 'function') {
                const domMatrix = new window.DOMMatrix();
                domMatrix.a = matrix.a;
                domMatrix.d = matrix.d;
                domMatrix.e = matrix.e;
                domMatrix.f = matrix.f;
                pattern.setTransform(domMatrix);
              }
            }
          }
          fillWithStyle(pattern, resolvedAlpha);
          const depthAlpha = resolvedAlpha * 0.45;
          fillWithStyle(gradient, depthAlpha);
        } else {
          fillWithStyle(gradient, resolvedAlpha);
        }
      } else {
        fillWithStyle(gradient, resolvedAlpha);
      }
    } else {
      fillWithStyle(gradient, resolvedAlpha);
    }
    this.ctx.restore();
  }

  drawTileType(tileType, x, y, { alphaOverride } = {}) {
    const palette = derivePaletteFromColor(tileType?.color);
    const baseAlpha = tileType?.transparent === false ? 1 : 0.92;
    const alpha = Number.isFinite(alphaOverride) ? clamp(alphaOverride, 0, 1) : baseAlpha;
    const useTexture = this.shouldUseTextureForTile(tileType);
    this.drawStyledTile(palette, x, y, { alpha, useTexture });
  }

  drawCollisionOverlay(x, y) {
    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();
    this.ctx.save();
    fillIsometricTile(this.ctx, {
      x,
      y,
      width: tileWidth,
      height: tileHeight,
      style: 'rgba(244, 67, 54, 0.18)'
    });
    strokeIsometricTile(this.ctx, {
      x,
      y,
      width: tileWidth,
      height: tileHeight,
      style: 'rgba(211, 47, 47, 0.85)',
      lineWidth: 2,
      alpha: 1,
      inset: 1
    });
    const points = getIsometricDiamondPoints(tileWidth, tileHeight, { inset: 1 });
    this.ctx.beginPath();
    this.ctx.moveTo(x + points[0].x, y + points[0].y);
    this.ctx.lineTo(x + points[2].x, y + points[2].y);
    this.ctx.moveTo(x + points[1].x, y + points[1].y);
    this.ctx.lineTo(x + points[3].x, y + points[3].y);
    this.ctx.strokeStyle = 'rgba(211, 47, 47, 0.85)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawHighlightOverlay(x, y, color) {
    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();
    this.ctx.save();
    fillIsometricTile(this.ctx, {
      x,
      y,
      width: tileWidth,
      height: tileHeight,
      style: color,
      alpha: 1
    });
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

  drawTileLayerCollection(
    layers,
    { originX, originY, tileWidth, tileHeight, camera, includeDebug = false } = {}
  ) {
    if (!Array.isArray(layers) || !layers.length) {
      return;
    }

    const map = this.scene?.map;
    if (!map) {
      return;
    }

    const visibleLayers = layers.filter((layer) => layer?.visible !== false);
    if (!visibleLayers.length) {
      return;
    }

    const hasTileLayers = Array.isArray(this.scene?.tileLayerGroups?.all)
      ? this.scene.tileLayerGroups.all.length > 0
      : true;

    for (let y = 0; y < map.size.height; y += 1) {
      for (let x = 0; x < map.size.width; x += 1) {
        const relX = x - camera.x;
        const relY = y - camera.y;
        const screen = gridToScreen(relX, relY, tileWidth, tileHeight);
        const baseX = originX + screen.x - tileWidth / 2;
        const baseY = originY + screen.y - tileHeight / 2;

        visibleLayers.forEach((layer) => {
          const row = Array.isArray(layer.tiles) ? layer.tiles[y] : null;
          if (!row) {
            return;
          }
          const tileId = row[x];
          if (tileId === null || tileId === undefined) {
            return;
          }
          const tileType = this.resolveTileType(tileId);
          const elevation = Number.isFinite(layer.elevation) ? layer.elevation : 0;
          const drawY = baseY - elevation * tileHeight;
          const alpha =
            layer.opacity !== undefined && layer.opacity !== null ? layer.opacity : undefined;
          this.drawTileType(tileType, baseX, drawY, { alphaOverride: alpha });
        });

        if (!includeDebug) {
          continue;
        }

        const key = toKey(x, y);

        if (this.scene.collisionTiles?.has?.(key)) {
          this.drawCollisionOverlay(baseX, baseY);
        } else if (this.scene.blockedTiles.has(key) && hasTileLayers) {
          this.drawHighlightOverlay(baseX, baseY, 'rgba(100, 181, 246, 0.18)');
        }

        if (this.scene.objectTiles.has(key)) {
          this.drawHighlightOverlay(baseX, baseY, 'rgba(255, 213, 79, 0.22)');
        }

        if (this.scene.portalTiles.has(key)) {
          this.drawPortalMarker(baseX + tileWidth / 2, baseY + tileHeight / 2);
        }
      }
    }
  }

  buildObjectSprites(objects) {
    this.objectSprites = new Map();

    if (!Array.isArray(objects) || !objects.length) {
      return;
    }

    objects.forEach((object) => {
      const appearance = object?.appearance;
      if (!appearance?.generator) {
        return;
      }

      const width = Math.max(1, appearance.width ?? object.size?.width ?? 1);
      const height = Math.max(1, appearance.height ?? object.size?.height ?? 1);
      const tileSize = appearance.tileSize ?? 16;

      const asset = createSpriteCanvas({
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

      if (!asset || !Array.isArray(asset.layers) || !asset.layers.length) {
        return;
      }

      const assetAnchor = normaliseAnchorValue(asset.anchor ?? DEFAULT_SPRITE_ANCHOR, DEFAULT_SPRITE_ANCHOR);
      const appearanceAnchor = appearance.anchor ?? assetAnchor;
      const baseAnchor = normaliseAnchorValue(appearanceAnchor, assetAnchor);

      const baseOffset = combineOffset(asset.offset ?? DEFAULT_SPRITE_OFFSET, appearance.offset ?? DEFAULT_SPRITE_OFFSET);
      const basePixelOffset = combinePixelOffset(asset.pixelOffset ?? DEFAULT_PIXEL_OFFSET, appearance.offsetPixels);
      const baseScale = normaliseScaleValue(appearance.scale ?? DEFAULT_SPRITE_SCALE, DEFAULT_SPRITE_SCALE);

      const baseVolume = normaliseVolumeValue(asset.volume ?? null, {
        height: Math.max(appearance.height ?? object.size?.height ?? 1, 1),
        anchor: baseAnchor
      });

      const layers = asset.layers
        .filter((layer) => layer?.canvas && layer.canvas.width > 0 && layer.canvas.height > 0)
        .map((layer, index) => {
          const anchor = normaliseAnchorValue(layer.anchor ?? baseAnchor, baseAnchor);
          const offset = normaliseOffsetValue(layer.offset ?? DEFAULT_SPRITE_OFFSET, DEFAULT_SPRITE_OFFSET);
          const pixelOffset = normalisePixelOffsetValue(layer.pixelOffset ?? DEFAULT_PIXEL_OFFSET, DEFAULT_PIXEL_OFFSET);
          const alpha = Number.isFinite(layer.alpha) ? clamp(layer.alpha, 0, 1) : 1;
          const composite =
            typeof layer.composite === 'string' && layer.composite.trim()
              ? layer.composite.trim()
              : 'source-over';
          const order = Number.isFinite(layer.order) ? layer.order : index;
          return {
            id: layer.id ?? `layer-${index + 1}`,
            canvas: layer.canvas,
            size: layer.size ?? { width, height },
            anchor,
            offset,
            pixelOffset,
            alpha,
            composite,
            order
          };
        })
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      if (!layers.length) {
        return;
      }

      this.objectSprites.set(object.id, {
        layers,
        baseAnchor,
        baseOffset,
        basePixelOffset,
        baseScale,
        volume: baseVolume,
        appearanceSize: { width, height }
      });
    });
  }

  drawLayeredObjects(delta, width, height) {
    const before = Array.isArray(this.scene?.objectsBeforePlayers)
      ? this.scene.objectsBeforePlayers
      : [];
    const after = Array.isArray(this.scene?.objectsAfterPlayers)
      ? this.scene.objectsAfterPlayers
      : [];
    const layerList = Array.isArray(this.scene?.objectLayers) ? this.scene.objectLayers : [];

    const layerLookup = new Map();
    layerList.forEach((layer) => {
      if (layer?.id) {
        layerLookup.set(layer.id, {
          order: Number.isFinite(layer.order) ? layer.order : 0,
          visible: layer.visible !== false
        });
      }
    });

    const beforeLayers = collectLayerGroups(groupObjectsByLayer(before), layerLookup).filter(
      (layer) => layer.visible !== false
    );
    const afterLayers = collectLayerGroups(groupObjectsByLayer(after), layerLookup).filter(
      (layer) => layer.visible !== false
    );

    if (!beforeLayers.length && !afterLayers.length) {
      const fallback = Array.isArray(this.scene?.objects) ? this.scene.objects : [];
      if (fallback.length) {
        this.drawObjectCollection(width, height, fallback);
      }
      this.drawPlayers(delta, width, height);
      return;
    }

    beforeLayers.forEach((layer) => {
      this.drawObjectCollection(width, height, layer.objects);
    });

    this.drawPlayers(delta, width, height);

    afterLayers.forEach((layer) => {
      this.drawObjectCollection(width, height, layer.objects);
    });
  }

  drawObjectCollection(width, height, objects) {
    const list = Array.isArray(objects)
      ? objects.filter(Boolean)
      : Array.isArray(this.scene?.objects)
        ? this.scene.objects
        : [];

    if (!list.length) {
      return;
    }

    const tileWidth = this.getTileWidth();
    const tileHeight = this.getTileHeight();
    const camera = this.camera ?? { x: 0, y: 0 };
    const originX = width / 2;
    const originY = height / 2;
    const zoom = this.getZoom();
    const prepared = list
      .map((object) => {
        if (!object || object.layerVisible === false) {
          return null;
        }

        const sprite = this.objectSprites.get(object.id);
        if (!sprite?.layers?.length) {
          return null;
        }

        const position = object.position ?? { x: 0, y: 0, z: 0 };
        const size = object.size ?? {};
        const spriteSize = sprite.appearanceSize ?? {};
        const widthTiles = Number.isFinite(size.width)
          ? size.width
          : Number.isFinite(spriteSize.width)
            ? spriteSize.width
            : 1;
        const heightTiles = Number.isFinite(size.height)
          ? size.height
          : Number.isFinite(spriteSize.height)
            ? spriteSize.height
            : 1;

        const metrics = {
          z: Number.isFinite(position.z) ? position.z : 0,
          depthY: (position.y ?? 0) + Math.max(heightTiles, 1) - 1,
          depthX: (position.x ?? 0) + Math.max(widthTiles, 1) - 1,
          baseY: position.y ?? 0,
          baseX: position.x ?? 0,
          id: typeof object.id === 'string' ? object.id : ''
        };

        return {
          object,
          sprite,
          widthTiles: Math.max(widthTiles, 0),
          heightTiles: Math.max(heightTiles, 0),
          metrics
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.metrics.z !== b.metrics.z) {
          return a.metrics.z - b.metrics.z;
        }
        if (a.metrics.depthY !== b.metrics.depthY) {
          return a.metrics.depthY - b.metrics.depthY;
        }
        if (a.metrics.depthX !== b.metrics.depthX) {
          return a.metrics.depthX - b.metrics.depthX;
        }
        if (a.metrics.baseY !== b.metrics.baseY) {
          return a.metrics.baseY - b.metrics.baseY;
        }
        if (a.metrics.baseX !== b.metrics.baseX) {
          return a.metrics.baseX - b.metrics.baseX;
        }
        return a.metrics.id.localeCompare(b.metrics.id);
      });

    if (!prepared.length) {
      return;
    }

    prepared.forEach(({ object, sprite, widthTiles, heightTiles }) => {
      const position = object.position ?? { x: 0, y: 0 };
      const relX = position.x - camera.x;
      const relY = position.y - camera.y;
      const screen = gridToScreen(relX, relY, tileWidth, tileHeight);
      const baseX = originX + screen.x;
      const baseY = originY + screen.y;

      const coverageWidth = tileWidth * Math.max(0, widthTiles);
      const coverageHeight = tileHeight * Math.max(0, heightTiles);

      const baseAnchor = combineAnchor(sprite.baseAnchor ?? DEFAULT_SPRITE_ANCHOR, object.anchor);
      const offsetTiles = combineOffset(
        sprite.baseOffset ?? DEFAULT_SPRITE_OFFSET,
        object.offset ?? object.positionOffset
      );
      const pixelOffset = combinePixelOffset(
        sprite.basePixelOffset ?? DEFAULT_PIXEL_OFFSET,
        object.offsetPixels
      );
      const scale = combineScale(sprite.baseScale ?? DEFAULT_SPRITE_SCALE, object.scale);
      const volume = combineVolume(
        sprite.volume ?? DEFAULT_VOLUME,
        object.volume ?? object.metadata?.volume
      );

      const volumeHeightPixels = tileHeight * Math.max(volume.height ?? heightTiles, 0);

      sprite.layers.forEach((layer) => {
        if (!layer?.canvas) {
          return;
        }

        const layerAnchor = combineAnchor(baseAnchor, layer.anchor);
        const layerOffsetTiles = combineOffset(offsetTiles, layer.offset);
        const layerPixelOffset = combinePixelOffset(pixelOffset, layer.pixelOffset);

        const layerFootprintWidth = tileWidth * Math.max(0, layer.size?.width ?? widthTiles);
        const layerFootprintHeight = tileHeight * Math.max(0, layer.size?.height ?? heightTiles);

        const layerScale = enforceMinimumLayerScale(scale, layer.canvas, tileWidth, tileHeight);
        const drawWidth = layer.canvas.width * layerScale.x * zoom;
        const drawHeight = layer.canvas.height * layerScale.y * zoom;
        if (drawWidth <= 0 || drawHeight <= 0) {
          return;
        }

        const anchorOffsetX = layerFootprintWidth * layerAnchor.x - drawWidth * layerAnchor.x;
        const anchorOffsetY = layerFootprintHeight * layerAnchor.y - drawHeight * layerAnchor.y;
        const anchorOffsetZ = volumeHeightPixels * (layerAnchor.z ?? 0) - drawHeight * (layerAnchor.z ?? 0);

        const tileOffsetX = layerOffsetTiles.x * tileWidth;
        const tileOffsetY = layerOffsetTiles.y * tileHeight;
        const tileOffsetZ = (layerOffsetTiles.z ?? 0) * tileHeight;

        const pixelOffsetX = (layerPixelOffset.x ?? 0) * zoom;
        const pixelOffsetY = (layerPixelOffset.y ?? 0) * zoom;
        const pixelOffsetZ = (layerPixelOffset.z ?? 0) * zoom;

        const drawX = baseX - tileWidth / 2 + anchorOffsetX + tileOffsetX + pixelOffsetX;
        const drawY =
          baseY -
          tileHeight / 2 +
          anchorOffsetY +
          tileOffsetY +
          pixelOffsetY -
          anchorOffsetZ -
          tileOffsetZ -
          pixelOffsetZ;

        this.ctx.save();
        this.ctx.globalAlpha = Number.isFinite(layer.alpha) ? clamp(layer.alpha, 0, 1) : 1;
        this.ctx.globalCompositeOperation = layer.composite ?? 'source-over';
        this.ctx.drawImage(layer.canvas, drawX, drawY, drawWidth, drawHeight);
        this.ctx.restore();
      });
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

      const scale = this.resolvePlayerScale(tileWidth, entity);
      const bob = this.resolveBobOffset(entity.animation, time, scale);

      this.drawPlayerAvatar(entity, screenX, screenY, time, scale, bob, tileWidth, tileHeight);

      const nameY = this.computeNameplateY(screenY, entity.animation, time, scale, bob);

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

  computeNameplateY(screenY, animation, time, scale = 1, bobOverride) {
    const tileHeight = this.getTileHeight();
    const bob = Number.isFinite(bobOverride)
      ? bobOverride
      : this.resolveBobOffset(animation, time, scale);
    return screenY - tileHeight * 1.4 * scale - bob;
  }

  resolveBobOffset(animation, time, scale = 1) {
    if (!time) {
      return 0;
    }
    const base = animation === 'walk' ? 5 : 2;
    const speed = animation === 'walk' ? 200 : 1200;
    return Math.sin((time / speed) * Math.PI * 2) * base * scale;
  }

  resolvePlayerScale(tileWidth, entity) {
    const safeTileWidth = Number.isFinite(tileWidth) && tileWidth > 0 ? tileWidth : DEFAULT_TILESET_CONFIG.tileWidth;
    const baseWidth = safeTileWidth * 0.5;
    const minimum = baseWidth > 0 ? safeTileWidth / baseWidth : 1;
    const candidate = Number.isFinite(entity?.scale) && entity.scale > 0 ? entity.scale : 1;
    return Math.max(candidate, minimum);
  }

  drawPlayerAvatar(entity, screenX, screenY, time, scale = 1, bob = 0, baseTileWidth, baseTileHeight) {
    const palette = entity.local ? PLAYER_COLORS.local : PLAYER_COLORS.remote;
    const tileWidth = Number.isFinite(baseTileWidth) ? baseTileWidth : this.getTileWidth();
    const tileHeight = Number.isFinite(baseTileHeight) ? baseTileHeight : this.getTileHeight();

    const appearanceSource =
      entity.appearance ??
      entity.avatarAppearance ??
      entity.metadata?.appearance ??
      entity.avatar ??
      DEFAULT_CHARACTER_APPEARANCE;

    const appearance = normaliseCharacterAppearance({
      ...DEFAULT_CHARACTER_APPEARANCE,
      ...(appearanceSource && typeof appearanceSource === 'object' ? appearanceSource : {})
    });

    const mesh = resolveMeshDefinition(appearance.mesh);
    const meshScale = scale * (mesh.scale ?? 1);

    const baseY = screenY - tileHeight * 0.6 * meshScale;
    const shadowWidth = tileWidth * 0.35 * meshScale * (mesh.shadow ?? 1);
    const shadowHeight =
      tileHeight * 0.18 * meshScale * (mesh.shadowHeight ?? mesh.shadow ?? 1);
    const shadowOffsetY = tileHeight * 0.1 * meshScale * (mesh.shadowOffset ?? 1);

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    this.ctx.beginPath();
    this.ctx.ellipse(
      screenX,
      screenY + shadowOffsetY,
      Math.max(shadowWidth, 1),
      Math.max(shadowHeight, 1),
      0,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
    this.ctx.restore();

    const textureEntry = appearance.texture ? ensureCharacterTexture(appearance.texture) : null;
    const textureDefinition = appearance.texture
      ? CHARACTER_TEXTURES[appearance.texture] ?? null
      : null;
    const textureImage =
      textureEntry && textureEntry.status === 'loaded' && textureEntry.image
        ? textureEntry.image
        : null;

    if (textureImage) {
      const drawWidth = textureImage.width * meshScale * (mesh.textureScaleX ?? 1);
      const drawHeight = textureImage.height * meshScale * (mesh.textureScaleY ?? 1);
      const offsetY = (mesh.textureOffsetY ?? 0) * drawHeight;

      this.ctx.save();
      this.ctx.drawImage(
        textureImage,
        screenX - drawWidth / 2,
        baseY - drawHeight - bob + offsetY,
        drawWidth,
        drawHeight
      );
      this.ctx.restore();
      return;
    }

    const bodyWidth = tileWidth * 0.5 * meshScale * (mesh.bodyWidth ?? 1);
    const bodyHeight = tileHeight * 1.05 * meshScale * (mesh.bodyHeight ?? 1);
    const torsoHeight = bodyHeight * 0.58 * (mesh.torsoHeight ?? 1);
    const headRadius = tileWidth * 0.2 * meshScale * (mesh.headRadius ?? 1);

    const texturePalette = textureDefinition?.palette ?? {};
    const suitColor = texturePalette.suit ?? palette.body ?? '#4dd0e1';
    const accentColor = appearance.accentColor ?? texturePalette.accent ?? palette.suit ?? '#0097a7';
    const helmetColor = texturePalette.helmet ?? palette.head ?? '#ffe082';
    const visorColor = appearance.visorColor ?? texturePalette.visor ?? palette.visor ?? '#b2ebf2';

    this.ctx.save();
    this.ctx.translate(screenX, baseY - bob);

    // cuerpo principal
    this.ctx.fillStyle = suitColor;
    this.ctx.beginPath();
    this.ctx.roundRect(-bodyWidth / 2, -torsoHeight, bodyWidth, torsoHeight, bodyWidth * 0.35);
    this.ctx.fill();

    // franja de acento
    this.ctx.fillStyle = accentColor;
    this.ctx.beginPath();
    this.ctx.roundRect(
      -bodyWidth * 0.3,
      -torsoHeight * 0.8,
      bodyWidth * 0.6,
      torsoHeight * 0.8,
      bodyWidth * 0.2
    );
    this.ctx.fill();

    // detalle central
    this.ctx.fillStyle = accentColor;
    this.ctx.fillRect(-bodyWidth * 0.05, -torsoHeight, bodyWidth * 0.1, torsoHeight * 0.95);

    // casco
    this.ctx.fillStyle = helmetColor;
    this.ctx.beginPath();
    this.ctx.arc(0, -torsoHeight - headRadius * 1.1, headRadius, 0, Math.PI * 2);
    this.ctx.fill();

    const angleMap = {
      up: -Math.PI / 2,
      down: Math.PI / 2,
      left: Math.PI,
      right: 0
    };
    const direction = directionFallback(entity.direction);
    const angle = angleMap[direction] ?? angleMap.down;

    // visor orientado
    this.ctx.save();
    this.ctx.rotate(angle);
    this.ctx.fillStyle = visorColor;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -headRadius * 0.3);
    this.ctx.quadraticCurveTo(headRadius * 1.2, 0, 0, headRadius * 0.3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();

    // detalles laterales
    this.ctx.strokeStyle = accentColor;
    this.ctx.lineWidth = Math.max(1, bodyWidth * 0.03);
    this.ctx.beginPath();
    this.ctx.moveTo(-bodyWidth * 0.45, -torsoHeight * 0.2);
    this.ctx.lineTo(-bodyWidth * 0.6, bodyHeight * 0.1);
    this.ctx.moveTo(bodyWidth * 0.45, -torsoHeight * 0.2);
    this.ctx.lineTo(bodyWidth * 0.6, bodyHeight * 0.1);
    this.ctx.stroke();

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
