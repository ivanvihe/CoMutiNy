import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';

import { createDefaultBlockRegistry, type BlockDefinition, type BlockRegistry } from './blocks';
import type { ChunkProvider } from './chunkManager';
import { ChunkManager } from './chunkManager';
import {
  getChunkKey,
  type ChunkKey,
  type VoxelChunk,
  chunkToWorld,
} from './chunk';
import { ProceduralTerrainChunkProvider } from './terrain';
import type { TerrainParameters } from './terrain';
import { normalizeTerrainParameters } from './terrain';
import { GreedyMesher } from './greedyMesher';
import { BlockMaterialManager, ChunkRenderer } from './materialManager';
import { AIR_BLOCK_ID, CHUNK_HEIGHT, CHUNK_SIZE } from './constants';

interface Vector3Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface VoxelWorldOptions {
  scene: Scene;
  provider?: ChunkProvider;
  loadDistance?: number;
  unloadDistance?: number;
  terrainParameters?: Partial<TerrainParameters> | TerrainParameters;
  shadowGenerators?: ShadowGenerator[];
}

export class VoxelWorld {
  private readonly registry: BlockRegistry;
  private readonly chunkManager: ChunkManager;
  private readonly mesher: GreedyMesher;
  private readonly materialManager: BlockMaterialManager;
  private readonly renderer: ChunkRenderer;
  private readonly chunkMeshes = new Map<ChunkKey, Mesh>();
  private readonly shadowGenerators: ShadowGenerator[];
  private readonly blockOverrides = new Map<string, number>();

  constructor(options: VoxelWorldOptions) {
    this.registry = createDefaultBlockRegistry();
    const provider =
      options.provider ??
      new ProceduralTerrainChunkProvider(
        normalizeTerrainParameters(options.terrainParameters),
      );
    this.chunkManager = new ChunkManager({
      provider,
      loadDistance: options.loadDistance,
      unloadDistance: options.unloadDistance,
    });
    this.mesher = new GreedyMesher(this.registry);
    this.materialManager = new BlockMaterialManager(
      options.scene,
      this.registry,
    );
    this.renderer = new ChunkRenderer(options.scene, this.materialManager);
    this.shadowGenerators = options.shadowGenerators ?? [];

    this.chunkManager.onChunkLoaded = ({ chunk }) =>
      this.handleChunkLoaded(chunk);
    this.chunkManager.onChunkUnloaded = ({ chunkKey }) =>
      this.handleChunkUnloaded(chunkKey);
  }

  getRegistry(): BlockRegistry {
    return this.registry;
  }

  getBlockDefinitionAt(position: Vector3Coordinates): BlockDefinition | undefined {
    const normalized = this.normalizeCoordinates(position);
    const key = this.getBlockKey(normalized);
    const override = this.blockOverrides.get(key);
    if (override !== undefined) {
      return override === AIR_BLOCK_ID ? undefined : this.registry.getById(override);
    }

    const chunk = this.chunkManager.getChunkContaining(
      normalized.x,
      normalized.y,
      normalized.z,
    );
    if (!chunk) {
      return undefined;
    }
    const [originX, originY, originZ] = chunkToWorld(
      chunk.chunkX,
      chunk.chunkY,
      chunk.chunkZ,
    );
    const localX = normalized.x - originX;
    const localY = normalized.y - originY;
    const localZ = normalized.z - originZ;
    if (!this.isWithinChunk(localX, localY, localZ)) {
      return undefined;
    }
    const blockId = chunk.getBlock(localX, localY, localZ);
    if (blockId === AIR_BLOCK_ID) {
      return undefined;
    }
    return this.registry.getById(blockId);
  }

  applyBlockChange(position: Vector3Coordinates, type: string | null): void {
    const normalized = this.normalizeCoordinates(position);
    const key = this.getBlockKey(normalized);
    const blockId = this.resolveBlockId(type);
    this.blockOverrides.set(key, blockId);

    const chunk = this.chunkManager.getChunkContaining(
      normalized.x,
      normalized.y,
      normalized.z,
    );
    if (!chunk) {
      return;
    }

    this.updateChunkBlock(chunk, normalized, blockId);
    this.rebuildChunkMesh(chunk);
  }

  async update(cameraPosition: Vector3): Promise<void> {
    await this.chunkManager.update(cameraPosition);
  }

  dispose(): void {
    for (const mesh of this.chunkMeshes.values()) {
      mesh?.dispose();
    }
    this.chunkMeshes.clear();
  }

  private handleChunkLoaded(chunk: VoxelChunk): void {
    const overridesApplied = this.applyOverridesToChunk(chunk);
    if (!chunk.needsRemesh && !overridesApplied) {
      return;
    }
    this.buildChunkMesh(chunk);
  }

