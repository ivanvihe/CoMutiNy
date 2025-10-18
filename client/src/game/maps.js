import resolveServerUrl from '../utils/resolveServerUrl.js';
import parseMapDefinition, {
  parseCoordinate as parseCoordinateString,
  parseDimensions as parseDimensionsString
} from './map/parser.js';
import { resolveObjectDefinition, registerObjectDefinitions } from './objects/definitions.js';
import { registerSpriteGeneratorDefinitions } from './objects/spriteGenerators.js';
import normaliseAppearance from './objects/appearance.js';

const MAP_DIRECTORY = '../../../server/maps';
const MAP_FILE_EXTENSION = '.map';
const STATIC_MAP_ENDPOINT = '/maps/static';

const resolveStaticMapUrl = () => {
  const baseUrl = resolveServerUrl();

  if (!baseUrl) {
    return STATIC_MAP_ENDPOINT;
  }

  try {
    return new URL(STATIC_MAP_ENDPOINT, baseUrl).toString();
  } catch {
    const trimmedBase = `${baseUrl}`.replace(/\/+$/, '');
    return `${trimmedBase}${STATIC_MAP_ENDPOINT}`;
  }
};

const loadMapSources = () => {
  if (typeof import.meta !== 'undefined' && typeof import.meta.glob === 'function') {
    return import.meta.glob('../../../server/maps/*.map', {
      query: '?raw',
      import: 'default',
      eager: true
    });
  }

  if (typeof process !== 'undefined' && process.versions?.node && typeof require !== 'undefined') {
    // eslint-disable-next-line global-require
    const fs = require('fs');
    // eslint-disable-next-line global-require
    const path = require('path');

    const directory = path.resolve(__dirname, MAP_DIRECTORY);
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      return {};
    }

    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(MAP_FILE_EXTENSION))
      .reduce((accumulator, entry) => {
        const filePath = path.join(directory, entry.name);
        const rawContents = fs.readFileSync(filePath, 'utf-8');
        return {
          ...accumulator,
          [`${MAP_DIRECTORY}/${entry.name}`]: rawContents
        };
      }, {});
  }

  return {};
};

const sortMaps = (maps) => {
  maps.sort((a, b) => {
    const aIsInit = /(^|\/)init\.map$/i.test(a.sourcePath ?? '');
    const bIsInit = /(^|\/)init\.map$/i.test(b.sourcePath ?? '');
    if (aIsInit && !bIsInit) {
      return -1;
    }
    if (bIsInit && !aIsInit) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
  return maps;
};

const mapSources = loadMapSources();

const normalisedMaps = sortMaps(
  Object.entries(mapSources).map(([filePath, rawContents]) => {
    const parsed = parseMapDefinition(rawContents, { sourcePath: filePath });
    const registry = new Map();
    const objects = normaliseServerObjects(parsed.objects, { registry });
    const objectLookup = new Map(objects.map((object) => [object.id, object]));

    const objectLayers = Array.isArray(parsed.objectLayers)
      ? parsed.objectLayers.map((layer, index) => {
          const layerId = typeof layer.id === 'string' && layer.id.trim()
            ? layer.id.trim()
            : `layer-${index + 1}`;
          const order = Number.isFinite(layer.order) ? layer.order : index;
          const visible = layer.visible !== false;
          const name = typeof layer.name === 'string' && layer.name.trim() ? layer.name.trim() : layerId;
          const normalised = normaliseServerObjects(layer.objects, {
            registry,
            layer: { id: layerId, name, order, visible }
          });
          const layerObjects = normalised.map((object) => objectLookup.get(object.id) ?? object);
          return {
            id: layerId,
            name,
            order,
            visible,
            objects: layerObjects
          };
        })
      : [];

    return {
      ...parsed,
      objects,
      objectLayers
    };
  })
);

export const MAPS = normalisedMaps;

if (!MAPS.length) {
  MAPS.push({
    id: 'empty-map',
    name: 'Espacio sin definir',
    biome: 'Comunidad',
    description: 'Añade archivos de mapa en ./server/maps para poblar el mundo.',
    size: { width: 1, height: 1 },
    spawn: { x: 0, y: 0 },
    blockedAreas: [],
    objects: [],
    doors: [],
    portals: [],
    theme: { borderColour: null },
    sourcePath: null,
    tileTypes: {
      floor: {
        id: 'floor',
        symbol: '.',
        name: 'Suelo',
        collides: false,
        transparent: true,
        color: '#8eb5ff',
        metadata: { default: true }
      }
    },
    layers: [
      {
        id: 'ground',
        name: 'Ground',
        order: 0,
        visible: true,
        tiles: [['floor']]
      }
    ],
    collidableTiles: []
  });
}

const selectDefaultMap = (maps) =>
  maps.find((map) => /(^|\/)init\.map$/i.test(map.sourcePath ?? '')) ?? maps[0] ?? null;

export const DEFAULT_MAP_ID = selectDefaultMap(MAPS)?.id ?? 'empty-map';

export const resolveDefaultMapId = (maps = MAPS) => {
  const collection = Array.isArray(maps) ? [...maps] : [];
  return selectDefaultMap(collection)?.id ?? 'empty-map';
};

const normaliseMapSize = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const width = Number.parseInt(value.width ?? value.w ?? value[0], 10);
    const height = Number.parseInt(value.height ?? value.h ?? value[1], 10);
    return {
      width: Number.isFinite(width) && width > 0 ? width : 0,
      height: Number.isFinite(height) && height > 0 ? height : 0
    };
  }

  if (typeof value === 'string') {
    const parsed = parseDimensionsString(value);
    if (parsed) {
      return parsed;
    }
  }

  if (Array.isArray(value) && value.length >= 2) {
    const width = Number.parseInt(value[0], 10);
    const height = Number.parseInt(value[1], 10);
    return {
      width: Number.isFinite(width) && width > 0 ? width : 0,
      height: Number.isFinite(height) && height > 0 ? height : 0
    };
  }

  return { width: 0, height: 0 };
};

