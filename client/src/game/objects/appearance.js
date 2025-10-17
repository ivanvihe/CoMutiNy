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
  if (!raw || typeof raw !== 'object') {
    return { x: 0.5, y: 1 };
  }

  const x = clamp(toFiniteNumber(raw.x, 0.5), 0, 1);
  const y = clamp(toFiniteNumber(raw.y, 1), 0, 1.5);

  return { x, y };
};

const normaliseOffset = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { x: 0, y: 0 };
  }

  const x = toFiniteNumber(raw.x, 0);
  const y = toFiniteNumber(raw.y, 0);
  return { x, y };
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

  const variant =
    typeof raw.variant === 'string' && raw.variant.trim() ? raw.variant.trim() : null;

  const anchor = normaliseAnchor(raw.anchor);
  const offset = normaliseOffset(raw.offset ?? raw.positionOffset);
  const scale = normaliseScale(raw.scale);

  return {
    generator,
    width,
    height,
    tileSize,
    options,
    anchor,
    offset,
    scale,
    ...(variant ? { variant } : {})
  };
};

export default normaliseAppearance;
