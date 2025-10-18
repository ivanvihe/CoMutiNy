import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

import { createDefaultBlockRegistry, type BlockRegistry } from './blocks';
import type { ChunkProvider } from './chunkManager';
import { ChunkManager } from './chunkManager';
import { getChunkKey, type ChunkKey, type VoxelChunk } from './chunk';
import { SimpleTerrainChunkProvider } from './defaultChunkProvider';
import { GreedyMesher } from './greedyMesher';
import { BlockMaterialManager, ChunkRenderer } from './materialManager';

export interface VoxelWorldOptions {
  scene: Scene;
  provider?: ChunkProvider;
  loadDistance?: number;
  unloadDistance?: number;
}

export class VoxelWorld {
  private readonly registry: BlockRegistry;
  private readonly chunkManager: ChunkManager;
  private readonly mesher: GreedyMesher;
  private readonly materialManager: BlockMaterialManager;
  private readonly renderer: ChunkRenderer;
  private readonly chunkMeshes = new Map<ChunkKey, Mesh>();

  constructor(options: VoxelWorldOptions) {
    this.registry = createDefaultBlockRegistry();
    const provider = options.provider ?? new SimpleTerrainChunkProvider();
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

    this.chunkManager.onChunkLoaded = ({ chunk }) =>
      this.handleChunkLoaded(chunk);
    this.chunkManager.onChunkUnloaded = ({ chunkKey }) =>
      this.handleChunkUnloaded(chunkKey);
  }

  getRegistry(): BlockRegistry {
    return this.registry;
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
    if (!chunk.needsRemesh) {
      return;
    }
    const meshData = this.mesher.generate(chunk);
    const key = getChunkKey(chunk.chunkX, chunk.chunkY, chunk.chunkZ);
    const existing = this.chunkMeshes.get(key);
    existing?.dispose();
    const mesh = this.renderer.buildMesh(key, meshData);
    this.chunkMeshes.set(key, mesh);
    chunk.needsRemesh = false;
  }

  private handleChunkUnloaded(chunkKey: ChunkKey): void {
    const mesh = this.chunkMeshes.get(chunkKey);
    if (mesh) {
      mesh.dispose();
      this.chunkMeshes.delete(chunkKey);
    }
  }
}
