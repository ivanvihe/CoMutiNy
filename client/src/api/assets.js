import httpClient from './httpClient.js';

export const fetchPublicSpriteAssets = async ({ limit = 50, offset = 0 } = {}) => {
  const { data } = await httpClient.get('/assets/sprites', {
    params: { limit, offset }
  });

  return data;
};

