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

  const size = parseDimensions(metadata.dimensions ?? '') ?? { width: 0, height: 0 };
  const spawn =
    parseCoordinate(metadata.startingPoint ?? '') ??
    parseCoordinate(metadata.spawnPoint ?? '') ??
    parseCoordinate(metadata.spawn ?? '') ??
    { x: Math.floor(size.width / 2) || 0, y: Math.floor(size.height / 2) || 0 };
  const doorPosition = parseCoordinate(metadata.doorPosition ?? '');

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

  if (doorPosition) {
    const doorId = ensureUniqueId(`${id}-door`, registry);
    objects.push({
      id: doorId,
      name: 'Acceso principal',
      label: 'Acceso principal',
      position: doorPosition,
      size: { width: 1, height: 1 },
      solid: false,
      metadata: { type: 'door', objectId: 'community_door', instanceId: doorId },
      objectId: 'community_door'
    });
  }

  const parsedObjects = parseObjects(sections.get('objects') ?? [], { registry });
  objects.push(...parsedObjects);

  return {
    id,
    name: title,
    biome: metadata.biome ?? 'Comunidad',
    description: metadata.description ?? '',
    size,
    spawn,
    blockedAreas: buildBlockedAreas(size),
    objects,
    portals: [],
    theme: { borderColour: metadata.borderColour ?? null },
    sourcePath: sourcePath ?? fileName
  };
};

export default parseMapDefinition;
