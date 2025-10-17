const MAP_DIRECTORY = '../../../maps';
const MAP_FILE_EXTENSION = '.map';

const toCamelCase = (rawKey) =>
  rawKey
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+([a-z0-9])/g, (_, match) => match.toUpperCase())
    .replace(/[^a-z0-9]/g, '');

const parseDimensions = (value) => {
  const [width, height] = value
    .split('x')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part) && part > 0);

  if (!width || !height) {
    return null;
  }

  return { width, height };
};

const parseCoordinate = (value) => {
  if (!value) {
    return null;
  }
  const parts = value
    .split(/[x,]/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part));

  if (parts.length !== 2) {
    return null;
  }

  return { x: parts[0], y: parts[1] };
};

const loadMapSources = () => {
  if (typeof import.meta !== 'undefined' && typeof import.meta.glob === 'function') {
    return import.meta.glob('../../../maps/*.map', { as: 'raw', eager: true });
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

const normaliseMapDefinition = (filePath, rawContents) => {
  const definition = {};
  rawContents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const [key, ...rest] = line.split(':');
      if (!key || rest.length === 0) {
        return;
      }
      const normalisedKey = toCamelCase(key);
      definition[normalisedKey] = rest.join(':').trim();
    });

  const size = parseDimensions(definition.dimensions ?? '');
  const spawn =
    parseCoordinate(definition.startingPoint ?? '') ??
    parseCoordinate(definition.spawn ?? '') ??
    (size
      ? { x: Math.floor(size.width / 2), y: Math.floor(size.height / 2) }
      : { x: 0, y: 0 });
  const doorPosition = parseCoordinate(definition.doorPosition ?? '');

  const fileName = filePath.split('/').pop() ?? 'map';
  const rawId = typeof definition.id === 'string' ? definition.id.trim() : '';
  const id = rawId || fileName.replace(/\.map$/i, '');

  const title =
    (typeof definition.title === 'string' && definition.title.trim()) ||
    (typeof definition.name === 'string' && definition.name.trim()) ||
    id;

  const width = size?.width ?? 0;
  const height = size?.height ?? 0;

  const blockedAreas = width && height
    ? [
        { x: 0, y: 0, width, height: 1 },
        { x: 0, y: height - 1, width, height: 1 },
        { x: 0, y: 0, width: 1, height },
        { x: width - 1, y: 0, width: 1, height }
      ]
    : [];

  const objects = [];
  if (doorPosition) {
    objects.push({
      id: `${id}-door`,
      label: 'Acceso principal',
      position: doorPosition,
      size: { width: 1, height: 1 },
      solid: false,
      metadata: { type: 'door' }
    });
  }

  return {
    id,
    name: title,
    biome: definition.biome ?? 'Comunidad',
    description: definition.description ?? '',
    size: size ?? { width: 0, height: 0 },
    spawn,
    blockedAreas,
    objects,
    portals: [],
    theme: {
      borderColour: definition.borderColour ?? null
    }
  };
};

const mapSources = loadMapSources();

export const MAPS = Object.entries(mapSources).map(([filePath, rawContents]) =>
  normaliseMapDefinition(filePath, rawContents)
);

if (!MAPS.length) {
  MAPS.push({
    id: 'empty-map',
    name: 'Espacio sin definir',
    biome: 'Comunidad',
    description: 'Añade archivos de mapa en ./maps para poblar el mundo.',
    size: { width: 1, height: 1 },
    spawn: { x: 0, y: 0 },
    blockedAreas: [],
    objects: [],
    portals: [],
    theme: { borderColour: null }
  });
}