const normaliseCoordinateInput = (value, fallback = null) => {
  if (typeof value === 'string') {
    return parseCoordinateString(value) ?? fallback;
  }

  if (Array.isArray(value) && value.length >= 2) {
    const x = Number.parseInt(value[0], 10);
    const y = Number.parseInt(value[1], 10);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }

  if (value && typeof value === 'object') {
    const x = Number.parseInt(value.x ?? value.col ?? value.column ?? value[0], 10);
    const y = Number.parseInt(value.y ?? value.row ?? value[1], 10);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }

  return fallback;
};

const ensureUniqueObjectId = (baseId, registry) => {
  const trimmed = typeof baseId === 'string' ? baseId.trim() : '';
  if (!trimmed) {
    return null;
  }

  if (!registry.has(trimmed)) {
    registry.set(trimmed, 1);
    return trimmed;
  }

  let suffix = registry.get(trimmed);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    suffix += 1;
    const candidate = `${trimmed}-${suffix}`;
    if (!registry.has(candidate)) {
      registry.set(trimmed, suffix);
      registry.set(candidate, 1);
      return candidate;
    }
  }
};

const normaliseObjectSize = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const width = Number.parseInt(value.width ?? value.w ?? value[0], 10);
    const height = Number.parseInt(value.height ?? value.h ?? value[1], 10);
    return {
      width: Number.isFinite(width) && width > 0 ? width : 1,
      height: Number.isFinite(height) && height > 0 ? height : 1
    };
  }

  if (typeof value === 'string') {
    const parsed = parseDimensionsString(value);
    if (parsed) {
      return {
        width: Math.max(parsed.width, 1),
        height: Math.max(parsed.height, 1)
      };
    }
  }

  if (Array.isArray(value) && value.length >= 2) {
    const width = Number.parseInt(value[0], 10);
    const height = Number.parseInt(value[1], 10);
    return {
      width: Number.isFinite(width) && width > 0 ? width : 1,
      height: Number.isFinite(height) && height > 0 ? height : 1
    };
  }

  return { width: 1, height: 1 };
};

const resolveNumeric = (value) => {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveBoolean = (value, fallback = true) => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalised)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalised)) {
      return false;
    }
  }

  return Boolean(value);
};

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

