import resolveServerUrl from '../utils/resolveServerUrl.js';
import parseMapDefinition, {
  parseCoordinate as parseCoordinateString,
  parseDimensions as parseDimensionsString
} from './map/parser.js';
import { resolveObjectDefinition } from './objects/definitions.js';
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

const mapSources = loadMapSources();

const normalisedMaps = Object.entries(mapSources).map(([filePath, rawContents]) =>
  parseMapDefinition(rawContents, { sourcePath: filePath })
);

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

sortMaps(normalisedMaps);

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

const normaliseServerObject = (object, registry) => {
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

  return payload;
};

const normaliseServerObjects = (objects) => {
  if (!Array.isArray(objects)) {
    return [];
  }

  const registry = new Map();
  return objects
    .map((object) => normaliseServerObject(object, registry))
    .filter(Boolean);
};

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

  return {
    id: definition.id ?? '',
    name: definition.name ?? definition.title ?? definition.id ?? 'map',
    biome: definition.biome ?? 'Comunidad',
    description: definition.description ?? '',
    size,
    spawn,
    blockedAreas: buildBlockedAreasFromServer(definition.blockedAreas),
    objects: normaliseServerObjects(definition.objects),
    doors: normaliseDoorCollection(definition.doors),
    portals: Array.isArray(definition.portals) ? definition.portals : [],
    theme: normaliseTheme(definition.theme),
    sourcePath: definition.sourcePath ?? null
  };
};

export const fetchServerMaps = async ({ signal } = {}) => {
  if (typeof fetch !== 'function') {
    return [];
  }

  try {
    const endpoint = resolveStaticMapUrl();
    const response = await fetch(endpoint, { signal });
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.maps)
        ? payload.maps
        : [];

    const normalised = items
      .map((definition) => normaliseServerMap(definition))
      .filter((map) => map && map.id);

    return sortMaps(normalised);
  } catch (error) {
    return [];
  }
};
