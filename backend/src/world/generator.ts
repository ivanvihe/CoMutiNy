export interface ChunkCoords {
  x: number;
  z: number;
}

export interface ChunkPayload {
  coords: ChunkCoords;
  blocks: Array<{ id: string; position: [number, number, number] }>;
}

const CHUNK_SIZE = 32;
const CHUNK_HEIGHT = 32;
const WATER_LEVEL = 12;

function pickBlock(height: number, y: number): string {
  if (y === height && height >= WATER_LEVEL) {
    return "grass";
  }
  if (y < height && y >= height - 2) {
    return "soil";
  }
  if (y < height) {
    return "stone";
  }
  if (y < WATER_LEVEL) {
    return "water";
  }
  return "air";
}

function heightField(x: number, z: number, offsetX: number, offsetZ: number) {
  const nx = (x + offsetX * CHUNK_SIZE) / 64;
  const nz = (z + offsetZ * CHUNK_SIZE) / 64;
  const ridged = Math.abs(Math.sin(nx * 2.1) + Math.cos(nz * 1.8));
  const valley = Math.sin(nx * 0.7) * Math.cos(nz * 0.6);
  const plateau = Math.sin(nx * 0.15 + nz * 0.1);
  const base = 14 + ridged * 6 + valley * 4 + plateau * 2;
  return Math.max(Math.min(Math.round(base), CHUNK_HEIGHT - 2), 4);
}

export function generateChunk(coords: ChunkCoords): ChunkPayload {
  const blocks: ChunkPayload["blocks"] = [];

  for (let x = 0; x < CHUNK_SIZE; x += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      const height = heightField(x, z, coords.x, coords.z);
      for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
        const block = pickBlock(height, y);
        if (block === "air") {
          continue;
        }
        blocks.push({
          id: block,
          position: [coords.x * CHUNK_SIZE + x, y, coords.z * CHUNK_SIZE + z]
        });
      }
    }
  }

  return { coords, blocks };
}
