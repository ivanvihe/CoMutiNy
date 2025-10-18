import tilemapConfig from '../../../config/tilemap.json';

const SECTION_PATTERN = /^\[(?<name>[^\]]+)]$/;
const OBJECT_PATTERN = new RegExp(
  String.raw`^(?:-\s*)?(?<solid>!)?(?<reference>[A-Za-z0-9_.-]+(?:#[A-Za-z0-9_.-]+)?)\s*(?:@|:)?\s*(?<x>\d+)(?:\s*(?:[x,]\s*|\s+)(?<y>\d+))(?:\s*\|\s*(?<label>.+))?$`
);

const toCamelCase = (rawKey = '') =>
  rawKey
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+([a-z0-9])/g, (_, match) => match.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');

const normaliseSectionKey = (value = '') =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'meta';

const parseSections = (rawContents) => {
  const sections = new Map([
    ['meta', []]
  ]);
  let current = 'meta';

  rawContents.split(/\r?\n/).forEach((rawLine) => {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      return;
    }

    const inlineComment = /\s+#(?![0-9A-Fa-f])/.exec(line);
    if (inlineComment) {
      line = line.slice(0, inlineComment.index).trim();
      if (!line) {
        return;
      }
    }

    const sectionMatch = SECTION_PATTERN.exec(line);
    if (sectionMatch?.groups?.name) {
      current = normaliseSectionKey(sectionMatch.groups.name);
      if (!sections.has(current)) {
        sections.set(current, []);
      }
      return;
    }

    if (!sections.has(current)) {
      sections.set(current, []);
    }
    sections.get(current).push(line);
  });

  return sections;
};

const parseInteger = (value, { positive = false } = {}) => {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) {
    return null;
  }
  if (positive && number <= 0) {
    return null;
  }
  return number;
};

export const parseDimensions = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const parts = value
    .split('x')
    .map((part) => parseInteger(part, { positive: true }))
    .filter((part) => Number.isFinite(part));

  if (parts.length !== 2) {
    return null;
  }

  return { width: parts[0], height: parts[1] };
};

export const parseCoordinate = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const withSeparators = value
    .split(/[x,]/)
    .map((part) => parseInteger(part))
    .filter((part) => Number.isFinite(part));

  if (withSeparators.length === 2) {
    return { x: withSeparators[0], y: withSeparators[1] };
  }

  const fallback = value
    .split(/\s+/)
    .map((part) => parseInteger(part))
    .filter((part) => Number.isFinite(part));

  if (fallback.length === 2) {
    return { x: fallback[0], y: fallback[1] };
  }

  return null;
};

const normaliseHexColour = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{3,6}$/.test(withoutHash)) {
    return null;
  }

  if (withoutHash.length === 3) {
    return `#${withoutHash
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`.toLowerCase();
  }

  return `#${withoutHash.toLowerCase()}`;
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
      ...(targetPosition ? { targetPosition } : {}),
    });

    if (kind === 'out') {
      const label = entries.length > 1 ? `Acceso ${index + 1}` : 'Acceso principal';
      objects.push({
        id: doorId,
        name: label,
        label,
        position,
        size: { width: 1, height: 1 },
        solid: false,
        metadata: {
          type: 'door',
          objectId: 'community_door',
          instanceId: doorId,
          doorKind: kind,
          ...(targetMap ? { targetMap } : {}),
          ...(targetPosition ? { targetPosition } : {}),
        },
        objectId: 'community_door'
      });
    }
  });

  return { doors, objects };
};

const ensureUniqueId = (baseId, registry) => {
  if (!registry.has(baseId)) {
    registry.set(baseId, 1);
    return baseId;
  }

  let suffix = registry.get(baseId);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    suffix += 1;
    const candidate = `${baseId}-${suffix}`;
    if (!registry.has(candidate)) {
      registry.set(baseId, suffix);
      registry.set(candidate, 1);
      return candidate;
    }
  }
};

const parseObjectLine = (line, { registry }) => {
  const match = OBJECT_PATTERN.exec(line);
  if (!match?.groups?.y) {
    throw new Error(`Entrada de objeto inválida: "${line}"`);
  }

  const reference = match.groups.reference;
  const [objectId, rawInstance] = reference.split('#', 2);
  const baseInstance = (rawInstance || objectId || '').trim();

  if (!objectId) {
    throw new Error(`Objeto sin identificador en: "${line}"`);
  }

  const instanceId = ensureUniqueId(baseInstance || objectId, registry);
  const x = Number.parseInt(match.groups.x, 10);
  const y = Number.parseInt(match.groups.y, 10);
  const solid = Boolean(match.groups.solid);
  const label = match.groups.label ? match.groups.label.trim() : '';

  const metadata = { objectId };
  if (rawInstance) {
    metadata.originalInstanceId = rawInstance.trim();
  }
  metadata.instanceId = instanceId;

  const name = label || instanceId;

  return {
    id: instanceId,
    name,
    label: name,
    solid,
    position: { x, y },
    size: { width: 1, height: 1 },
    metadata,
    objectId
  };
};

