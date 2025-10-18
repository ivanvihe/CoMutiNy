import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { BLOCK_REGISTRY } from "@voxel/registry";
import { BlockDefinition, BlockId, ChunkData } from "@voxel/types";

MeshBuilder.CreateBox.name;

const materialCache = new Map<BlockId, PBRMaterial>();

function getMaterial(scene: Scene, block: BlockDefinition) {
  if (materialCache.has(block.id)) {
    return materialCache.get(block.id)!;
  }
  const material = new PBRMaterial(`block-${block.id}`, scene);
  material.albedoColor = Color3.FromArray(block.palette.albedo);
  material.metallic = block.palette.metallic;
  material.roughness = block.palette.roughness;
  material.alpha = block.isTransparent ? 0.6 : 1.0;
  material.transparencyMode = block.isTransparent ? PBRMaterial.PBRMATERIAL_ALPHABLEND : undefined;
  if (block.palette.emissive) {
    material.emissiveColor = Color3.FromArray(block.palette.emissive);
  }
  if (block.isLiquid) {
    material.indexOfRefraction = 1.33;
    material.alpha = 0.55;
    material.backFaceCulling = false;
  }
  materialCache.set(block.id, material);
  return material;
}

export function createChunkMesh(scene: Scene, chunk: ChunkData, registry = BLOCK_REGISTRY): Mesh {
  const root = new Mesh(`chunk-${chunk.coords.x}-${chunk.coords.z}`, scene);

  chunk.blocks.forEach((block) => {
    const definition = registry[block.id];
    if (!definition || block.id === "air") {
      return;
    }
    const mesh = MeshBuilder.CreateBox(
      `block-${block.position.join("-")}`,
      { size: 1 },
      scene
    );
    mesh.position.set(block.position[0], block.position[1], block.position[2]);
    mesh.material = getMaterial(scene, definition);
    mesh.receiveShadows = true;
    mesh.parent = root;
  });

  return root;
}
