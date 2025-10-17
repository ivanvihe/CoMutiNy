import normaliseAppearance from './appearance.js';
import {
  registerSpriteGeneratorSource,
  registerSpriteGeneratorDefinitions
} from './spriteGenerators.js';

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

const normaliseVolume = (value, fallback = { height: 1, anchor: { x: 0.5, y: 1, z: 0 } }) => {
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

const collectCanvasGeneratorCollections = (rawDefinition) => {
  if (!rawDefinition || typeof rawDefinition !== 'object') {
    return [];
  }

  const candidates = [];

  const enqueue = (value) => {
    if (!value) {
      return;
    }
    candidates.push(value);
  };

  enqueue(rawDefinition.canvasDefinitions);
  enqueue(rawDefinition.spriteGeneratorDefinitions);
  enqueue(rawDefinition.canvasGenerators);
  enqueue(rawDefinition.spriteGenerators);
  enqueue(rawDefinition.canvasFunctions);

  if (rawDefinition.canvas && typeof rawDefinition.canvas === 'object') {
    enqueue(rawDefinition.canvas.generators);
    enqueue(rawDefinition.canvas.definitions);
    enqueue(rawDefinition.canvas.functions);
  }

  return candidates;
};

const registerCanvasGeneratorsFromDefinition = (rawDefinition) => {
  const collections = collectCanvasGeneratorCollections(rawDefinition);
  if (!collections.length) {
    return [];
  }

  const registered = [];

  collections.forEach((collection) => {
    try {
      const result = registerSpriteGeneratorDefinitions(collection);
      if (Array.isArray(result) && result.length) {
        registered.push(...result);
      }
    } catch (error) {
      const identifier = rawDefinition?.id ?? rawDefinition?.name ?? '(sin id)';
      console.warn(
        `[objects] No se pudieron registrar funciones Canvas adicionales para ${identifier}`,
        error?.message ?? error
      );
    }
  });

  return registered;
};

const sanitizeString = (value, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
};

const sanitizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalised = `${value}`.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalised)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalised)) {
    return false;
  }
  return fallback;
};

const sanitizeMetadata = (raw, fallback = {}) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback };
  }
  return { ...fallback, ...raw };
};

const sanitizeInteraction = (raw, { fallbackTitle, fallbackDescription }) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      type: 'message',
      title: fallbackTitle,
      description: fallbackDescription,
      message: fallbackDescription
    };
  }

  const type = sanitizeString(raw.type, 'message');
  const title = sanitizeString(raw.title, fallbackTitle);
  const description = sanitizeString(raw.description, fallbackDescription);
  const message = sanitizeString(raw.message ?? raw.text, description);

  const payload = {
    type: type || 'message',
    title: title || fallbackTitle,
    description: description || fallbackDescription,
    message: message || undefined
  };

  if (raw.icon && typeof raw.icon === 'string' && raw.icon.trim()) {
    payload.icon = raw.icon.trim();
  }

  if (raw.animation && typeof raw.animation === 'string' && raw.animation.trim()) {
    payload.animation = raw.animation.trim();
  }

  if (raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)) {
    payload.metadata = { ...raw.metadata };
  }

  return payload;
};

const sanitizeBehaviour = (raw, { fallbackTitle, fallbackDescription }) => {
  const base = sanitizeInteraction(raw, { fallbackTitle, fallbackDescription });
  return {
    ...base,
    broadcast: sanitizeBoolean(raw?.broadcast, false),
    metadata:
      raw?.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
        ? { ...raw.metadata }
        : {},
    effects: Array.isArray(raw?.effects) ? [...raw.effects] : []
  };
};

const loadDefinitionSources = () => {
  if (typeof import.meta !== 'undefined' && typeof import.meta.glob === 'function') {
    return import.meta.glob('../../../server/objects/definitions/*.obj', {
      eager: true,
      import: 'default',
      query: '?raw'
    });
  }

  return {};
};

const normaliseDefinition = (raw, { sourcePath } = {}) => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid object definition: expected an object literal');
  }

  const id = sanitizeString(raw.id);
  if (!id) {
    throw new Error('Object definition is missing an id');
  }

  const name = sanitizeString(raw.name, id);
  const description = sanitizeString(raw.description, '');

  const metadata = sanitizeMetadata(raw.metadata);
  if (metadata.volume) {
    delete metadata.volume;
  }

  const interaction = sanitizeInteraction(raw.interaction ?? raw.behavior, {
    fallbackTitle: name,
    fallbackDescription: description
  });

  const behaviour = sanitizeBehaviour(
    raw.behavior ?? raw.behaviour ?? raw.interaction,
    {
      fallbackTitle: interaction.title ?? name,
      fallbackDescription: interaction.description ?? description
    }
  );

  const appearance = normaliseAppearance(raw.appearance ?? raw.sprite, {
    fallbackSize: { width: 1, height: 1 }
  });

  const fallbackVolume = {
    height: Math.max(appearance?.height ?? 1, 1),
    anchor: normaliseAnchor3D(appearance?.anchor, { x: 0.5, y: 1, z: 0 })
  };

  const volumeSource =
    raw.volume ??
    raw.verticalVolume ??
    raw.metadata?.volume ??
    raw.height ??
    raw.dimensions?.height ??
    null;
  const volume = normaliseVolume(volumeSource, fallbackVolume);

  return {
    id,
    name,
    description,
    metadata,
    interaction,
    behaviour,
    appearance,
    volume,
    sourcePath: sourcePath ?? null
  };
};

const OBJECT_DEFINITIONS = new Map();

const registerDefinition = (rawDefinition, { sourcePath } = {}) => {
  const definition = normaliseDefinition(rawDefinition, { sourcePath });

  const appearance = definition.appearance;
  if (
    appearance?.generator &&
    appearance.generatorType === 'function' &&
    typeof appearance.generatorSource === 'string' &&
    appearance.generatorSource.trim()
  ) {
    try {
      registerSpriteGeneratorSource(appearance.generator, appearance.generatorSource);
    } catch (error) {
      console.warn(
        `[objects] No se pudo registrar el generador Canvas ${appearance.generator}`,
        error.message
      );
    }
  }

  registerCanvasGeneratorsFromDefinition(rawDefinition);

  OBJECT_DEFINITIONS.set(definition.id, definition);
  return definition;
};

const definitionSources = loadDefinitionSources();

Object.entries(definitionSources).forEach(([filePath, rawContents]) => {
  try {
    const parsed = typeof rawContents === 'string' ? JSON.parse(rawContents) : rawContents;
    registerDefinition(parsed, { sourcePath: filePath });
  } catch (error) {
    console.warn('[objects] No se pudo cargar', filePath, error.message);
  }
});

export const resolveObjectDefinition = (objectId) => {
  if (!objectId) {
    return null;
  }
  return OBJECT_DEFINITIONS.get(objectId) ?? null;
};

export const listObjectDefinitions = () => Array.from(OBJECT_DEFINITIONS.values());

export const registerObjectDefinitions = (definitions = []) => {
  const registered = [];

  definitions.forEach((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return;
    }

    const sourcePath =
      typeof candidate.sourcePath === 'string' && candidate.sourcePath.trim()
        ? candidate.sourcePath.trim()
        : typeof candidate.source === 'string' && candidate.source.trim()
          ? candidate.source.trim()
          : null;

    try {
      registered.push(registerDefinition({ ...candidate }, { sourcePath }));
    } catch (error) {
      const identifier = candidate?.id ?? '(sin id)';
      console.warn(`[objects] No se pudo registrar la definición ${identifier}`, error.message);
    }
  });

  return registered;
};

export { OBJECT_DEFINITIONS };
