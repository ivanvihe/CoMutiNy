import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

import { VoxelWorld } from './world';

export { BlockRegistry, createDefaultBlockRegistry } from './blocks';
export { ChunkManager, type ChunkProvider } from './chunkManager';
export { SimpleTerrainChunkProvider } from './defaultChunkProvider';
export { GreedyMesher } from './greedyMesher';
export { BlockMaterialManager, ChunkRenderer } from './materialManager';
export { VoxelWorld } from './world';

export function generateWorld(
  scene: Scene,
  initialCameraPosition = Vector3.Zero(),
): VoxelWorld {
  const world = new VoxelWorld({ scene });
  void world.update(initialCameraPosition);
  return world;
}
