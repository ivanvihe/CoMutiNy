import httpClient from './httpClient.js';

export const fetchUsers = async ({ limit = 10, offset = 0 } = {}) => {
  const { data } = await httpClient.get('/admin/users', { params: { limit, offset } });
  return data;
};

export const updateUserRole = async (id, role) => {
  const { data } = await httpClient.patch(`/admin/users/${id}`, { role });
  return data;
};

export const updateUserModeration = async (id, payload) => {
  const { data } = await httpClient.patch(`/admin/users/${id}`, payload);
  return data;
};

export const deleteUser = async (id) => {
  await httpClient.delete(`/admin/users/${id}`);
};

export const fetchSpriteAssets = async ({ limit = 10, offset = 0 } = {}) => {
  const { data } = await httpClient.get('/admin/assets/sprites', { params: { limit, offset } });
  return data;
};

export const createSpriteAsset = async (payload) => {
  const { data } = await httpClient.post('/admin/assets/sprites', payload);
  return data;
};

export const updateSpriteAsset = async (id, payload) => {
  const { data } = await httpClient.patch(`/admin/assets/sprites/${id}`, payload);
  return data;
};

export const deleteSpriteAsset = async (id) => {
  await httpClient.delete(`/admin/assets/sprites/${id}`);
};

export const fetchLandscapeAssets = async ({ limit = 10, offset = 0 } = {}) => {
  const { data } = await httpClient.get('/admin/assets/landscapes', { params: { limit, offset } });
  return data;
};

export const createLandscapeAsset = async (payload) => {
  const { data } = await httpClient.post('/admin/assets/landscapes', payload);
  return data;
};

export const updateLandscapeAsset = async (id, payload) => {
  const { data } = await httpClient.patch(`/admin/assets/landscapes/${id}`, payload);
  return data;
};

export const deleteLandscapeAsset = async (id) => {
  await httpClient.delete(`/admin/assets/landscapes/${id}`);
};

export const fetchRecentMessages = async ({
  limit = 20,
  offset = 0,
  search,
  status,
  from,
  to,
  userId
} = {}) => {
  const params = { limit, offset };

  if (search) {
    params.search = search;
  }

  if (status && status !== 'all') {
    params.status = status;
  }

  if (from) {
    params.from = from;
  }

  if (to) {
    params.to = to;
  }

  if (userId) {
    params.userId = userId;
  }

  const { data } = await httpClient.get('/admin/messages', { params });
  return data;
};
