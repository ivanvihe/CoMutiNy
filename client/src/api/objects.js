import httpClient from './httpClient.js';

const toNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const cloneSerializable = (value, fallback) => {
  if (value === null || value === undefined) {
    return fallback;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return fallback;
  }
};

const normaliseAppearance = (appearance) => {
  if (!appearance || typeof appearance !== 'object') {
    return null;
  }

  const generator = typeof appearance.generator === 'string'
    ? appearance.generator.trim()
    : '';

  if (!generator) {
    return null;
  }

  const payload = {
    generator,
    width: Math.max(1, toNumber(appearance.width, 1)),
    height: Math.max(1, toNumber(appearance.height, 1)),
    tileSize: Math.max(4, toNumber(appearance.tileSize, 16)),
    generatorType: typeof appearance.generatorType === 'string'
      ? appearance.generatorType
      : 'reference',
    options: cloneSerializable(appearance.options, {}),
    anchor: cloneSerializable(appearance.anchor, { x: 0.5, y: 1 }),
    offset: cloneSerializable(appearance.offset, { x: 0, y: 0 }),
    scale: cloneSerializable(appearance.scale, { x: 1, y: 1 })
  };

  if (typeof appearance.generatorSource === 'string' && appearance.generatorSource.trim()) {
    payload.generatorSource = appearance.generatorSource;
  }

  if (typeof appearance.variant === 'string' && appearance.variant.trim()) {
    payload.variant = appearance.variant.trim();
  }

  return payload;
};

const normaliseResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const items = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.definitions)
      ? payload.definitions
      : [];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const normalised = { ...item };
      const appearance = normaliseAppearance(item.appearance);

      if (appearance) {
        normalised.appearance = appearance;
      } else {
        delete normalised.appearance;
      }

      return normalised;
    })
    .filter(Boolean);
};

export async function fetchObjectDefinitions({ signal } = {}) {
  const { data } = await httpClient.get('/objects', { signal });
  return normaliseResponse(data);
}

export async function fetchObjectDefinition(objectId, { signal } = {}) {
  if (!objectId) {
    return null;
  }

  const { data } = await httpClient.get(`/objects/${objectId}`, { signal });
  return data ?? null;
}

export default {
  fetchObjectDefinitions,
  fetchObjectDefinition
};
