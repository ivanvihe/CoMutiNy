const STORAGE_KEY = 'comutiny:user-preferences';

const DEFAULT_ZOOM_RANGE = { min: 0.5, max: 2 };

const DEFAULT_PREFERENCES = {
  mapZoom: 1
};

let preferences = { ...DEFAULT_PREFERENCES };
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

const sanitizePreferences = (raw = {}) => {
  const next = { ...DEFAULT_PREFERENCES };
  if (raw && typeof raw === 'object') {
    if (raw.mapZoom !== undefined) {
      const parsed = Number(raw.mapZoom);
      if (Number.isFinite(parsed) && parsed > 0) {
        next.mapZoom = clamp(parsed, DEFAULT_ZOOM_RANGE.min, DEFAULT_ZOOM_RANGE.max);
      }
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
  return { ...preferences };
};

export const getUserPreferences = () => ({ ...preferences });

export const setUserPreferences = (updater) => {
  const current = { ...preferences };
  const patch =
    typeof updater === 'function'
      ? updater(current)
      : updater;
  const next = sanitizePreferences({
    ...current,
    ...(patch && typeof patch === 'object' ? patch : {})
  });
  preferences = next;
  writeToStorage(preferences);
  listeners.forEach((listener) => {
    try {
      listener({ ...preferences });
    } catch (error) {
      console.error('Error notificando cambios de preferencias:', error);
    }
  });
  return { ...preferences };
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