const parseObjects = (lines, { registry }) => {
  const objects = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      return;
    }

    try {
      objects.push(parseObjectLine(line, { registry }));
    } catch (error) {
      throw new Error(`Error al procesar el objeto #${index + 1}: ${error.message}`);
    }
  });

  return objects;
};

const parseBoolean = (value, defaultValue = false) => {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  const normalised = `${value}`.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', 'solid'].includes(normalised)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off', 'transparent', 'none'].includes(normalised)) {
    return false;
  }
  return defaultValue;
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

const parseLayerElevation = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseLayerOpacity = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.min(Math.max(numeric, 0), 1);
};

const buildBaseTileDefinitions = () => {
  const tileTypes = new Map();
  const symbolMap = new Map();

  const tiles = Array.isArray(tilemapConfig?.tiles) ? tilemapConfig.tiles : [];
  tiles.forEach((tile) => {
    if (!tile || typeof tile !== 'object') {
      return;
    }

    const id = typeof tile.id === 'string' ? tile.id.trim() : '';
    if (!id) {
      return;
    }

    const symbol = typeof tile.symbol === 'string' ? tile.symbol.trim() : null;
    const name = typeof tile.name === 'string' && tile.name.trim() ? tile.name.trim() : id;
    const collides = tile.collides === true;
    const transparent = tile.transparent !== false;
    const color = typeof tile.color === 'string' && tile.color.trim() ? tile.color.trim() : null;
    const category = typeof tile.category === 'string' && tile.category.trim() ? tile.category.trim() : null;

    const metadata =
      tile.metadata && typeof tile.metadata === 'object' && !Array.isArray(tile.metadata)
        ? { ...tile.metadata }
        : {};

    if (typeof tile.tileset === 'string' && !metadata.tilesetId) {
      metadata.tilesetId = tile.tileset;
    }
    if (typeof tile.tilesetTile === 'string' && !metadata.tilesetTile) {
      metadata.tilesetTile = tile.tilesetTile;
    }
    if (category && !metadata.category) {
      metadata.category = category;
    }

    tileTypes.set(id, {
      id,
      symbol,
      name,
      collides,
      transparent,
      ...(color ? { color } : {}),
      metadata
    });

    if (symbol) {
      if (!symbolMap.has(symbol)) {
        symbolMap.set(symbol, id);
      }
    }
  });

  return { tileTypes, symbolMap };
};

const BASE_TILE_DEFINITIONS = buildBaseTileDefinitions();

const cloneBaseTileDefinitions = () => {
  const tileTypes = new Map();
  const symbolMap = new Map();

  BASE_TILE_DEFINITIONS.tileTypes.forEach((value, key) => {
    tileTypes.set(key, {
      ...value,
      metadata: value.metadata ? { ...value.metadata } : {}
    });
  });

  BASE_TILE_DEFINITIONS.symbolMap.forEach((value, key) => {
    symbolMap.set(key, value);
  });

  return { tileTypes, symbolMap };
};

const DEFAULT_TILE_TYPE = {
  id: 'floor',
  symbol: '.',
  name: 'Suelo',
  collides: false,
  transparent: true,
  color: '#8eb5ff',
  metadata: { default: true }
};

