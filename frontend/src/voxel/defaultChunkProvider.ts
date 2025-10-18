import { AIR_BLOCK_ID, CHUNK_HEIGHT, CHUNK_SIZE } from './constants';
import { VoxelChunk } from './chunk';
import type { ChunkProvider } from './chunkManager';

const GRASS_BLOCK = 1;
const DIRT_BLOCK = 2;
const STONE_BLOCK = 3;
const WATER_BLOCK = 4;
const SAND_BLOCK = 5;

const WATER_LEVEL = 60;

const sampleHeight = (worldX: number, worldZ: number): number => {
  const n = Math.sin(worldX * 0.045) * Math.cos(worldZ * 0.045);
  const n2 = Math.sin(worldX * 0.0125 + worldZ * 0.025);
  return Math.floor(48 + n * 18 + n2 * 8);
};

export class SimpleTerrainChunkProvider implements ChunkProvider {
  async generateChunk(
    chunkX: number,
    chunkY: number,
    chunkZ: number,
    lodLevel: number,
  ): Promise<VoxelChunk> {
    const chunk = new VoxelChunk(chunkX, chunkY, chunkZ, lodLevel);
    const baseY = chunkY * CHUNK_HEIGHT;

    const step = 1 << lodLevel;
    for (let localX = 0; localX < CHUNK_SIZE; localX += step) {
      for (let localZ = 0; localZ < CHUNK_SIZE; localZ += step) {
        const worldX = chunkX * CHUNK_SIZE + localX;
        const worldZ = chunkZ * CHUNK_SIZE + localZ;
        const height = sampleHeight(worldX, worldZ);

        for (let sx = 0; sx < step && localX + sx < CHUNK_SIZE; sx += 1) {
          for (let sz = 0; sz < step && localZ + sz < CHUNK_SIZE; sz += 1) {
            for (let localY = 0; localY < CHUNK_HEIGHT; localY += 1) {
              const worldY = baseY + localY;
              let blockId = AIR_BLOCK_ID;

              if (worldY <= height) {
                if (worldY === height) {
                  if (worldY < WATER_LEVEL - 2) {
                    blockId = GRASS_BLOCK;
                  } else if (worldY < WATER_LEVEL) {
                    blockId = SAND_BLOCK;
                  } else {
                    blockId = DIRT_BLOCK;
                  }
                } else if (worldY > height - 4) {
                  blockId = DIRT_BLOCK;
                } else {
                  blockId = STONE_BLOCK;
                }
              } else if (worldY <= WATER_LEVEL) {
                blockId = WATER_BLOCK;
              }

              chunk.setBlock(localX + sx, localY, localZ + sz, blockId);
            }
          }
        }
      }
    }

    chunk.needsRemesh = true;
    return chunk;
  }
}