const normaliseAnchor3D = (value, fallback = { x: 0.5, y: 1, z: 0 }) => {
  if (value === undefined || value === null) {
    return { ...fallback };
  }

  if (typeof value === 'number') {
    const numeric = clamp(toFiniteNumber(value, fallback.x), 0, 1);
    return { x: numeric, y: numeric, z: fallback.z ?? 0 };
  }

  if (Array.isArray(value) && value.length) {
    const x = clamp(toFiniteNumber(value[0], fallback.x), 0, 1);
    const y = clamp(toFiniteNumber(value[1] ?? value[0], fallback.y), 0, 1.5);
    const z = clamp(toFiniteNumber(value[2] ?? fallback.z ?? 0, fallback.z ?? 0), -8, 8);
    return { x, y, z };
  }

  if (typeof value === 'object') {
    const x = clamp(toFiniteNumber(value.x ?? value[0], fallback.x), 0, 1);
    const y = clamp(toFiniteNumber(value.y ?? value[1], fallback.y), 0, 1.5);
    const z = clamp(toFiniteNumber(value.z ?? value[2] ?? fallback.z ?? 0, fallback.z ?? 0), -8, 8);
    return { x, y, z };
  }

  return { ...fallback };
};

const normaliseVolumeSpec = (value, fallback = { height: 1, anchor: { x: 0.5, y: 1, z: 0 } }) => {
  const fallbackHeight = Number.isFinite(fallback?.height) ? Math.max(fallback.height, 0) : 0;
  const fallbackAnchor = fallback?.anchor ?? { x: 0.5, y: 1, z: 0 };

  if (value === undefined || value === null) {
    return { height: fallbackHeight, anchor: { ...fallbackAnchor } };
  }

  if (typeof value === 'number') {
    const height = Math.max(toFiniteNumber(value, fallbackHeight), 0);
    return { height, anchor: { ...fallbackAnchor } };
  }

  if (Array.isArray(value) && value.length) {
    const height = Math.max(toFiniteNumber(value[0], fallbackHeight), 0);
    const anchor = normaliseAnchor3D(value[1], fallbackAnchor);
    return { height, anchor };
  }

  if (typeof value === 'object') {
    const heightCandidate =
      value.height ?? value.z ?? value.depth ?? value.levels ?? value.size ?? fallbackHeight;
    const height = Math.max(toFiniteNumber(heightCandidate, fallbackHeight), 0);
    const anchor = normaliseAnchor3D(value.anchor ?? value.pivot ?? value.origin, fallbackAnchor);
    return { height, anchor };
  }

  return { height: fallbackHeight, anchor: { ...fallbackAnchor } };
};

