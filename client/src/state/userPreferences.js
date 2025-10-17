const STORAGE_KEY = 'comutiny:user-preferences';

export const DEFAULT_ZOOM_RANGE = { min: 0.5, max: 2 };

export const DEFAULT_APPEARANCE = Object.freeze({
  hair: 'Corto',
  face: 'Clásica',
  outfit: 'Casual',
  shoes: 'Botas'
});

export const DEFAULT_PREFERENCES = Object.freeze({
  mapZoom: 1,
  appearance: { ...DEFAULT_APPEARANCE }
});

let preferences = { ...DEFAULT_PREFERENCES, appearance: { ...DEFAULT_APPEARANCE } };
const listeners = new Set();

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (min > max) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const sanitizeAppearance = (rawAppearance = {}) => {
  const next = { ...DEFAULT_APPEARANCE };
  if (!rawAppearance || typeof rawAppearance !== 'object') {
    return next;
  }

  for (const key of Object.keys(DEFAULT_APPEARANCE)) {
    const value = rawAppearance[key];
    if (typeof value === 'string' && value.trim()) {
      next[key] = value.trim();
    }
  }

  return next;
};

const sanitizePreferences = (raw = {}) => {
  const next = { ...DEFAULT_PREFERENCES, appearance: { ...DEFAULT_APPEARANCE } };
  if (raw && typeof raw === 'object') {
    if (raw.mapZoom !== undefined) {
      const parsed = Number(raw.mapZoom);
      if (Number.isFinite(parsed) && parsed > 0) {
        next.mapZoom = clamp(parsed, DEFAULT_ZOOM_RANGE.min, DEFAULT_ZOOM_RANGE.max);
      }
    }

    if (raw.appearance !== undefined) {
      next.appearance = sanitizeAppearance(raw.appearance);
    }
  }
  return next;
};

const readFromStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('No se pudo cargar las preferencias del usuario:', error);
    return null;
  }
};

const writeToStorage = (nextPreferences) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPreferences));
  } catch (error) {
    console.warn('No se pudo guardar las preferencias del usuario:', error);
  }
};

export const loadUserPreferences = () => {
  const stored = readFromStorage();
  preferences = sanitizePreferences(stored ?? {});
  return {
    ...preferences,
    appearance: { ...preferences.appearance }
  };
};

export const getUserPreferences = () => ({
  ...preferences,
  appearance: { ...preferences.appearance }
});

export const setUserPreferences = (updater) => {
  const current = {
    ...preferences,
    appearance: { ...preferences.appearance }
  };
  const patch =
    typeof updater === 'function'
      ? updater(current)
      : updater;
  const nextPayload = {
    ...current,
    ...(patch && typeof patch === 'object' ? patch : {})
  };

  const next = sanitizePreferences(nextPayload);
  preferences = next;
  writeToStorage(preferences);
  listeners.forEach((listener) => {
    try {
      listener({
        ...preferences,
        appearance: { ...preferences.appearance }
      });
    } catch (error) {
      console.error('Error notificando cambios de preferencias:', error);
    }
  });
  return {
    ...preferences,
    appearance: { ...preferences.appearance }
  };
};

export const updateUserPreferences = (partial) => {
  return setUserPreferences((current) => ({
    ...current,
    ...(partial && typeof partial === 'object' ? partial : {})
  }));
};

export const subscribeToUserPreferences = (listener) => {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const resolveZoomPreference = ({
  min = DEFAULT_ZOOM_RANGE.min,
  max = DEFAULT_ZOOM_RANGE.max,
  fallback = DEFAULT_PREFERENCES.mapZoom
} = {}) => {
  const value = getUserPreferences().mapZoom;
  return clamp(value, min, max) || clamp(fallback, min, max);
};

export const clampZoom = (value, { min = DEFAULT_ZOOM_RANGE.min, max = DEFAULT_ZOOM_RANGE.max } = {}) =>
  clamp(value, min, max);

// Inicializa las preferencias al cargar el módulo
loadUserPreferences();
