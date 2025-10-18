import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import {
  CHUNK_SIZE,
  DEFAULT_LOAD_DISTANCE,
  DEFAULT_UNLOAD_DISTANCE,
  LOD_DISTANCE_THRESHOLDS,
} from './constants';
import { VoxelChunk, getChunkKey, type ChunkKey } from './chunk';
import { CHUNK_HEIGHT } from './constants';

export interface ChunkProvider {
  generateChunk(
    chunkX: number,
    chunkY: number,
    chunkZ: number,
    lodLevel: number,
  ): Promise<VoxelChunk>;
}

export interface ChunkManagerOptions {
  loadDistance?: number;
  unloadDistance?: number;
  provider: ChunkProvider;
}

export interface ChunkLoadEvent {
  chunk: VoxelChunk;
  lodLevel: number;
}

export interface ChunkUnloadEvent {
  chunkKey: ChunkKey;
}

export class ChunkManager {
  private readonly loadDistance: number;
  private readonly unloadDistance: number;
  private readonly provider: ChunkProvider;
  private readonly loadedChunks = new Map<ChunkKey, VoxelChunk>();
  private readonly pendingLoads = new Map<ChunkKey, Promise<VoxelChunk>>();

  onChunkLoaded?: (event: ChunkLoadEvent) => void;
  onChunkUnloaded?: (event: ChunkUnloadEvent) => void;

  constructor(options: ChunkManagerOptions) {
    this.loadDistance = options.loadDistance ?? DEFAULT_LOAD_DISTANCE;
    this.unloadDistance = options.unloadDistance ?? DEFAULT_UNLOAD_DISTANCE;
    if (this.unloadDistance <= this.loadDistance) {
      throw new Error(
        'unloadDistance must be larger than loadDistance to avoid oscillation',
      );
    }
    this.provider = options.provider;
  }

  getLoadedChunks(): VoxelChunk[] {
    return [...this.loadedChunks.values()];
  }

  getChunkContaining(x: number, y: number, z: number): VoxelChunk | undefined {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_HEIGHT);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const key = getChunkKey(chunkX, chunkY, chunkZ);
    return this.loadedChunks.get(key);
  }

  async update(cameraPosition: Vector3): Promise<void> {
    const [centerChunkX, centerChunkY, centerChunkZ] =
      this.worldToChunkCoords(cameraPosition);
    await this.loadChunks(centerChunkX, centerChunkY, centerChunkZ);
    this.unloadFarChunks(centerChunkX, centerChunkY, centerChunkZ);
  }

  private worldToChunkCoords(position: Vector3): [number, number, number] {
    return [
      Math.floor(position.x / CHUNK_SIZE),
      Math.floor(position.y / CHUNK_SIZE),
      Math.floor(position.z / CHUNK_SIZE),
    ];
  }

  private async loadChunks(
    centerX: number,
    centerY: number,
    centerZ: number,
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (
      let x = centerX - this.loadDistance;
      x <= centerX + this.loadDistance;
      x += 1
    ) {
      for (let y = centerY - 1; y <= centerY + 1; y += 1) {
        for (
          let z = centerZ - this.loadDistance;
          z <= centerZ + this.loadDistance;
          z += 1
        ) {
          const key = getChunkKey(x, y, z);
          if (this.loadedChunks.has(key) || this.pendingLoads.has(key)) {
            continue;
          }

          const lodLevel = this.resolveLODLevel(
            centerX,
            centerY,
            centerZ,
            x,
            y,
            z,
          );
          const promise = this.provider
            .generateChunk(x, y, z, lodLevel)
            .then((chunk) => {
              this.loadedChunks.set(key, chunk);
              this.pendingLoads.delete(key);
              this.onChunkLoaded?.({ chunk, lodLevel });
            })
            .catch((error) => {
              console.error('Failed to generate chunk', { key, error });
              this.pendingLoads.delete(key);
            });
          this.pendingLoads.set(
            key,
            promise.then(() => this.loadedChunks.get(key) as VoxelChunk),
          );
          promises.push(promise);
        }
      }
    }

    await Promise.all(promises);
  }

  private unloadFarChunks(
    centerX: number,
    centerY: number,
    centerZ: number,
  ): void {
    for (const [key, chunk] of this.loadedChunks.entries()) {
      const distance = this.distanceToChunk(
        centerX,
        centerY,
        centerZ,
        chunk.chunkX,
        chunk.chunkY,
        chunk.chunkZ,
      );
      if (distance > this.unloadDistance) {
        this.loadedChunks.delete(key);
        this.onChunkUnloaded?.({ chunkKey: key });
      }
    }
  }

  private resolveLODLevel(
    centerX: number,
    centerY: number,
    centerZ: number,
    chunkX: number,
    chunkY: number,
    chunkZ: number,
  ): number {
    const distance = this.distanceToChunk(
      centerX,
      centerY,
      centerZ,
      chunkX,
      chunkY,
      chunkZ,
    );
    for (const threshold of LOD_DISTANCE_THRESHOLDS) {
      if (distance <= threshold.maxDistance) {
        return threshold.level;
      }
    }
    return (
      LOD_DISTANCE_THRESHOLDS[LOD_DISTANCE_THRESHOLDS.length - 1]?.level ?? 0
    );
  }

  private distanceToChunk(
    centerX: number,
    centerY: number,
    centerZ: number,
    chunkX: number,
    chunkY: number,
    chunkZ: number,
  ): number {
    const dx = chunkX - centerX;
    const dy = chunkY - centerY;
    const dz = chunkZ - centerZ;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
