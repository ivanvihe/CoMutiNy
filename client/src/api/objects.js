import httpClient from './httpClient.js';

const normaliseResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const items = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.definitions)
      ? payload.definitions
      : [];

  return items.filter((item) => item && typeof item === 'object');
};

export async function fetchObjectDefinitions({ signal } = {}) {
  const { data } = await httpClient.get('/objects', { signal });
  return normaliseResponse(data);
}

export async function fetchObjectDefinition(objectId, { signal } = {}) {
  if (!objectId) {
    return null;
  }

  const { data } = await httpClient.get(`/objects/${objectId}`, { signal });
  return data ?? null;
}

export default {
  fetchObjectDefinitions,
  fetchObjectDefinition
};