function normaliseServerObject(object, registry, options = {}) {
  if (!object || typeof object !== 'object') {
    return null;
  }

  const metadata =
    object.metadata && typeof object.metadata === 'object' && !Array.isArray(object.metadata)
      ? { ...object.metadata }
      : {};

  const objectId =
    typeof object.objectId === 'string' && object.objectId.trim()
      ? object.objectId.trim()
      : typeof metadata.objectId === 'string' && metadata.objectId.trim()
        ? metadata.objectId.trim()
        : null;

  if (objectId && !metadata.objectId) {
    metadata.objectId = objectId;
  }

  const definition = objectId ? resolveObjectDefinition(objectId) : null;

  const definitionMetadata =
    definition?.metadata && typeof definition.metadata === 'object' && !Array.isArray(definition.metadata)
      ? { ...definition.metadata }
      : {};
  const mergedMetadata = { ...definitionMetadata, ...metadata };

  const baseId =
    (typeof object.id === 'string' && object.id.trim()) ||
    (typeof mergedMetadata.instanceId === 'string' && mergedMetadata.instanceId.trim()) ||
    (objectId ? `${objectId}` : '');

  const id = ensureUniqueObjectId(baseId, registry);
  if (!id) {
    return null;
  }

  if (!mergedMetadata.instanceId) {
    mergedMetadata.instanceId = id;
  }
  if (baseId && baseId !== id) {
    mergedMetadata.originalInstanceId = mergedMetadata.originalInstanceId ?? baseId;
  }

  const name =
    (typeof object.name === 'string' && object.name.trim()) ||
    (typeof object.label === 'string' && object.label.trim()) ||
    definition?.name ||
    id;

  const position =
    normaliseCoordinateInput(object.position, null) ??
    normaliseCoordinateInput({ x: object.x, y: object.y }, null);

  if (!position) {
    return null;
  }

  const size = normaliseObjectSize(object.size ?? { width: object.width, height: object.height });
  const solid = Boolean(object.solid);

  const description =
    (typeof object.description === 'string' && object.description.trim()) ||
    (typeof definition?.description === 'string' && definition.description.trim()) ||
    '';

  const payload = {
    id,
    name,
    label: name,
    position,
    size,
    solid,
    metadata: mergedMetadata
  };

  if (objectId) {
    payload.objectId = objectId;
  }

  if (description) {
    payload.description = description;
  }

  if (Array.isArray(object.palette)) {
    payload.palette = [...object.palette];
  } else if (Array.isArray(definition?.metadata?.palette)) {
    payload.palette = [...definition.metadata.palette];
  }

  if (Array.isArray(object.actions)) {
    payload.actions = object.actions.map((action) => ({ ...action }));
  }

  const appearanceSource =
    object.appearance ?? mergedMetadata.appearance ?? definition?.appearance ?? null;
  const appearance = normaliseAppearance(appearanceSource, { fallbackSize: size });
  if (appearance) {
    payload.appearance = appearance;
    delete mergedMetadata.appearance;
  }

  const defaultVolume = normaliseVolumeSpec(
    definition?.volume,
    {
      height: Math.max(
        Number.isFinite(definition?.volume?.height) ? definition.volume.height : size.height ?? 1,
        1
      ),
      anchor: normaliseAnchor3D(appearance?.anchor ?? definition?.volume?.anchor, { x: 0.5, y: 1, z: 0 })
    }
  );

  const volumeCandidate =
    object.volume ??
    object.verticalVolume ??
    object.heightVolume ??
    mergedMetadata.volume ??
    object.height ??
    null;

  const volume = normaliseVolumeSpec(volumeCandidate, defaultVolume);
  if (mergedMetadata.volume) {
    delete mergedMetadata.volume;
  }
  if (volume) {
    payload.volume = volume;
  }

  const layerContext =
    options.layer && typeof options.layer === 'object' && !Array.isArray(options.layer)
      ? options.layer
      : null;

  const candidateLayerIds = [
    typeof object.layerId === 'string' ? object.layerId.trim() : '',
    typeof object.layer?.id === 'string' ? object.layer.id.trim() : '',
    typeof layerContext?.id === 'string' ? layerContext.id : ''
  ];
  const layerId = candidateLayerIds.find((value) => value) || null;

  const candidateOrders = [
    resolveNumeric(object.layerOrder),
    resolveNumeric(object.layer?.order),
    resolveNumeric(layerContext?.order)
  ];
  const layerOrder = candidateOrders.find((value) => value !== null) ?? null;

  let layerVisible;
  const visibilityCandidates = [
    object.layerVisible,
    object.layer?.visible,
    layerContext?.visible
  ];
  for (const candidate of visibilityCandidates) {
    if (candidate !== undefined && candidate !== null) {
      layerVisible = resolveBoolean(candidate, true);
      break;
    }
  }
  if (layerVisible === undefined) {
    layerVisible = true;
  }

  const candidateNames = [
    typeof object.layer?.name === 'string' ? object.layer.name.trim() : '',
    typeof layerContext?.name === 'string' ? layerContext.name : '',
    layerId ?? ''
  ];
  const layerName = candidateNames.find((value) => value) || null;

  if (layerId) {
    payload.layerId = layerId;
  }

  if (layerOrder !== null) {
    payload.layerOrder = layerOrder;
  }

  if (layerVisible !== undefined) {
    payload.layerVisible = layerVisible;
  }

  if (layerId || layerName || layerOrder !== null || layerVisible !== true) {
    payload.layer = {
      ...(layerId ? { id: layerId } : {}),
      ...(layerName ? { name: layerName } : {}),
      ...(layerOrder !== null ? { order: layerOrder } : {}),
      visible: layerVisible
    };
  }

  return payload;
}

function normaliseServerObjects(objects, { registry = new Map(), layer = null } = {}) {
  if (!Array.isArray(objects)) {
    return [];
  }

  let layerContext = null;
  if (layer && typeof layer === 'object' && !Array.isArray(layer)) {
    const id = typeof layer.id === 'string' && layer.id.trim() ? layer.id.trim() : null;
    const name = typeof layer.name === 'string' && layer.name.trim() ? layer.name.trim() : null;
    const order = resolveNumeric(layer.order);
    const visible = resolveBoolean(layer.visible, true);
    layerContext = {
      ...(id ? { id } : {}),
      ...(name ? { name } : {}),
      ...(order !== null ? { order } : {}),
      visible
    };
  }

  return objects
    .map((object) => normaliseServerObject(object, registry, { layer: layerContext }))
    .filter(Boolean);
}

