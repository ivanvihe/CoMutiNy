import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

import { VoxelWorld } from './world';
import type { ChunkProvider } from './chunkManager';
import type { TerrainParameters } from './terrain';
import { ProceduralTerrainChunkProvider } from './terrain';

export { BlockRegistry, createDefaultBlockRegistry } from './blocks';
export { ChunkManager, type ChunkProvider } from './chunkManager';
export {
  ProceduralTerrainChunkProvider,
  ProceduralTerrainChunkProvider as SimpleTerrainChunkProvider,
} from './defaultChunkProvider';
export { GreedyMesher } from './greedyMesher';
export { BlockMaterialManager, ChunkRenderer } from './materialManager';
export { VoxelWorld } from './world';
export { DEFAULT_TERRAIN_PARAMETERS, normalizeTerrainParameters, fetchTerrainParameters } from './terrain';
export type { TerrainParameters } from './terrain';

export interface GenerateWorldOptions {
  provider?: ChunkProvider;
  terrainParameters?: Partial<TerrainParameters> | TerrainParameters;
}

export async function generateWorld(
  scene: Scene,
  initialCameraPosition = Vector3.Zero(),
  options: GenerateWorldOptions = {},
): Promise<VoxelWorld> {
  const provider =
    options.provider ??
    new ProceduralTerrainChunkProvider(options.terrainParameters);
  const world = new VoxelWorld({ scene, provider });
  await world.update(initialCameraPosition);
  return world;
}
