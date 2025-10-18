const DEFAULT_BACKEND_URL = 'http://localhost:2567';

export const sanitizeBackendUrl = (raw: string | undefined): string => {
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_BACKEND_URL;
  }
  return raw.replace(/\/$/, '');
};

export const getBackendBaseUrl = (): string =>
  sanitizeBackendUrl(import.meta.env.VITE_BACKEND_URL);
