const DEFAULT_PORT = 2567;

const resolveDefaultBackendUrl = (): string => {
  if (typeof window === 'undefined') {
    return `http://localhost:${DEFAULT_PORT}`;
  }

  const { protocol, hostname } = window.location;

  const normalizedProtocol = protocol === 'https:' ? 'https:' : 'http:';
  const needsPort =
    (normalizedProtocol === 'https:' && DEFAULT_PORT !== 443) ||
    (normalizedProtocol === 'http:' && DEFAULT_PORT !== 80);

  const portSegment = needsPort ? `:${DEFAULT_PORT}` : '';

  return `${normalizedProtocol}//${hostname}${portSegment}`;
};

const DEFAULT_BACKEND_URL = resolveDefaultBackendUrl();

export const sanitizeBackendUrl = (raw: string | undefined): string => {
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_BACKEND_URL;
  }
  return raw.replace(/\/$/, '');
};

export const getBackendBaseUrl = (): string =>
  sanitizeBackendUrl(import.meta.env.VITE_BACKEND_URL);