  private handleChunkUnloaded(chunkKey: ChunkKey): void {
    const mesh = this.chunkMeshes.get(chunkKey);
    if (mesh) {
      if (this.shadowGenerators.length > 0) {
        for (const generator of this.shadowGenerators) {
          generator.removeShadowCaster(mesh);
        }
      }
      mesh.dispose();
      this.chunkMeshes.delete(chunkKey);
    }
  }

  private buildChunkMesh(chunk: VoxelChunk): void {
    const meshData = this.mesher.generate(chunk);
    const key = getChunkKey(chunk.chunkX, chunk.chunkY, chunk.chunkZ);
    const existing = this.chunkMeshes.get(key);
    const hasGeometry =
      meshData.positions.length > 0 && meshData.indices.length > 0;

    if (!hasGeometry) {
      if (existing) {
        if (this.shadowGenerators.length > 0) {
          for (const generator of this.shadowGenerators) {
            generator.removeShadowCaster(existing);
          }
        }
        existing.dispose();
        this.chunkMeshes.delete(key);
      }
      chunk.needsRemesh = false;
      return;
    }

    if (existing) {
      if (this.shadowGenerators.length > 0) {
        for (const generator of this.shadowGenerators) {
          generator.removeShadowCaster(existing);
        }
      }
      existing.dispose();
    }

    const mesh = this.renderer.buildMesh(key, meshData);
    if (this.shadowGenerators.length > 0) {
      mesh.receiveShadows = true;
      for (const generator of this.shadowGenerators) {
        generator.addShadowCaster(mesh, true);
      }
    }
    this.chunkMeshes.set(key, mesh);
    chunk.needsRemesh = false;
  }

  private applyOverridesToChunk(chunk: VoxelChunk): boolean {
    if (this.blockOverrides.size === 0) {
      return false;
    }
    const [originX, originY, originZ] = chunkToWorld(
      chunk.chunkX,
      chunk.chunkY,
      chunk.chunkZ,
    );
    const maxX = originX + CHUNK_SIZE;
    const maxY = originY + CHUNK_HEIGHT;
    const maxZ = originZ + CHUNK_SIZE;
    let modified = false;

    for (const [key, blockId] of this.blockOverrides.entries()) {
      const coordinates = this.parseBlockKey(key);
      if (!coordinates) {
        continue;
      }
      const { x, y, z } = coordinates;
      if (x < originX || x >= maxX || y < originY || y >= maxY || z < originZ || z >= maxZ) {
        continue;
      }
      const localX = x - originX;
      const localY = y - originY;
      const localZ = z - originZ;
      const current = chunk.getBlock(localX, localY, localZ);
      if (current !== blockId) {
        chunk.setBlock(localX, localY, localZ, blockId);
        modified = true;
      }
    }

    return modified;
  }

  private updateChunkBlock(
    chunk: VoxelChunk,
    position: Vector3Coordinates,
    blockId: number,
  ): void {
    const [originX, originY, originZ] = chunkToWorld(
      chunk.chunkX,
      chunk.chunkY,
      chunk.chunkZ,
    );
    const localX = position.x - originX;
    const localY = position.y - originY;
    const localZ = position.z - originZ;
    if (!this.isWithinChunk(localX, localY, localZ)) {
      return;
    }
    chunk.setBlock(localX, localY, localZ, blockId);
  }

  private normalizeCoordinates(position: Vector3Coordinates): Vector3Coordinates {
    return {
      x: Math.round(position.x),
      y: Math.round(position.y),
      z: Math.round(position.z),
    };
  }

  private getBlockKey(position: Vector3Coordinates): string {
    return `${position.x}:${position.y}:${position.z}`;
  }

  private parseBlockKey(key: string): Vector3Coordinates | null {
    const parts = key.split(':');
    if (parts.length !== 3) {
      return null;
    }
    const [x, y, z] = parts.map((value) => Number(value));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return null;
    }
    return { x, y, z };
  }

  private resolveBlockId(type: string | null): number {
    if (!type || type === 'air') {
      return AIR_BLOCK_ID;
    }
    const block = this.registry.getByName(type);
    return block?.id ?? AIR_BLOCK_ID;
  }

  private isWithinChunk(x: number, y: number, z: number): boolean {
    return (
      x >= 0 &&
      x < CHUNK_SIZE &&
      y >= 0 &&
      y < CHUNK_HEIGHT &&
      z >= 0 &&
      z < CHUNK_SIZE
    );
  }

  private rebuildChunkMesh(chunk: VoxelChunk): void {
    this.buildChunkMesh(chunk);
  }
}
