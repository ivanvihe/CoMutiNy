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

const normaliseAnchor = (raw) => {
  if (!raw) {
    return { x: 0.5, y: 1, z: 0 };
  }

  if (typeof raw === 'number') {
    const numeric = clamp(toFiniteNumber(raw, 0.5), 0, 1);
    return { x: numeric, y: numeric, z: 0 };
  }

  if (Array.isArray(raw) && raw.length) {
    const x = clamp(toFiniteNumber(raw[0], 0.5), 0, 1);
    const y = clamp(toFiniteNumber(raw[1] ?? raw[0], 1), 0, 1.5);
    const z = clamp(toFiniteNumber(raw[2] ?? 0, 0), -8, 8);
    return { x, y, z };
  }

  if (typeof raw !== 'object') {
    return { x: 0.5, y: 1, z: 0 };
  }

  const x = clamp(toFiniteNumber(raw.x ?? raw[0], 0.5), 0, 1);
  const y = clamp(toFiniteNumber(raw.y ?? raw[1], 1), 0, 1.5);
  const z = clamp(toFiniteNumber(raw.z ?? raw.depth ?? raw[2], 0), -8, 8);

  return { x, y, z };
};

const normaliseOffset = (raw) => {
  if (raw === undefined || raw === null) {
    return { x: 0, y: 0, z: 0 };
  }

  if (typeof raw === 'number') {
    const numeric = toFiniteNumber(raw, 0);
    return { x: numeric, y: numeric, z: 0 };
  }

  if (Array.isArray(raw) && raw.length) {
    const x = toFiniteNumber(raw[0], 0);
    const y = toFiniteNumber(raw[1] ?? raw[0], 0);
    const z = toFiniteNumber(raw[2] ?? 0, 0);
    return { x, y, z };
  }

  if (typeof raw !== 'object') {
    return { x: 0, y: 0, z: 0 };
  }

  const x = toFiniteNumber(raw.x ?? raw[0], 0);
  const y = toFiniteNumber(raw.y ?? raw[1], 0);
  const z = toFiniteNumber(raw.z ?? raw[2], 0);
  return { x, y, z };
};

const normaliseScale = (raw) => {
  if (raw === undefined || raw === null) {
    return { x: 1, y: 1 };
  }

  if (typeof raw === 'number') {
    const value = clamp(raw, 0.1, 6);
    return { x: value, y: value };
  }

  if (typeof raw === 'object') {
    const x = clamp(toFiniteNumber(raw.x, 1), 0.1, 6);
    const y = clamp(toFiniteNumber(raw.y, 1), 0.1, 6);
    return { x, y };
  }

  return { x: 1, y: 1 };
};

const normaliseGeneratorType = (value) => {
  if (typeof value !== 'string') {
    return 'reference';
  }

  const normalised = value.trim().toLowerCase();
  if (['function', 'code', 'source'].includes(normalised)) {
    return 'function';
  }

  return 'reference';
};

export const normaliseAppearance = (raw, { fallbackSize } = {}) => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const generatorCandidate =
    (typeof raw.generator === 'string' && raw.generator.trim()) ||
    (typeof raw.type === 'string' && raw.type.trim()) ||
    (typeof raw.id === 'string' && raw.id.trim()) ||
    (typeof raw.kind === 'string' && raw.kind.trim()) ||
    '';

  const generator = generatorCandidate.trim();
  if (!generator) {
    return null;
  }

  const width = Math.max(
    1,
    Math.trunc(
      toFiniteNumber(
        raw.width ?? raw.columns ?? fallbackSize?.width ?? 1,
        fallbackSize?.width ?? 1
      )
    )
  );
  const height = Math.max(
    1,
    Math.trunc(
      toFiniteNumber(
        raw.height ?? raw.rows ?? fallbackSize?.height ?? 1,
        fallbackSize?.height ?? 1
      )
    )
  );

  const tileSize = Math.max(
    4,
    Math.trunc(toFiniteNumber(raw.tileSize ?? raw.tile_size ?? raw.pixelSize ?? 16, 16))
  );

  const options =
    raw.options && typeof raw.options === 'object' && !Array.isArray(raw.options)
      ? { ...raw.options }
      : {};

  const generatorType = normaliseGeneratorType(raw.generatorType);
  const generatorSource =
    typeof raw.generatorSource === 'string' && raw.generatorSource.trim()
      ? raw.generatorSource.trim()
      : null;

  const variant =
    typeof raw.variant === 'string' && raw.variant.trim() ? raw.variant.trim() : null;

  const anchor = normaliseAnchor(raw.anchor);
  const offset = normaliseOffset(raw.offset ?? raw.positionOffset);
  const scale = normaliseScale(raw.scale);

  const appearance = {
    generator,
    width,
    height,
    tileSize,
    options,
    anchor,
    offset,
    scale,
    generatorType,
    ...(variant ? { variant } : {})
  };

  if (generatorSource) {
    appearance.generatorSource = generatorSource;
  }

  return appearance;
};

export default normaliseAppearance;
