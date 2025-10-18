import normaliseAppearance from './appearance.js';
import {
  registerSpriteGeneratorSource,
  registerSpriteGeneratorDefinitions
} from './spriteGenerators.js';
import {
  DEFAULT_SPRITE_ANCHOR,
  DEFAULT_VOLUME,
  clamp,
  normaliseAnchor,
  normaliseVolume,
  toFiniteNumber
} from '../graphics/spritePlacement.js';

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
    const serverDefinitions = import.meta.glob('../../../server/objects/definitions/*.obj', {
      eager: true,
      import: 'default',
      query: '?raw'
    });

    const phase3Definitions = import.meta.glob('../../../assets/phase3/objects/*.json', {
      eager: true,
      import: 'default'
    });

    return { ...serverDefinitions, ...phase3Definitions };
  }

  if (typeof process !== 'undefined' && process.versions?.node && typeof require === 'function') {
    try {
      // eslint-disable-next-line global-require
      const fs = require('fs');
      // eslint-disable-next-line global-require
      const path = require('path');

      const baseDir = (() => {
        if (typeof __dirname === 'string') {
          return __dirname;
        }
        if (typeof import.meta !== 'undefined' && import.meta.url) {
          return new URL('.', import.meta.url).pathname;
        }
        return process.cwd();
      })();
      const serverDirectory = path.resolve(baseDir, '../../../server/objects/definitions');
      const clientPhase3Directory = path.resolve(baseDir, '../../../assets/phase3/objects');

      const loadDirectory = (directory, { extension, prefix, raw = true }) => {
        try {
          const entries = fs.readdirSync(directory, { withFileTypes: true });
          return entries
            .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
            .reduce((accumulator, entry) => {
              const filePath = path.join(directory, entry.name);
              const rawContents = fs.readFileSync(filePath, 'utf-8');
              const key = `${prefix}/${entry.name}`;
              if (raw) {
                return { ...accumulator, [key]: rawContents };
              }

              try {
                const parsed = JSON.parse(rawContents);
                return { ...accumulator, [key]: parsed };
              } catch (parseError) {
                console.warn('[objects] No se pudo parsear', filePath, parseError?.message ?? parseError);
                return accumulator;
              }
            }, {});
        } catch (error) {
          return {};
        }
      };

      const serverEntries = loadDirectory(serverDirectory, {
        extension: '.obj',
        prefix: '../../../server/objects/definitions'
      });

      const clientEntries = loadDirectory(clientPhase3Directory, {
        extension: '.json',
        prefix: '../../../assets/phase3/objects',
        raw: false
      });

      return { ...serverEntries, ...clientEntries };
    } catch (error) {
      console.warn('[objects] No se pudieron cargar definiciones locales', error?.message ?? error);
      return {};
    }
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
    anchor: normaliseAnchor(appearance?.anchor, DEFAULT_SPRITE_ANCHOR)
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
