import { AIR_BLOCK_ID, CHUNK_HEIGHT, CHUNK_SIZE } from '../constants';
import { VoxelChunk } from '../chunk';
import type { ChunkProvider } from '../chunkManager';
import type { TerrainParameters } from './parameters';
import { normalizeTerrainParameters } from './parameters';
import { PerlinNoise, fractalNoise2D } from './noise';

const normalizeValue = (value: number): number => (value + 1) / 2;

interface TerrainColumnSample {
  terrainHeight: number;
  waterHeight: number;
}

class TerrainNoiseSampler {
  private readonly mountainsNoise: PerlinNoise;
  private readonly valleysNoise: PerlinNoise;
  private readonly plainsNoise: PerlinNoise;
  private readonly waterNoise: PerlinNoise;

  constructor(private readonly parameters: TerrainParameters) {
    const { seed } = parameters;
    this.mountainsNoise = new PerlinNoise(`${seed}:mountains`);
    this.valleysNoise = new PerlinNoise(`${seed}:valleys`);
    this.plainsNoise = new PerlinNoise(`${seed}:plains`);
    this.waterNoise = new PerlinNoise(`${seed}:water`);
  }

  sampleColumn(x: number, z: number): TerrainColumnSample {
    const { features, water, baseHeight } = this.parameters;

    const mountainFractal = fractalNoise2D(
      this.mountainsNoise,
      x / features.mountains.scale,
      z / features.mountains.scale,
      features.mountains,
    );
    const valleyFractal = fractalNoise2D(
      this.valleysNoise,
      x / features.valleys.scale,
      z / features.valleys.scale,
      features.valleys,
    );
    const plainsFractal = fractalNoise2D(
      this.plainsNoise,
      x / features.plains.scale,
      z / features.plains.scale,
      features.plains,
    );

    const mountainsContribution = Math.pow(
      normalizeValue(mountainFractal),
      features.mountains.exponent ?? 1,
    ) * features.mountains.amplitude;

    const valleyNormalized = normalizeValue(-valleyFractal);
    const valleysContribution =
      -Math.pow(valleyNormalized, features.valleys.exponent ?? 1) *
      features.valleys.amplitude;

    const plainsContribution = plainsFractal * features.plains.amplitude;

    const terrainHeight = Math.max(
      0,
      Math.floor(
        baseHeight + mountainsContribution + valleysContribution + plainsContribution,
      ),
    );

    const waterFractal = fractalNoise2D(
      this.waterNoise,
      x / water.scale,
      z / water.scale,
      water,
    );
    const waterOffset = (Math.pow(normalizeValue(waterFractal), water.exponent ?? 1) - 0.5) * 2;
    const waterHeight = Math.max(
      0,
      Math.floor(water.baseLevel + waterOffset * water.amplitude),
    );

    return {
      terrainHeight,
      waterHeight,
    };
  }
}

export class ProceduralTerrainChunkProvider implements ChunkProvider {
  private readonly sampler: TerrainNoiseSampler;
  private readonly parameters: TerrainParameters;

  constructor(parameters?: Partial<TerrainParameters> | TerrainParameters) {
    this.parameters = normalizeTerrainParameters(parameters);
    this.sampler = new TerrainNoiseSampler(this.parameters);
  }

  getParameters(): TerrainParameters {
    return this.parameters;
  }

  async generateChunk(
    chunkX: number,
    chunkY: number,
    chunkZ: number,
    lodLevel: number,
  ): Promise<VoxelChunk> {
    const chunk = new VoxelChunk(chunkX, chunkY, chunkZ, lodLevel);
    const baseY = chunkY * CHUNK_HEIGHT;
    const step = 1 << lodLevel;
    const { surfaceDepth, soilDepth, surfaceBlock, soilBlock, stoneBlock, waterBlock } =
      this.parameters.layers;

    for (let localX = 0; localX < CHUNK_SIZE; localX += step) {
      for (let localZ = 0; localZ < CHUNK_SIZE; localZ += step) {
        const worldX = chunkX * CHUNK_SIZE + localX;
        const worldZ = chunkZ * CHUNK_SIZE + localZ;

        const { terrainHeight, waterHeight } = this.sampler.sampleColumn(worldX, worldZ);

        for (let sx = 0; sx < step && localX + sx < CHUNK_SIZE; sx += 1) {
          for (let sz = 0; sz < step && localZ + sz < CHUNK_SIZE; sz += 1) {
            for (let localY = 0; localY < CHUNK_HEIGHT; localY += 1) {
              const worldY = baseY + localY;
              let blockId = AIR_BLOCK_ID;

              if (worldY <= terrainHeight) {
                if (worldY >= terrainHeight - (surfaceDepth - 1)) {
                  blockId = worldY > waterHeight ? surfaceBlock : soilBlock;
                } else if (worldY >= terrainHeight - (surfaceDepth + soilDepth)) {
                  blockId = soilBlock;
                } else {
                  blockId = stoneBlock;
                }
              } else if (worldY <= waterHeight) {
                blockId = waterBlock;
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
