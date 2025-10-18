import { CHARACTER_TEXTURES } from './customization.js';

const textureCache = new Map();

const applyTextureResult = (entry, result) => {
  if (result) {
    entry.image = result;
    entry.status = 'loaded';
    return result;
  }

  entry.image = null;
  entry.status = 'missing';
  return null;
};

const createTextureEntry = (textureId) => {
  const definition = CHARACTER_TEXTURES[textureId];
  if (!definition) {
    const missingEntry = {
      id: textureId,
      definition: null,
      status: 'missing',
      image: null,
      promise: Promise.resolve(null),
      error: null
    };
    textureCache.set(textureId, missingEntry);
    return missingEntry;
  }

  const entry = {
    id: textureId,
    definition,
    status: 'pending',
    image: null,
    promise: null,
    error: null
  };

  const { generator } = definition;
  if (typeof generator !== 'function') {
    entry.status = 'missing';
    textureCache.set(textureId, entry);
    return entry;
  }

  try {
    const maybeResult = generator({ textureId, definition });
    if (maybeResult && typeof maybeResult.then === 'function') {
      entry.status = 'loading';
      entry.promise = maybeResult
        .then((image) => applyTextureResult(entry, image))
        .catch((error) => {
          entry.status = 'error';
          entry.error = error;
          return null;
        });
    } else {
      applyTextureResult(entry, maybeResult);
    }
  } catch (error) {
    entry.status = 'error';
    entry.error = error;
  }

  textureCache.set(textureId, entry);
  return entry;
};

export const ensureCharacterTexture = (textureId) => {
  if (!textureCache.has(textureId)) {
    return createTextureEntry(textureId);
  }
  return textureCache.get(textureId);
};

export const awaitCharacterTexture = async (textureId) => {
  const entry = ensureCharacterTexture(textureId);
  if (entry.status === 'loaded') {
    return entry.image;
  }
  if (entry.promise) {
    const result = await entry.promise;
    return result;
  }
  return null;
};

export const getCharacterTexture = (textureId) => {
  const entry = ensureCharacterTexture(textureId);
  if (entry.status === 'loaded') {
    return entry.image;
  }
  return null;
};

export const getTextureDefinition = (textureId) => CHARACTER_TEXTURES[textureId] ?? null;
