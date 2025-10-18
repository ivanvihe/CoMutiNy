import Phaser from 'phaser';
import InteractiveObject from '../entities/InteractiveObject.js';

const TILE_TEXTURE_PREFIX = 'tile/';

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

export default class MapManager {
  constructor(
    scene,
    {
      tileSize = 64,
      tileTextures = new Map(),
      objectSprites = new Map(),
      containers = {}
    } = {}
  ) {
    this.scene = scene;
    this.tileSize = tileSize;
    this.tileTextures = tileTextures;
    this.objectSprites = objectSprites;

    if (containers.tileLayers instanceof Phaser.GameObjects.Layer) {
      this.layerContainer = containers.tileLayers;
      this._ownsLayerContainer = false;
    } else {
      this.layerContainer = this.scene.add.layer();
      this._ownsLayerContainer = true;
    }

    if (containers.objects instanceof Phaser.GameObjects.Layer) {
      this.objectsContainer = containers.objects;
      this._ownsObjectsContainer = false;
    } else {
      this.objectsContainer = this.scene.add.layer();
      this._ownsObjectsContainer = true;
    }

    this.collidableTiles = this.scene.physics.add.staticGroup();
    this.solidObjects = this.scene.physics.add.staticGroup();
    this.interactiveObjects = this.scene.add.group();

    this.currentMap = null;
  }

  setResources({ tileTextures, objectSprites } = {}) {
    if (tileTextures instanceof Map) {
      this.tileTextures = tileTextures;
    }
    if (objectSprites instanceof Map) {
      this.objectSprites = objectSprites;
    }
  }

  clear() {
    this.layerContainer.removeAll(true);

    this.interactiveObjects.children.each((child) => {
      if (child && typeof child.destroy === 'function') {
        child.destroy();
      }
    });
    this.interactiveObjects.clear(false, false);

    this.objectsContainer.removeAll(true);
    this.collidableTiles.clear(true, true);
    this.solidObjects.clear(true, true);
    this.currentMap = null;
  }

  destroy() {
    this.clear();
    this.collidableTiles.destroy(true);
    this.solidObjects.destroy(true);
    this.interactiveObjects.destroy(true);
    if (this._ownsLayerContainer) {
      this.layerContainer.destroy(true);
    }
    if (this._ownsObjectsContainer) {
      this.objectsContainer.destroy(true);
    }
  }

  load(map) {
    if (!map || typeof map !== 'object') {
      return null;
    }

    this.clear();
    this.currentMap = map;

    const width = Math.max(1, map?.size?.width ?? 1);
    const height = Math.max(1, map?.size?.height ?? 1);

    this.buildTileLayers(map);
    this.buildObjects(map);

    const pixelWidth = width * this.tileSize;
    const pixelHeight = height * this.tileSize;

    return {
      width,
      height,
      pixelWidth,
      pixelHeight,
      collidableTiles: this.collidableTiles,
      solidObjects: this.solidObjects,
      interactiveObjects: this.interactiveObjects
    };
  }

  buildTileLayers(map) {
    const layers = sortLayers(map?.layers);
    layers.forEach((layer) => {
      if (!layer || layer.visible === false) {
        return;
      }
      const layerGroup = this.scene.add.layer();
      layer.tiles.forEach((row, y) => {
        row.forEach((tileId, x) => {
          if (!tileId) {
            return;
          }
          const tileEntry = this.tileTextures.get(tileId);
          const textureKey = tileEntry?.key ?? `${TILE_TEXTURE_PREFIX}${tileId}`;
          if (!textureKey || !this.scene.textures.exists(textureKey)) {
            return;
          }
          const posX = x * this.tileSize + this.tileSize / 2;
          const posY = y * this.tileSize + this.tileSize / 2;
          const image = this.scene.add.image(posX, posY, textureKey);
          image.setDisplaySize(this.tileSize, this.tileSize);
          layerGroup.add(image);

          const tileType = resolveTileType(map, tileId);
          if (tileType?.collides) {
            this.scene.physics.add.existing(image, true);
            const body = /** @type {Phaser.Physics.Arcade.Body | null} */ (image.body);
            if (body) {
              body.setSize(this.tileSize, this.tileSize);
              body.setOffset(-this.tileSize / 2, -this.tileSize / 2);
            }
            this.collidableTiles.add(image);
          }
        });
      });
      if (Number.isFinite(layer.opacity)) {
        layerGroup.setAlpha(clamp(layer.opacity, 0, 1));
      }
      this.layerContainer.add(layerGroup);
    });
  }

  buildObjects(map) {
    const mapId = map?.id ?? null;
    const objects = collectObjects(map);
    objects.forEach((object) => {
      const textureId = resolveObjectTextureId(object);
      const spriteEntry = textureId ? this.objectSprites.get(textureId) : null;
      const hasTexture = spriteEntry?.key && this.scene.textures.exists(spriteEntry.key);
      const textureKey = hasTexture ? spriteEntry.key : null;
      const size = object?.size ?? { width: 1, height: 1 };
      const offset = normaliseOffset(spriteEntry?.appearance?.offset);
      const scale = normaliseScale(spriteEntry?.appearance?.scale);
      const origin = spriteEntry?.composite?.origin ?? spriteEntry?.appearance?.anchor ?? { x: 0.5, y: 1 };

      const baseTileSize = spriteEntry?.sprite?.tileSize ?? spriteEntry?.appearance?.tileSize ?? this.tileSize;
      const scaleFactor = baseTileSize ? this.tileSize / baseTileSize : 1;
      const displayScale = {
        x: scaleFactor * (scale.x ?? 1),
        y: scaleFactor * (scale.y ?? 1)
      };

      const baseX = (object.position?.x ?? 0) * this.tileSize;
      const baseY = (object.position?.y ?? 0) * this.tileSize;
      const centerX = baseX + (size.width ?? 1) * this.tileSize * 0.5 + offset.x * this.tileSize;
      const bottomY = baseY + (size.height ?? 1) * this.tileSize + offset.y * this.tileSize;

      const interactive = new InteractiveObject(this.scene, {
        object,
        definition: spriteEntry?.definition ?? null,
        mapId,
        position: { x: centerX, y: bottomY },
        textureKey,
        origin,
        scale: displayScale,
        size,
        tileSize: this.tileSize,
        behaviour: object?.behaviour,
        interaction: object?.interaction
      });

      this.objectsContainer.add(interactive);
      this.interactiveObjects.add(interactive);

      interactive.on('behaviour', (payload) => {
        this.scene.events.emit('map:object-behaviour', payload, interactive);
      });

      if (object.solid) {
        this.scene.physics.add.existing(interactive, true);
        const body = /** @type {Phaser.Physics.Arcade.Body | null} */ (interactive.body);
        if (body) {
          body.setSize(this.tileSize * (size.width ?? 1), this.tileSize * (size.height ?? 1));
          body.setOffset(-this.tileSize * (size.width ?? 1) * interactive.originX, -this.tileSize * (size.height ?? 1) * interactive.originY);
        }
        this.solidObjects.add(interactive);
      }
    });
  }
}