const normaliseDoorEntry = (door) => {
  if (!door || typeof door !== 'object') {
    return null;
  }

  const id = typeof door.id === 'string' ? door.id.trim() : '';
  const kind = typeof door.kind === 'string' ? door.kind.trim().toLowerCase() : '';
  const position = normaliseCoordinateInput(door.position, null);

  if (!id || !position || (kind !== 'in' && kind !== 'out')) {
    return null;
  }

  const targetMap =
    typeof door.targetMap === 'string' && door.targetMap.trim()
      ? door.targetMap.trim()
      : null;
  const targetPosition = normaliseCoordinateInput(door.targetPosition, null);

  return {
    id,
    kind,
    position,
    ...(targetMap ? { targetMap } : {}),
    ...(targetPosition ? { targetPosition } : {})
  };
};

const normaliseDoorCollection = (doors) => {
  if (!Array.isArray(doors)) {
    return [];
  }

  return doors.map((door) => normaliseDoorEntry(door)).filter(Boolean);
};

const normaliseTheme = (theme) => {
  const candidate = theme && typeof theme === 'object' ? theme : {};
  const borderColour =
    typeof candidate.borderColour === 'string' && candidate.borderColour.trim()
      ? candidate.borderColour.trim()
      : typeof candidate.borderColor === 'string' && candidate.borderColor.trim()
        ? candidate.borderColor.trim()
        : null;

  return { borderColour };
};

const buildBlockedAreasFromServer = (areas) => {
  if (!Array.isArray(areas)) {
    return [];
  }

  return areas
    .map((area) => {
      if (!area || typeof area !== 'object') {
        return null;
      }
      const x = Number.parseInt(area.x ?? area.col ?? area.column, 10);
      const y = Number.parseInt(area.y ?? area.row, 10);
      const width = Number.parseInt(area.width ?? area.w, 10);
      const height = Number.parseInt(area.height ?? area.h, 10);

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
      }

      return {
        x,
        y,
        width: Math.max(width, 1),
        height: Math.max(height, 1)
      };
    })
    .filter(Boolean);
};

