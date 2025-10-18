import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial';
import { SubMesh } from '@babylonjs/core/Meshes/subMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';

import type { BlockDefinition, BlockRegistry } from './blocks';
import type { FaceKey } from './constants';
import type { ChunkFaceDescriptor, ChunkMesh } from './chunk';

const DEFAULT_COLOR = Color3.FromHexString('#ffffff');

export class BlockMaterialManager {
  private readonly cache = new Map<string, PBRMaterial>();

  constructor(
    private readonly scene: Scene,
    private readonly registry: BlockRegistry,
  ) {}

  getMaterial(blockId: number, face: FaceKey): PBRMaterial {
    const key = `${blockId}:${face}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const block = this.registry.getById(blockId);
    const material = new PBRMaterial(`block-${blockId}-${face}`, this.scene);
    material.backFaceCulling = true;
    material.specularIntensity = 0.5;
    material.useEnergyConservation = true;
    material.environmentIntensity = 1.0;
    material.albedoColor = DEFAULT_COLOR;

    if (block) {
      const textureDefinition = this.resolveTextures(block, face);
      material.albedoTexture = this.createTexture(textureDefinition.albedo);
      material.bumpTexture = this.createTexture(textureDefinition.normal);
      material.metallicTexture = this.createTexture(textureDefinition.metallic);
      material.useRoughnessFromMetallicTextureGreen = true;
      material.useMetallnessFromMetallicTextureBlue = true;
      material.useAmbientOcclusionFromMetallicTextureRed = Boolean(
        textureDefinition.ao,
      );
      if (textureDefinition.ao) {
        material.ambientTexture = this.createTexture(textureDefinition.ao);
      }
      if (block.material.isTranslucent) {
        material.alpha = 0.75;
        material.backFaceCulling = false;
      }
      if (block.material.emissiveStrength && textureDefinition.emissive) {
        material.emissiveTexture = this.createTexture(
          textureDefinition.emissive,
        );
        material.emissiveColor = Color3.FromHexString('#ffffff').scale(
          block.material.emissiveStrength,
        );
      }
    }

    this.cache.set(key, material);
    return material;
  }

  private resolveTextures(block: BlockDefinition, face: FaceKey) {
    return block.material.textures[face] ?? block.material.textures.default;
  }

  private createTexture(source: string | undefined): Texture | undefined {
    if (!source) {
      return undefined;
    }
    const texture = new Texture(
      source,
      this.scene,
      true,
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    return texture;
  }
}

interface SubMeshDescriptor {
  blockId: number;
  face: FaceKey;
  startFace: number;
  faceCount: number;
}

const FACES_PER_QUAD = 1;
const VERTICES_PER_FACE = 4;
const INDICES_PER_FACE = 6;

export class ChunkRenderer {
  private readonly materialCache = new Map<number, PBRMaterial>();

  constructor(
    private readonly scene: Scene,
    private readonly materials: BlockMaterialManager,
  ) {}

  buildMesh(chunkKey: string, meshData: ChunkMesh): Mesh {
    const mesh = new Mesh(`chunk-${chunkKey}`, this.scene);
    const vertexData = new VertexData();
    vertexData.positions = meshData.positions;
    vertexData.normals = meshData.normals;
    vertexData.indices = meshData.indices;
    vertexData.uvs = meshData.uvs;
    vertexData.applyToMesh(mesh, true);

    const multiMaterial = new MultiMaterial(`chunk-mm-${chunkKey}`, this.scene);
    mesh.material = multiMaterial;
    mesh.subMeshes = [];

    const descriptors = this.groupFaces(meshData.faces);
    for (const descriptor of descriptors) {
      const material = this.getMaterial(descriptor.blockId, descriptor.face);
      let materialIndex = multiMaterial.subMaterials.findIndex(
        (m) => m === material,
      );
      if (materialIndex === -1) {
        multiMaterial.subMaterials.push(material);
        materialIndex = multiMaterial.subMaterials.length - 1;
      }
      const indexStart = descriptor.startFace * INDICES_PER_FACE;
      const indexCount = descriptor.faceCount * INDICES_PER_FACE;
      const vertexStart = descriptor.startFace * VERTICES_PER_FACE;
      const vertexCount = descriptor.faceCount * VERTICES_PER_FACE;
      mesh.subMeshes.push(
        new SubMesh(
          materialIndex,
          vertexStart,
          vertexCount,
          indexStart,
          indexCount,
          mesh,
        ),
      );
    }

    return mesh;
  }

  private getMaterial(blockId: number, face: FaceKey): PBRMaterial {
    const key = (blockId << 3) + face.charCodeAt(0);
    const cached = this.materialCache.get(key);
    if (cached) {
      return cached;
    }
    const material = this.materials.getMaterial(blockId, face);
    this.materialCache.set(key, material);
    return material;
  }

  private groupFaces(faces: ChunkFaceDescriptor[]): SubMeshDescriptor[] {
    const descriptors: SubMeshDescriptor[] = [];
    if (faces.length === 0) {
      return descriptors;
    }

    let current: SubMeshDescriptor = {
      blockId: faces[0].blockId,
      face: faces[0].face,
      startFace: 0,
      faceCount: 0,
    };

    faces.forEach((face, index) => {
      if (face.blockId === current.blockId && face.face === current.face) {
        current.faceCount += FACES_PER_QUAD;
      } else {
        descriptors.push(current);
        current = {
          blockId: face.blockId,
          face: face.face,
          startFace: index,
          faceCount: FACES_PER_QUAD,
        };
      }
    });

    descriptors.push(current);
    return descriptors;
  }
}
