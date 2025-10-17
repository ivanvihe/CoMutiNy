import httpClient from './httpClient.js';

export const login = async (credentials) => {
  const { data } = await httpClient.post('/auth/login', credentials);
  return data;
};

export const register = async (payload) => {
  const { data } = await httpClient.post('/auth/register', payload);
  return data;
};

export const getCurrentUser = async () => {
  const { data } = await httpClient.get('/auth/me');
  return data;
};