const parseTileDefinitions = (lines = []) => {
  const { tileTypes, symbolMap } = cloneBaseTileDefinitions();

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      return;
    }

    const [rawSymbol, remainder] = line.split('=', 2);
    const symbol = rawSymbol.trim();
    if (!symbol) {
      throw new Error(`Definición de tile sin símbolo: "${line}"`);
    }

    const tokens = remainder
      .split(';')
      .map((token) => token.trim())
      .filter(Boolean);

    if (!tokens.length) {
      throw new Error(`Definición de tile incompleta: "${line}"`);
    }

    const [tileId, ...propertyTokens] = tokens;
    if (!tileId) {
      throw new Error(`Tile sin identificador: "${line}"`);
    }

    const properties = new Map();
    propertyTokens.forEach((token) => {
      if (token.includes('=')) {
        const [key, value] = token.split('=', 2);
        properties.set(normaliseSectionKey(key), value.trim());
      } else {
        properties.set(normaliseSectionKey(token), 'true');
      }
    });

    const name = properties.get('name') ?? properties.get('label') ?? tileId;
    const collides = parseBoolean(
      properties.get('collides') ?? properties.get('solid') ?? properties.get('collision'),
      false
    );
    const transparent = parseBoolean(properties.get('transparent'), true);
    const color = properties.get('color') ?? properties.get('colour') ?? null;

    const baseDefinition = tileTypes.get(tileId);
    const metadata = baseDefinition?.metadata ? { ...baseDefinition.metadata } : {};
    properties.forEach((value, key) => {
      if (
        ![
          'name',
          'label',
          'collides',
          'solid',
          'collision',
          'transparent',
          'color',
          'colour'
        ].includes(key)
      ) {
        metadata[key] = value;
      }
    });

    if (baseDefinition?.symbol && baseDefinition.symbol !== symbol) {
      if (symbolMap.get(baseDefinition.symbol) === tileId) {
        symbolMap.delete(baseDefinition.symbol);
      }
    }

    if (symbol) {
      const existingSymbolTarget = symbolMap.get(symbol);
      if (existingSymbolTarget && existingSymbolTarget !== tileId) {
        throw new Error(
          `El símbolo "${symbol}" ya está asignado a "${symbolMap.get(symbol)}"`
        );
      }
    }

    tileTypes.set(tileId, {
      ...(baseDefinition ? { ...baseDefinition } : {}),
      id: tileId,
      symbol,
      name,
      collides,
      transparent,
      ...(color ? { color } : {}),
      metadata
    });

    if (symbol) {
      symbolMap.set(symbol, tileId);
    }
  });

  if (!tileTypes.size) {
    tileTypes.set(DEFAULT_TILE_TYPE.id, { ...DEFAULT_TILE_TYPE });
    symbolMap.set(DEFAULT_TILE_TYPE.symbol, DEFAULT_TILE_TYPE.id);
  }

  return { tileTypes, symbolMap };
};

const tokeniseLayerRow = (line) => {
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && tokens[0].length > 1) {
    return [...tokens[0]];
  }
  if (!tokens.length && line.trim()) {
    return [...line.trim()];
  }
  return tokens;
};

const resolveTileReference = (token, { tileTypes, symbolMap }) => {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const lowered = trimmed.toLowerCase();
  if (['none', 'empty', 'void', 'transparent'].includes(lowered)) {
    return null;
  }

  if (symbolMap.has(trimmed)) {
    return symbolMap.get(trimmed);
  }

  if (tileTypes.has(trimmed)) {
    return trimmed;
  }

  throw new Error(`Tile desconocido en capa: "${token}"`);
};

const parseKeyValueLines = (lines = []) => {
  const result = new Map();
  lines.forEach((line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      return;
    }
    const key = normaliseSectionKey(line.slice(0, separatorIndex));
    if (!key) {
      return;
    }
    const value = line.slice(separatorIndex + 1).trim();
    result.set(key, value);
  });
  return result;
};

const parseLayerSections = (sections, { tileTypes, symbolMap }) => {
  const layers = [];

  sections.forEach((lines, key) => {
    if (!key.startsWith('layer')) {
      return;
    }

    const properties = parseKeyValueLines(lines.filter((line) => line.includes(':')));
    const rawRows = lines.filter((line) => !line.includes(':'));

    const rows = [];
    rawRows.forEach((raw) => {
      const cleaned = raw.trim();
      if (!cleaned || cleaned.startsWith('#')) {
        return;
      }
      const tokens = tokeniseLayerRow(cleaned);
      if (!tokens.length) {
        return;
      }
      const resolvedRow = tokens.map((token) =>
        resolveTileReference(token, { tileTypes, symbolMap })
      );
      rows.push(resolvedRow);
    });

    if (!rows.length) {
      return;
    }

    const width = Math.max(...rows.map((row) => row.length));
    rows.forEach((row) => {
      if (row.length !== width) {
        throw new Error(`Todas las filas de la capa "${key}" deben tener el mismo ancho`);
      }
    });

    let layerId;
    if (key === 'layer') {
      layerId = properties.get('id') ?? properties.get('name') ?? 'layer';
    } else if (key.startsWith('layer_')) {
      layerId = properties.get('id') ?? key.slice('layer_'.length);
    } else {
      const fallbackId = key.replace(/^layer_?/, '') || key;
      layerId = properties.get('id') ?? fallbackId;
    }
    layerId = layerId || `layer_${layers.length + 1}`;

    const name = properties.get('name') ?? properties.get('label') ?? layerId;
    let order = Number.parseInt(properties.get('order') ?? `${layers.length}`, 10);
    if (!Number.isFinite(order)) {
      order = layers.length;
    }
    const visible = parseBoolean(properties.get('visible'), true);
    const placement = normaliseLayerPlacement(
      properties.get('placement') ?? properties.get('mode') ?? properties.get('type')
    );
    const elevation = parseLayerElevation(
      properties.get('elevation') ?? properties.get('height') ?? properties.get('level') ?? properties.get('offset')
    );
    const opacity = parseLayerOpacity(properties.get('opacity') ?? properties.get('alpha'));

    layers.push({
      id: layerId,
      name,
      order,
      visible,
      placement,
      elevation,
      ...(opacity !== null ? { opacity } : {}),
      tiles: rows.map((row) => row.map((tile) => tile ?? null))
    });
  });

  layers.sort((a, b) => {
    if (a.order === b.order) {
      return a.id.localeCompare(b.id);
    }
    return a.order - b.order;
  });

  return layers;
};

