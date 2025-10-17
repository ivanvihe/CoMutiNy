import httpClient from './httpClient.js'

export const fetchMaps = async ({ limit = 20, offset = 0 } = {}) => {
  const { data } = await httpClient.get('/maps', {
    params: { limit, offset }
  })
  return data
}

export const fetchMapById = async (mapId) => {
  const { data } = await httpClient.get(`/maps/${mapId}`)
  return data
}

export const createMap = async (payload) => {
  const { data } = await httpClient.post('/maps', payload)
  return data
}

export const updateMap = async (mapId, payload) => {
  const { data } = await httpClient.put(`/maps/${mapId}`, payload)
  return data
}

export const deleteMap = async (mapId) => {
  await httpClient.delete(`/maps/${mapId}`)
}

export const createMapObject = async (mapId, payload) => {
  const { data } = await httpClient.post(`/maps/${mapId}/objects`, payload)
  return data
}

export const updateMapObject = async (mapId, objectId, payload) => {
  const { data } = await httpClient.put(`/maps/${mapId}/objects/${objectId}`, payload)
  return data
}

export const deleteMapObject = async (mapId, objectId) => {
  await httpClient.delete(`/maps/${mapId}/objects/${objectId}`)
}
