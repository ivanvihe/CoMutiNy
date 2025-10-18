import {
  DEFAULT_TERRAIN_PARAMETERS,
  normalizeTerrainParameters,
  type TerrainParameters,
} from './parameters';

export interface WorldConfigResponse {
  terrain?: Partial<TerrainParameters> | TerrainParameters;
}

const sanitizeBackendUrl = (raw: string | undefined): string => {
  if (!raw || raw.trim().length === 0) {
    return 'http://localhost:2567';
  }
  return raw.replace(/\/$/, '');
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const fetchTerrainParameters = async (
  baseUrl: string = sanitizeBackendUrl(import.meta.env.VITE_BACKEND_URL),
): Promise<TerrainParameters> => {
  const url = `${sanitizeBackendUrl(baseUrl)}/world/config`;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    if (!isObject(payload)) {
      throw new Error('Invalid payload received');
    }
    const terrainCandidate = (payload as WorldConfigResponse).terrain;
    if (!terrainCandidate || !isObject(terrainCandidate)) {
      throw new Error('Terrain configuration missing in response');
    }
    return normalizeTerrainParameters(terrainCandidate as Partial<TerrainParameters>);
  } catch (error) {
    console.warn('Falling back to default terrain parameters:', error);
    return normalizeTerrainParameters(DEFAULT_TERRAIN_PARAMETERS);
  }
};
