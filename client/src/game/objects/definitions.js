import normaliseAppearance from './appearance.js';

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

  return {
    id,
    name,
    description,
    metadata,
    interaction,
    behaviour,
    appearance,
    sourcePath: sourcePath ?? null
  };
};

const definitionSources = loadDefinitionSources();

const OBJECT_DEFINITIONS = new Map();

Object.entries(definitionSources).forEach(([filePath, rawContents]) => {
  try {
    const parsed = typeof rawContents === 'string' ? JSON.parse(rawContents) : rawContents;
    const definition = normaliseDefinition(parsed, { sourcePath: filePath });
    OBJECT_DEFINITIONS.set(definition.id, definition);
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

export { OBJECT_DEFINITIONS };
