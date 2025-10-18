export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;
export const MAX_BLOCK_TYPES = 4096;
export const AIR_BLOCK_ID = 0;

export const DEFAULT_LOAD_DISTANCE = 6; // in chunks
export const DEFAULT_UNLOAD_DISTANCE = 8; // in chunks

export const MAX_LOD_LEVEL = 3;

export const FACE_NORMALS = {
  px: [1, 0, 0],
  nx: [-1, 0, 0],
  py: [0, 1, 0],
  ny: [0, -1, 0],
  pz: [0, 0, 1],
  nz: [0, 0, -1],
} as const;

export type FaceKey = keyof typeof FACE_NORMALS;

export const FACE_ORDER: FaceKey[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

export const LOD_DISTANCE_THRESHOLDS = [
  { level: 0, maxDistance: 2 },
  { level: 1, maxDistance: 4 },
  { level: 2, maxDistance: 6 },
  { level: 3, maxDistance: Infinity },
];