const parseObjectLayerSections = (sections, { registry }) => {
  const layers = [];

  sections.forEach((lines, key) => {
    if (!key.startsWith('objects')) {
      return;
    }

    const properties = parseKeyValueLines(lines.filter((line) => line.includes(':')));
    const rawEntries = lines.filter((line) => !line.includes(':'));

    const parsed = parseObjects(rawEntries, { registry });

    if (!parsed.length && !properties.size) {
      return;
    }

    let layerId;
    if (key === 'objects') {
      layerId = properties.get('id') ?? properties.get('name') ?? 'objects';
    } else if (key.startsWith('objects_')) {
      layerId = properties.get('id') ?? key.slice('objects_'.length);
    } else {
      const fallbackId = key.replace(/^objects_?/, '') || key;
      layerId = properties.get('id') ?? fallbackId;
    }
    layerId = layerId || `objects_${layers.length + 1}`;

    const name = properties.get('name') ?? properties.get('label') ?? layerId;
    let order = Number.parseInt(properties.get('order') ?? `${layers.length}`, 10);
    if (!Number.isFinite(order)) {
      order = layers.length;
    }
    const visible = parseBoolean(properties.get('visible'), true);

    layers.push({
      id: layerId,
      name,
      order,
      visible,
      objects: parsed
    });
  });

  layers.sort((a, b) => {
    if (a.order === b.order) {
      return a.id.localeCompare(b.id);
    }
    return a.order - b.order;
  });

  return layers;
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

export const parseMapDefinition = (rawContents, { sourcePath = null } = {}) => {
  const sections = parseSections(rawContents);
  const metadata = {};

  for (const line of sections.get('meta') ?? []) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    if (!key) {
      continue;
    }
    const normalisedKey = toCamelCase(key);
    metadata[normalisedKey] = value.trim();
  }

  const { tileTypes, symbolMap } = parseTileDefinitions(sections.get('tiles') ?? []);

  const floorColourInput =
    metadata.floorColour ?? metadata.floorColor ?? metadata.floorcolour ?? metadata.floorcolor;
  const resolvedFloorColour = normaliseHexColour(floorColourInput);
  if (resolvedFloorColour) {
    tileTypes.forEach((value, key) => {
      const metadataDefault = value?.metadata?.default;
      const isDefaultTile =
        value?.id === 'floor' ||
        value?.symbol === '.' ||
        metadataDefault === true ||
        metadataDefault === 'true' ||
        metadataDefault === 1 ||
        metadataDefault === '1';

      if (isDefaultTile) {
        tileTypes.set(key, { ...value, color: resolvedFloorColour });
      }
    });
  }
  let layers = parseLayerSections(sections, { tileTypes, symbolMap });

  let size = parseDimensions(metadata.dimensions ?? '') ?? { width: 0, height: 0 };

  if (layers.length) {
    let layerWidth = 0;
    let layerHeight = 0;
    layers.forEach((layer) => {
      layerHeight = Math.max(layerHeight, layer.tiles.length);
      layer.tiles.forEach((row) => {
        layerWidth = Math.max(layerWidth, row.length);
      });
    });

    if (layerWidth && (size.width <= 0 || size.width !== layerWidth)) {
      size = { ...size, width: layerWidth };
    }
    if (layerHeight && (size.height <= 0 || size.height !== layerHeight)) {
      size = { ...size, height: layerHeight };
    }
  }

  if (!layers.length) {
    const fallbackWidth = size.width > 0 ? size.width : 1;
    const fallbackHeight = size.height > 0 ? size.height : 1;
    const defaultTileId = tileTypes.keys().next().value;
    const fallbackTiles = Array.from({ length: fallbackHeight }, () =>
      Array.from({ length: fallbackWidth }, () => defaultTileId)
    );
    layers = [
      {
        id: 'ground',
        name: 'Ground',
        order: 0,
        visible: true,
        tiles: fallbackTiles
      }
    ];
    size = { width: fallbackWidth, height: fallbackHeight };
  }

  const spawn =
    parseCoordinate(metadata.startingPoint ?? '') ??
    parseCoordinate(metadata.spawnPoint ?? '') ??
    parseCoordinate(metadata.spawn ?? '') ?? {
      x: size.width ? Math.floor(size.width / 2) : 0,
      y: size.height ? Math.floor(size.height / 2) : 0
    };
  const inboundDoorEntries = splitDoorEntries(metadata.doorIn);
  const outboundDoorEntries = (() => {
    const explicit = splitDoorEntries(metadata.doorOut);
    if (explicit.length) {
      return explicit;
    }
    const legacy = parseCoordinate(metadata.doorPosition ?? '');
    return legacy ? [`${legacy.x}x${legacy.y}`] : [];
  })();

  const fileName = typeof sourcePath === 'string'
    ? sourcePath.split(/[\\/]/).pop() ?? 'map'
    : 'map';
  const rawId = typeof metadata.id === 'string' ? metadata.id.trim() : '';
  const id = rawId || (fileName.endsWith('.map') ? fileName.replace(/\.map$/i, '') : fileName);

  const title =
    (typeof metadata.title === 'string' && metadata.title.trim()) ||
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    id;

  const registry = new Map();
  const objects = [];
  const doors = [];

  if (outboundDoorEntries.length) {
    const { doors: parsed, objects: doorObjects } = buildDoorDefinitions(outboundDoorEntries, {
      id,
      kind: 'out',
      registry
    });
    doors.push(...parsed);
    objects.push(...doorObjects);
  }

  if (inboundDoorEntries.length) {
    const { doors: parsed } = buildDoorDefinitions(inboundDoorEntries, {
      id,
      kind: 'in',
      registry
    });
    doors.push(...parsed);
  }

  const parsedLayers = parseObjectLayerSections(sections, { registry });

  const objectLayers = parsedLayers.map((layer, index) => {
    const layerOrder = Number.isFinite(layer.order) ? layer.order : index;
    const layerVisible = layer.visible !== false;

    const decoratedObjects = layer.objects.map((object) => ({
      ...object,
      layerId: layer.id,
      layerOrder,
      layerVisible,
      layer: {
        id: layer.id,
        name: layer.name,
        order: layerOrder,
        visible: layerVisible
      }
    }));

    objects.push(...decoratedObjects);

    return {
      id: layer.id,
      name: layer.name,
      order: layerOrder,
      visible: layerVisible,
      objects: decoratedObjects
    };
  });

  const collidableLookup = new Map();
  layers.forEach((layer) => {
    layer.tiles.forEach((row, y) => {
      row.forEach((tileId, x) => {
        if (!tileId) {
          return;
        }
        const tile = tileTypes.get(tileId);
        if (tile?.collides) {
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

  const tileTypeMap = {};
  tileTypes.forEach((value, key) => {
    const payload = {
      id: value.id,
      symbol: value.symbol,
      name: value.name,
      collides: Boolean(value.collides),
      transparent: Boolean(value.transparent)
    };
    if (value.color) {
      payload.color = value.color;
    }
    if (value.metadata && Object.keys(value.metadata).length) {
      payload.metadata = { ...value.metadata };
    }
    tileTypeMap[key] = payload;
  });

  const rawSoundscape =
    metadata.soundscape ?? metadata.ambientSound ?? metadata.soundtrack ?? metadata.sound ?? null;
  const soundscape =
    typeof rawSoundscape === 'string' && rawSoundscape.trim() ? rawSoundscape.trim() : null;

  const theme = {
    borderColour: metadata.borderColour ?? null,
    ...(soundscape ? { soundscape } : {})
  };

  return {
    id,
    name: title,
    biome: metadata.biome ?? 'Comunidad',
    description: metadata.description ?? '',
    size,
    spawn,
    blockedAreas: buildBlockedAreas(size),
    objects,
    objectLayers,
    doors,
    portals: [],
    theme,
    sourcePath: sourcePath ?? fileName,
    tileTypes: tileTypeMap,
    layers,
    collidableTiles
  };
};

export default parseMapDefinition;