const normaliseServerMap = (definition) => {
  if (!definition || typeof definition !== 'object') {
    return null;
  }

  const size = normaliseMapSize(definition.size ?? definition.dimensions);

  const spawn =
    normaliseCoordinateInput(definition.spawn, null) ??
    normaliseCoordinateInput(definition.spawnPoint, null) ??
    normaliseCoordinateInput(definition.startingPoint, null) ??
    { x: Math.floor(size.width / 2) || 0, y: Math.floor(size.height / 2) || 0 };

  const registry = new Map();
  const objects = normaliseServerObjects(definition.objects, { registry });
  const objectLookup = new Map(objects.map((object) => [object.id, object]));

  const objectLayers = Array.isArray(definition.objectLayers)
    ? definition.objectLayers
        .map((layer, index) => {
          const layerId = typeof layer.id === 'string' && layer.id.trim()
            ? layer.id.trim()
            : `layer-${index + 1}`;
          const order = Number.isFinite(layer.order) ? layer.order : index;
          const visible = layer.visible !== false;
          const name = typeof layer.name === 'string' && layer.name.trim() ? layer.name.trim() : layerId;
          const normalised = normaliseServerObjects(layer.objects, {
            registry,
            layer: { id: layerId, name, order, visible }
          });
          const layerObjects = normalised.map((object) => objectLookup.get(object.id) ?? object);
          return {
            id: layerId,
            name,
            order,
            visible,
            objects: layerObjects
          };
        })
    : [];

  const tileLayers = Array.isArray(definition.layers)
    ? definition.layers
        .map((layer, index) => {
          if (!layer || !Array.isArray(layer.tiles)) {
            return null;
          }
          const identifier =
            typeof layer.id === 'string' && layer.id.trim() ? layer.id.trim() : `layer-${index + 1}`;
          const name =
            typeof layer.name === 'string' && layer.name.trim() ? layer.name.trim() : identifier;
          const order = Number.isFinite(layer.order) ? layer.order : index;
          const visible = resolveBoolean(layer.visible, true);
          const placement = normaliseLayerPlacement(layer.placement ?? layer.mode ?? layer.type);
          const elevation = Number.isFinite(layer.elevation)
            ? layer.elevation
            : normaliseLayerElevation(layer.height ?? layer.level ?? layer.offset);
          const opacity = normaliseLayerOpacity(layer.opacity ?? layer.alpha);
          const tiles = Array.isArray(layer.tiles)
            ? layer.tiles.map((row) =>
                Array.isArray(row) ? row.map((tile) => (tile === undefined ? null : tile)) : []
              )
            : [];
          if (!tiles.length) {
            return null;
          }
          return {
            id: identifier,
            name,
            order,
            visible,
            placement,
            elevation,
            ...(opacity !== null ? { opacity } : {}),
            tiles
          };
        })
        .filter(Boolean)
        .sort((a, b) => (a.order === b.order ? a.id.localeCompare(b.id) : a.order - b.order))
    : [];

  const tileTypes = (() => {
    if (!definition.tileTypes || typeof definition.tileTypes !== 'object') {
      return {};
    }

    const result = {};
    Object.entries(definition.tileTypes).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') {
        return;
      }
      const payload = {
        id: value.id ?? key,
        name: value.name ?? value.label ?? key,
        collides: resolveBoolean(value.collides, false),
        transparent: resolveBoolean(value.transparent, true)
      };
      if (value.symbol) {
        payload.symbol = value.symbol;
      }
      if (value.color) {
        payload.color = value.color;
      }
      if (value.metadata && typeof value.metadata === 'object' && !Array.isArray(value.metadata)) {
        payload.metadata = { ...value.metadata };
      }
      result[key] = payload;
    });
    return result;
  })();

  const collidableTiles = Array.isArray(definition.collidableTiles)
    ? definition.collidableTiles
        .map((position) => {
          if (!position || typeof position !== 'object') {
            return null;
          }
          const x = Number.parseInt(position.x ?? position.col, 10);
          const y = Number.parseInt(position.y ?? position.row, 10);
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
          }
          return { x, y };
        })
        .filter(Boolean)
    : [];

  const playerLayerOrderCandidate = Number.parseFloat(
    definition.playerLayerOrder ?? definition.playerLayer?.order
  );
  const playerLayerOrder = Number.isFinite(playerLayerOrderCandidate)
    ? playerLayerOrderCandidate
    : null;

  return {
    id: definition.id ?? '',
    name: definition.name ?? definition.title ?? definition.id ?? 'map',
    biome: definition.biome ?? 'Comunidad',
    description: definition.description ?? '',
    size,
    spawn,
    blockedAreas: buildBlockedAreasFromServer(definition.blockedAreas),
    objects,
    objectLayers,
    layers: tileLayers,
    tileTypes,
    collidableTiles,
    doors: normaliseDoorCollection(definition.doors),
    portals: Array.isArray(definition.portals) ? definition.portals : [],
    theme: normaliseTheme(definition.theme),
    sourcePath: definition.sourcePath ?? null,
    ...(playerLayerOrder !== null ? { playerLayerOrder } : {})
  };
};

export const fetchServerMaps = async ({ signal } = {}) => {
  if (typeof fetch !== 'function') {
    return { maps: [], objectDefinitions: [], canvasDefinitions: [] };
  }

  try {
    const endpoint = resolveStaticMapUrl();
    const response = await fetch(endpoint, { signal });
    if (!response.ok) {
      return { maps: [], objectDefinitions: [], canvasDefinitions: [] };
    }

    const payload = await response.json();

    const definitions = Array.isArray(payload?.objectDefinitions)
      ? payload.objectDefinitions.filter((entry) => entry && typeof entry === 'object')
      : [];

    if (definitions.length) {
      try {
        registerObjectDefinitions(definitions);
      } catch (error) {
        console.warn('[maps] No se pudieron registrar las definiciones remotas de objetos', error);
      }
    }

    const canvasDefinitions = Array.isArray(payload?.canvasDefinitions)
      ? payload.canvasDefinitions.filter((entry) => entry && typeof entry === 'object')
      : [];

    if (canvasDefinitions.length) {
      try {
        registerSpriteGeneratorDefinitions(canvasDefinitions);
      } catch (error) {
        console.warn('[maps] No se pudieron registrar las definiciones Canvas remotas', error);
      }
    }

    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.maps)
        ? payload.maps
        : [];

    const normalised = items
      .map((definition) => normaliseServerMap(definition))
      .filter((map) => map && map.id);

    return {
      maps: sortMaps(normalised),
      objectDefinitions: definitions,
      canvasDefinitions
    };
  } catch (error) {
    return { maps: [], objectDefinitions: [], canvasDefinitions: [] };
  }
};
