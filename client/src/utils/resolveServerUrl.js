const DEFAULT_PORT = 4000;

const parsePort = (value) => {
  if (!value && value !== 0) {
    return null;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  return port;
};

const isLocalHostname = (hostname) => {
  if (!hostname) {
    return false;
  }

  const trimmed = hostname.trim().toLowerCase();

  if (!trimmed) {
    return false;
  }

  return (
    trimmed === 'localhost' ||
    trimmed === '127.0.0.1' ||
    trimmed === '0.0.0.0' ||
    trimmed === '::1'
  );
};

const shouldNormaliseHostname = (hostname) => {
  if (!hostname) {
    return true;
  }

  if (isLocalHostname(hostname)) {
    return false;
  }

  const trimmed = hostname.trim();

  if (!trimmed) {
    return true;
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    // IPv6 literal
    return false;
  }

  if (/^\d+(?:\.\d+){3}$/.test(trimmed)) {
    // IPv4 literal
    return false;
  }

  return !trimmed.includes('.');
};

const normaliseProtocol = (protocol, fallbackProtocol = 'http:') => {
  if (!protocol || protocol === 'file:') {
    return fallbackProtocol;
  }

  if (protocol === 'ws:') {
    return 'http:';
  }

  if (protocol === 'wss:') {
    return 'https:';
  }

  return protocol;
};

const normaliseUrlString = (rawUrl, { fallbackProtocol } = {}) => {
  if (!rawUrl) {
    return null;
  }

  const protocolFallback = normaliseProtocol(fallbackProtocol ?? 'http:');

  if (/^wss?:\/\//i.test(rawUrl)) {
    return rawUrl.replace(/^ws/i, 'http');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl);
    const normalisedProtocol = normaliseProtocol(parsed.protocol, protocolFallback);
    if (normalisedProtocol === parsed.protocol) {
      return rawUrl;
    }
    parsed.protocol = normalisedProtocol;
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

const getImportMetaEnv = () => {
  try {
    return Function(
      'return typeof import.meta !== "undefined" ? import.meta.env : undefined;'
    )();
  } catch {
    return undefined;
  }
};

const resolveServerUrl = () => {
  const importMetaEnv = getImportMetaEnv();

  if (typeof window === 'undefined') {
    const fallbackProtocol = normaliseProtocol(
      process?.env?.VITE_SOCKET_PROTOCOL ??
        process?.env?.VITE_API_PROTOCOL ??
        importMetaEnv?.VITE_SOCKET_PROTOCOL ??
        importMetaEnv?.VITE_API_PROTOCOL ??
        'http:',
      'http:'
    );
    const fallbackHostname =
      (
        process?.env?.VITE_SOCKET_HOST ??
        process?.env?.VITE_API_HOST ??
        importMetaEnv?.VITE_SOCKET_HOST ??
        importMetaEnv?.VITE_API_HOST ??
        'localhost'
      ).trim() ||
      'localhost';
    const fallbackPort =
      parsePort(process?.env?.VITE_SOCKET_PORT) ??
      parsePort(process?.env?.VITE_API_PORT) ??
      parsePort(importMetaEnv?.VITE_SOCKET_PORT) ??
      parsePort(importMetaEnv?.VITE_API_PORT) ??
      DEFAULT_PORT;

    const rawUrl = normaliseUrlString(
      process?.env?.VITE_SOCKET_URL ??
        process?.env?.VITE_API_BASE_URL ??
        importMetaEnv?.VITE_SOCKET_URL ??
        importMetaEnv?.VITE_API_BASE_URL ??
        null,
      { fallbackProtocol }
    );

    if (rawUrl) {
      try {
        const candidate = new URL(rawUrl, `${fallbackProtocol}//${fallbackHostname}`);

        if (shouldNormaliseHostname(candidate.hostname)) {
          candidate.hostname = fallbackHostname;
        }

        if (!candidate.port && fallbackPort) {
          candidate.port = String(fallbackPort);
        }

        candidate.protocol = normaliseProtocol(candidate.protocol, fallbackProtocol);

        return candidate.toString();
      } catch (error) {
        console.warn('Failed to parse server URL, falling back to raw value.', error);
        return rawUrl;
      }
    }

    const includePort =
      fallbackPort &&
      !(
        (fallbackProtocol === 'https:' && fallbackPort === 443) ||
        (fallbackProtocol === 'http:' && fallbackPort === 80)
      );

    const portSegment = includePort ? `:${fallbackPort}` : '';

    return `${fallbackProtocol}//${fallbackHostname}${portSegment}`;
  }

  const { protocol: currentProtocol, hostname: currentHostname } = window.location;
  const fallbackProtocol = normaliseProtocol(
    currentProtocol === 'https:' ? 'https:' : 'http:',
    'http:'
  );
  const fallbackHostname = currentHostname || 'localhost';

  const fallbackPort =
    parsePort(importMetaEnv?.VITE_SOCKET_PORT) ??
    parsePort(importMetaEnv?.VITE_API_PORT) ??
    DEFAULT_PORT;

  const rawUrl = normaliseUrlString(
    window.__COMUTINY_SOCKET_URL__ ??
      importMetaEnv?.VITE_SOCKET_URL ??
      importMetaEnv?.VITE_API_BASE_URL ??
      null,
    { fallbackProtocol }
  );

  if (rawUrl) {
    try {
      const candidate = new URL(rawUrl, `${fallbackProtocol}//${fallbackHostname}`);

      if (shouldNormaliseHostname(candidate.hostname)) {
        candidate.hostname = fallbackHostname;
      }

      if (!candidate.port && fallbackPort) {
        candidate.port = String(fallbackPort);
      }

      candidate.protocol = normaliseProtocol(candidate.protocol, fallbackProtocol);

      return candidate.toString();
    } catch (error) {
      console.warn('Failed to parse server URL, falling back to raw value.', error);
      return rawUrl;
    }
  }

  const includePort =
    fallbackPort &&
    !(
      (fallbackProtocol === 'https:' && fallbackPort === 443) ||
      (fallbackProtocol === 'http:' && fallbackPort === 80)
    );

  const portSegment = includePort ? `:${fallbackPort}` : '';

  return `${fallbackProtocol}//${fallbackHostname}${portSegment}`;
};

export default resolveServerUrl;
