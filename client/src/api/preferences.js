import httpClient from './httpClient.js';

const sanitizeAlias = (alias) => {
  if (typeof alias !== 'string') {
    return '';
  }
  return alias.trim();
};

export const fetchPreferences = async (alias) => {
  const sanitized = sanitizeAlias(alias);
  if (!sanitized) {
    return null;
  }
  const { data } = await httpClient.get(`/preferences/${encodeURIComponent(sanitized)}`);
  return data?.preferences ?? data ?? null;
};

export const savePreferences = async (alias, preferences) => {
  const sanitized = sanitizeAlias(alias);
  if (!sanitized) {
    throw new Error('Alias inválido para guardar preferencias.');
  }
  const payload = preferences && typeof preferences === 'object' ? preferences : {};
  const { data } = await httpClient.put(`/preferences/${encodeURIComponent(sanitized)}`, payload);
  return data?.preferences ?? data ?? null;
};
