import { promises as fs } from 'node:fs';
import path from 'node:path';

const GID_MASK = 0x0fffffff;
const DEFAULT_TILE_TYPE = {
  id: 'floor',
  symbol: '.',
  name: 'Suelo',
  collides: false,
  transparent: true,
  color: '#8eb5ff',
  metadata: { default: true }
};

const parsePropertiesArray = (properties = []) => {
  const map = new Map();
  properties.forEach((property) => {
    if (!property || typeof property.name !== 'string') {
      return;
    }
    map.set(property.name, property.value);
  });
  return map;
};

const parseCoordinate = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const parts = value
    .split(/[x,\s]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
  if (parts.length !== 2) {
    return null;
  }
  return { x: parts[0], y: parts[1] };
};

const splitDoorEntries = (value = '') =>
  `${value}`
    .split(/[;,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseDoorEntry = (value) => {
  let coordinatePart = value;
  let remainder = '';
  if (value.includes('->')) {
    const [rawCoordinate, rawRemainder = ''] = value.split('->', 2);
    coordinatePart = rawCoordinate;
    remainder = rawRemainder;
  } else if (value.includes(':')) {
    const [rawCoordinate, rawRemainder = ''] = value.split(':', 2);
    coordinatePart = rawCoordinate;
    remainder = rawRemainder;
  }
  const position = parseCoordinate(coordinatePart.trim());
  if (!position) {
    throw new Error(`Coordenada de puerta inválida: "${value}"`);
  }
  remainder = (remainder ?? '').trim();
  if (!remainder) {
    return { position, targetMap: null, targetPosition: null };
  }
  if (remainder.includes('@')) {
    const [mapPart = '', coordinateTarget = ''] = remainder.split('@', 2);
    const targetMap = mapPart.trim() || null;
    const targetPosition = parseCoordinate(coordinateTarget.trim());
    if (coordinateTarget.trim() && !targetPosition) {
      throw new Error(`Coordenada destino inválida en puerta: "${value}"`);
    }
    return { position, targetMap, targetPosition };
  }
  return { position, targetMap: remainder || null, targetPosition: null };
};

const ensureUniqueId = (baseId, registry) => {
  const id = baseId || 'object';
  if (!registry.has(id)) {
    registry.set(id, 1);
    return id;
  }
  let suffix = registry.get(id);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    suffix += 1;
    const candidate = `${id}-${suffix}`;
    if (!registry.has(candidate)) {
      registry.set(id, suffix);
      registry.set(candidate, 1);
      return candidate;
    }
  }
};

const buildDoorDefinitions = (entries, { id, kind, registry }) => {
  const doors = [];
  const objects = [];
  entries.forEach((rawEntry, index) => {
    const { position, targetMap, targetPosition } = parseDoorEntry(rawEntry);
    const doorId = ensureUniqueId(`${id}-door-${kind}`, registry);
    doors.push({
      id: doorId,
      kind,
      position,
      ...(targetMap ? { targetMap } : {}),
      ...(targetPosition ? { targetPosition } : {})
    });
    if (kind === 'out') {
      const metadata = {
        type: 'door',
        objectId: 'community_door',
        instanceId: doorId,
        doorKind: kind
      };
      if (targetMap) {
        metadata.targetMap = targetMap;
      }
      if (targetPosition) {
        metadata.targetPosition = targetPosition;
      }
      const label = entries.length > 1 ? `Acceso ${index + 1}` : 'Acceso principal';
      objects.push({
        id: doorId,
        name: label,
        position,
        size: { width: 1, height: 1 },
        solid: false,
        metadata,
        objectId: 'community_door'
      });
    }
  });
  return { doors, objects };
};

const buildBlockedAreas = (size) => {
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  if (!width || !height) {
    return [];
  }
  return [
    { x: 0, y: 0, width, height: 1 },
    { x: 0, y: height - 1, width, height: 1 },
    { x: 0, y: 0, width: 1, height },
    { x: width - 1, y: 0, width: 1, height }
  ];
};

const parseJSON = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const toTileMatrix = (data = [], width, height, gidToTileId) => {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const raw = data[index] ?? 0;
      const gid = raw & GID_MASK;
      if (!gid) {
        row.push(null);
        continue;
      }
      const tileId = gidToTileId.get(gid) ?? null;
      row.push(tileId);
    }
    rows.push(row);
  }
  return rows;
};

const toBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on', 'solid'].includes(normalised)) {
      return true;
    }
    if (['false', '0', 'no', 'off', 'transparent', 'none'].includes(normalised)) {
      return false;
    }
  }
  return defaultValue;
};

const decodeTileOptions = (value) => {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const loadTileset = async (tileset, baseDirectory) => {
  if (!tileset) {
    return null;
  }
  if (tileset.source) {
    const resolved = path.resolve(baseDirectory, tileset.source);
    const raw = await fs.readFile(resolved, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      firstgid: tileset.firstgid,
      source: resolved
    };
  }
  return { ...tileset, source: null };
};

const buildTilesetIndexes = (tilesets = [], baseDirectory) => {
  const gidToTileId = new Map();
  const tileTypeMap = new Map();
  const loaders = tilesets.map((tileset) => loadTileset(tileset, baseDirectory));
  return Promise.all(loaders).then((loadedTilesets) => {
    loadedTilesets.filter(Boolean).forEach((tileset) => {
      const firstgid = Number(tileset.firstgid ?? 1);
      const tiles = Array.isArray(tileset.tiles) ? tileset.tiles : [];
      tiles.forEach((tile) => {
        const properties = parsePropertiesArray(tile.properties);
        const baseId = properties.get('phase3:id') ?? tile.type ?? `${tileset.name ?? 'tile'}-${tile.id}`;
        const tileId = typeof baseId === 'string' && baseId.trim() ? baseId.trim() : `tile-${firstgid + tile.id}`;
        const collides = toBoolean(properties.get('phase3:collides'), false);
        const transparent = toBoolean(properties.get('phase3:transparent'), true);
        const color = properties.get('phase3:color') ?? null;
        const name = properties.get('phase3:name') ?? properties.get('name') ?? tileId;
        const metadata = {};
        properties.forEach((value, key) => {
          if (key.startsWith('phase3:')) {
            const cleanKey = key.slice('phase3:'.length);
            if (['id', 'collides', 'transparent', 'color', 'name'].includes(cleanKey)) {
              return;
            }
            if (cleanKey === 'options') {
              metadata.options = decodeTileOptions(value);
              return;
            }
            metadata[cleanKey] = value;
            return;
          }
          if (['name'].includes(key)) {
            return;
          }
          metadata[key] = value;
        });
        const symbol = metadata.symbol ? `${metadata.symbol}`.slice(0, 1) : tileId.slice(0, 1) || '?';
        tileTypeMap.set(tileId, {
          id: tileId,
          symbol,
          name,
          collides,
          transparent,
          ...(color ? { color } : {}),
          ...(Object.keys(metadata).length ? { metadata } : {})
        });
        gidToTileId.set(firstgid + tile.id, tileId);
      });
    });
    if (!tileTypeMap.size) {
      tileTypeMap.set(DEFAULT_TILE_TYPE.id, { ...DEFAULT_TILE_TYPE });
    }
    return { tileTypeMap, gidToTileId };
  });
};

const normaliseLayerId = (layer, index) => {
  if (layer.id !== undefined) {
    return `${layer.id}`;
  }
  if (typeof layer.name === 'string' && layer.name.trim()) {
    return layer.name.trim();
  }
  return `layer-${index + 1}`;
};

const normaliseObjectId = (object, registry) => {
  const base =
    (typeof object.name === 'string' && object.name.trim()) ||
    (Number.isFinite(object.id) ? `object-${object.id}` : null);
  return ensureUniqueId(base ?? 'object', registry);
};

const parseObjectLayer = (layer, { tileWidth, tileHeight, registry, spawnLookup }) => {
  const objects = [];
  const layerObjects = [];
  const propertyMap = parsePropertiesArray(layer.properties);
  const order = Number.isFinite(layer.order) ? layer.order : null;
  const visible = layer.visible !== false;
  const layerId = normaliseLayerId(layer, 0);
  const layerName = typeof layer.name === 'string' && layer.name.trim() ? layer.name.trim() : layerId;
  (layer.objects ?? []).forEach((object) => {
    const properties = parsePropertiesArray(object.properties);
    const solid = toBoolean(properties.get('solid') ?? object.solid, false);
    const baseObjectId = properties.get('objectId') ?? (typeof object.type === 'string' ? object.type.trim() : null);
    const spawnId = properties.get('spawnId') ?? null;
    const tileCoordinate = properties.get('tile') ? parseCoordinate(`${properties.get('tile')}`) : null;
    const tileX = tileCoordinate?.x ?? Math.round((object.x ?? 0) / tileWidth);
    const tileY = tileCoordinate?.y ?? Math.round((object.y ?? 0) / tileHeight);
    const objectId = normaliseObjectId(object, registry);
    const name = typeof object.name === 'string' && object.name.trim() ? object.name.trim() : objectId;
    const metadata = {};
    if (baseObjectId) {
      metadata.objectId = baseObjectId;
    }
    properties.forEach((value, key) => {
      if (['objectId', 'solid', 'tile', 'spawnId'].includes(key)) {
        return;
      }
      metadata[key] = value;
    });
    const publicObject = {
      id: objectId,
      name,
      position: { x: tileX, y: tileY },
      size: { width: 1, height: 1 },
      solid,
      metadata
    };
    if (baseObjectId) {
      publicObject.objectId = baseObjectId;
    }
    objects.push(publicObject);
    layerObjects.push(publicObject);
    if (spawnId) {
      spawnLookup.set(spawnId, { x: tileX, y: tileY });
    }
  });
  return {
    layer: {
      id: layerId,
      name: layerName,
      order: order ?? 0,
      visible,
      objects: layerObjects
    },
    objects
  };
};

export const parseTiledMapDefinition = async (tiledMap, { filePath = null, baseDirectory = null } = {}) => {
  if (!tiledMap || typeof tiledMap !== 'object') {
    throw new Error('Definición de mapa Tiled inválida.');
  }
  const width = Number.parseInt(tiledMap.width, 10) || 0;
  const height = Number.parseInt(tiledMap.height, 10) || 0;
  const propertyMap = parsePropertiesArray(tiledMap.properties);
  const baseDir = baseDirectory ?? (filePath ? path.dirname(filePath) : process.cwd());
  const tilesets = Array.isArray(tiledMap.tilesets) ? tiledMap.tilesets : [];
  const { tileTypeMap, gidToTileId } = await buildTilesetIndexes(tilesets, baseDir);
  const layers = [];
  const objects = [];
  const objectLayers = [];
  const registry = new Map();
  const spawnLookup = new Map();
  (tiledMap.layers ?? []).forEach((layer, index) => {
    if (layer.type === 'tilelayer') {
      const tiles = toTileMatrix(layer.data ?? [], layer.width ?? width, layer.height ?? height, gidToTileId);
      const visible = layer.visible !== false;
      const order = Number.isFinite(layer.order) ? layer.order : index;
      const layerId = normaliseLayerId(layer, index);
      const layerName = typeof layer.name === 'string' && layer.name.trim() ? layer.name.trim() : layerId;
      layers.push({ id: layerId, name: layerName, order, visible, tiles });
    } else if (layer.type === 'objectgroup') {
      const { layer: parsedLayer, objects: parsedObjects } = parseObjectLayer(layer, {
        tileWidth: tiledMap.tilewidth ?? 64,
        tileHeight: tiledMap.tileheight ?? 64,
        registry,
        spawnLookup
      });
      objects.push(...parsedObjects);
      objectLayers.push(parsedLayer);
    }
  });
  const mapSize = { width, height };
  const spawn =
    parseCoordinate(propertyMap.get('spawn')) ??
    { x: width ? Math.floor(width / 2) : 0, y: height ? Math.floor(height / 2) : 0 };
  const doorsProperty = propertyMap.get('doors');
  const parsedDoors = parseJSON(doorsProperty) || {};
  const rawOut = Array.isArray(parsedDoors.out) ? parsedDoors.out : splitDoorEntries(parsedDoors.out ?? '');
  const rawIn = Array.isArray(parsedDoors.in) ? parsedDoors.in : splitDoorEntries(parsedDoors.in ?? '');
  const outEntries = rawOut.flatMap((entry) => splitDoorEntries(entry));
  const inEntries = rawIn.flatMap((entry) => splitDoorEntries(entry));
  const { doors: outboundDoors, objects: doorObjects } = buildDoorDefinitions(outEntries, { id: propertyMap.get('id') ?? 'map', kind: 'out', registry });
  const { doors: inboundDoors } = buildDoorDefinitions(inEntries, { id: propertyMap.get('id') ?? 'map', kind: 'in', registry });
  objects.push(...doorObjects);
  const doors = [...outboundDoors, ...inboundDoors];
  const collidableLookup = new Map();
  layers.forEach((layer) => {
    layer.tiles.forEach((row, y) => {
      row.forEach((tileId, x) => {
        if (!tileId) {
          return;
        }
        const tileType = tileTypeMap.get(tileId);
        if (tileType?.collides) {
          const key = `${x},${y}`;
          if (!collidableLookup.has(key)) {
            collidableLookup.set(key, { x, y });
          }
        }
      });
    });
  });
  const collidableTiles = Array.from(collidableLookup.values()).sort((a, b) => {
    if (a.y === b.y) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });
  const tileTypes = {};
  tileTypeMap.forEach((value, key) => {
    tileTypes[key] = { ...value };
  });
  if (!tileTypes[DEFAULT_TILE_TYPE.id]) {
    tileTypes[DEFAULT_TILE_TYPE.id] = { ...DEFAULT_TILE_TYPE };
  }
  const spawnPointsProperty = propertyMap.get('spawnPoints');
  const spawnPointsFromProperty = parseJSON(spawnPointsProperty) || {};
  spawnLookup.forEach((value, key) => {
    if (!spawnPointsFromProperty[key]) {
      spawnPointsFromProperty[key] = value;
    }
  });
  const relativePath = filePath ? path.relative(process.cwd(), filePath) : null;
  const id =
    (typeof propertyMap.get('id') === 'string' && propertyMap.get('id').trim()) ||
    (filePath ? path.basename(filePath, path.extname(filePath)) : 'map');
  const name =
    (typeof propertyMap.get('name') === 'string' && propertyMap.get('name').trim()) ||
    id;
  const biome = typeof propertyMap.get('biome') === 'string' ? propertyMap.get('biome') : 'Comunidad';
  const description = typeof propertyMap.get('description') === 'string' ? propertyMap.get('description') : '';
  const borderColour = propertyMap.get('theme.borderColour') ?? null;
  const definition = {
    id,
    name,
    biome,
    description,
    size: mapSize,
    spawn,
    spawnPoints: spawnPointsFromProperty,
    blockedAreas: buildBlockedAreas(mapSize),
    objects,
    objectLayers,
    doors,
    portals: [],
    theme: { borderColour },
    sourcePath: relativePath,
    tileTypes,
    layers,
    collidableTiles
  };
  return definition;
};

export const loadTiledMapDefinition = async (filePath, options = {}) => {
  if (!filePath) {
    throw new Error('Debes indicar la ruta del mapa Tiled.');
  }
  const resolved = path.resolve(filePath);
  const raw = await fs.readFile(resolved, 'utf-8');
  const json = JSON.parse(raw);
  const baseDirectory = options.baseDirectory ?? path.dirname(resolved);
  return await parseTiledMapDefinition(json, { filePath: resolved, baseDirectory });
};

export default loadTiledMapDefinition;
