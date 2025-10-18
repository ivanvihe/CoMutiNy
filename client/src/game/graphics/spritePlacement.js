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

export const DEFAULT_SPRITE_ANCHOR = Object.freeze({ x: 0.5, y: 1, z: 0 });
export const DEFAULT_SPRITE_OFFSET = Object.freeze({ x: 0, y: 0, z: 0 });
export const DEFAULT_PIXEL_OFFSET = Object.freeze({ x: 0, y: 0, z: 0 });

export const DEFAULT_VOLUME = Object.freeze({
  height: 1,
  anchor: DEFAULT_SPRITE_ANCHOR
});

const normaliseAnchor = (value, fallback = DEFAULT_SPRITE_ANCHOR) => {
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

const normaliseOffset = (value, fallback = DEFAULT_SPRITE_OFFSET) => {
  if (value === undefined || value === null) {
    return { ...fallback };
  }

  if (typeof value === 'number') {
    const numeric = toFiniteNumber(value, fallback.x);
    return { x: numeric, y: numeric, z: fallback.z ?? 0 };
  }

  if (Array.isArray(value) && value.length) {
    const x = toFiniteNumber(value[0], fallback.x);
    const y = toFiniteNumber(value[1] ?? value[0], fallback.y);
    const z = toFiniteNumber(value[2] ?? fallback.z ?? 0, fallback.z ?? 0);
    return { x, y, z };
  }

  if (typeof value === 'object') {
    const x = toFiniteNumber(value.x ?? value[0], fallback.x);
    const y = toFiniteNumber(value.y ?? value[1], fallback.y);
    const z = toFiniteNumber(value.z ?? value[2] ?? fallback.z ?? 0, fallback.z ?? 0);
    return { x, y, z };
  }

  return { ...fallback };
};

const normalisePixelOffset = (value, fallback = DEFAULT_PIXEL_OFFSET) => {
  if (value === undefined || value === null) {
    return { ...fallback };
  }

  if (typeof value === 'number') {
    const numeric = toFiniteNumber(value, fallback.x);
    return { x: numeric, y: numeric, z: fallback.z ?? 0 };
  }

  if (Array.isArray(value) && value.length) {
    const x = toFiniteNumber(value[0], fallback.x);
    const y = toFiniteNumber(value[1] ?? value[0], fallback.y);
    const z = toFiniteNumber(value[2] ?? fallback.z ?? 0, fallback.z ?? 0);
    return { x, y, z };
  }

  if (typeof value === 'object') {
    const x = toFiniteNumber(value.x ?? value[0], fallback.x);
    const y = toFiniteNumber(value.y ?? value[1], fallback.y);
    const z = toFiniteNumber(value.z ?? value[2] ?? fallback.z ?? 0, fallback.z ?? 0);
    return { x, y, z };
  }

  return { ...fallback };
};

const normaliseVolume = (value, fallback = DEFAULT_VOLUME) => {
  const baseAnchor = fallback?.anchor ?? DEFAULT_SPRITE_ANCHOR;
  const fallbackHeight = Number.isFinite(fallback?.height) ? Math.max(fallback.height, 0) : 0;

  if (value === undefined || value === null) {
    return { height: fallbackHeight, anchor: { ...baseAnchor } };
  }

  if (typeof value === 'number') {
    const height = Math.max(toFiniteNumber(value, fallbackHeight), 0);
    return { height, anchor: { ...baseAnchor } };
  }

  if (Array.isArray(value) && value.length) {
    const height = Math.max(toFiniteNumber(value[0], fallbackHeight), 0);
    const anchor = normaliseAnchor(value[1], baseAnchor);
    return { height, anchor };
  }

  if (typeof value === 'object') {
    const heightCandidate =
      value.height ?? value.z ?? value.depth ?? value.levels ?? value.size ?? fallbackHeight;
    const height = Math.max(toFiniteNumber(heightCandidate, fallbackHeight), 0);
    const anchor = normaliseAnchor(value.anchor ?? value.pivot ?? value.origin, baseAnchor);
    return { height, anchor };
  }

  return { height: fallbackHeight, anchor: { ...baseAnchor } };
};

export const TILE_BASE_SIZE = 48;

export const SPRITE_METRICS = Object.freeze({
  tile: {
    width: 1,
    height: 1,
    pixelWidth: TILE_BASE_SIZE,
    pixelHeight: TILE_BASE_SIZE,
    anchor: { x: 0.5, y: 0.5, z: 0 },
    offset: { ...DEFAULT_SPRITE_OFFSET },
    pixelOffset: { ...DEFAULT_PIXEL_OFFSET }
  },
  object: {
    anchor: { ...DEFAULT_SPRITE_ANCHOR },
    offset: { ...DEFAULT_SPRITE_OFFSET },
    pixelOffset: { ...DEFAULT_PIXEL_OFFSET }
  },
  character: {
    frame: { width: TILE_BASE_SIZE, height: Math.round(TILE_BASE_SIZE * 1.33) },
    anchor: { ...DEFAULT_SPRITE_ANCHOR },
    offset: { ...DEFAULT_SPRITE_OFFSET },
    pixelOffset: { ...DEFAULT_PIXEL_OFFSET }
  },
  layers: {
    shadow: {
      heightFactor: 0.6,
      offsetZ: -0.05,
      alpha: 0.8,
      color: 'rgba(0, 0, 0, 0.25)',
      pixelOffsetFactor: 0.12,
      centerYOffset: 0.08,
      radiusXFactor: 0.42,
      radiusYFactor: 0.22
    }
  }
});

export { clamp, toFiniteNumber, normaliseAnchor, normaliseOffset, normalisePixelOffset, normaliseVolume };
