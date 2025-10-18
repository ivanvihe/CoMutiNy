import type { FaceKey } from './constants';

export interface BlockPBRTextures {
  albedo: string;
  normal: string;
  roughness: string;
  metallic: string;
  ao?: string;
  emissive?: string;
}

export interface BlockMaterialDefinition {
  name: string;
  textures: Partial<Record<FaceKey, BlockPBRTextures>> & {
    default: BlockPBRTextures;
  };
  isTranslucent?: boolean;
  emissiveStrength?: number;
}

export interface BlockDefinition {
  id: number;
  name: string;
  displayName: string;
  material: BlockMaterialDefinition;
  opaque: boolean;
  solid: boolean;
  lightEmission?: number;
}

export type BlockId = BlockDefinition['id'];

export class BlockRegistry {
  private readonly byId = new Map<BlockId, BlockDefinition>();
  private readonly byName = new Map<string, BlockDefinition>();

  registerBlock(definition: BlockDefinition): void {
    if (this.byId.has(definition.id)) {
      throw new Error(`Block id ${definition.id} already registered`);
    }
    if (this.byName.has(definition.name)) {
      throw new Error(`Block name ${definition.name} already registered`);
    }
    this.byId.set(definition.id, definition);
    this.byName.set(definition.name, definition);
  }

  getById(id: BlockId): BlockDefinition | undefined {
    return this.byId.get(id);
  }

  getByName(name: string): BlockDefinition | undefined {
    return this.byName.get(name);
  }

  getAll(): BlockDefinition[] {
    return [...this.byId.values()];
  }
}

const createDefaultTextures = (
  prefix: string,
): BlockMaterialDefinition['textures'] => ({
  default: {
    albedo: `${prefix}_albedo.png`,
    normal: `${prefix}_normal.png`,
    roughness: `${prefix}_roughness.png`,
    metallic: `${prefix}_metallic.png`,
    ao: `${prefix}_ao.png`,
  },
});

export const createDefaultBlockRegistry = (): BlockRegistry => {
  const registry = new BlockRegistry();

  const defaultBlocks: BlockDefinition[] = [
    {
      id: 1,
      name: 'grass',
      displayName: 'Hierba',
      opaque: true,
      solid: true,
      material: {
        name: 'Grass',
        textures: {
          ...createDefaultTextures('textures/pbr/grass/grass'),
          py: {
            albedo: 'textures/pbr/grass/grass_top_albedo.png',
            normal: 'textures/pbr/grass/grass_top_normal.png',
            roughness: 'textures/pbr/grass/grass_top_roughness.png',
            metallic: 'textures/pbr/grass/grass_top_metallic.png',
            ao: 'textures/pbr/grass/grass_top_ao.png',
          },
          ny: {
            albedo: 'textures/pbr/dirt/dirt_albedo.png',
            normal: 'textures/pbr/dirt/dirt_normal.png',
            roughness: 'textures/pbr/dirt/dirt_roughness.png',
            metallic: 'textures/pbr/dirt/dirt_metallic.png',
            ao: 'textures/pbr/dirt/dirt_ao.png',
          },
        },
      },
    },
    {
      id: 2,
      name: 'dirt',
      displayName: 'Tierra',
      opaque: true,
      solid: true,
      material: {
        name: 'Dirt',
        textures: createDefaultTextures('textures/pbr/dirt/dirt'),
      },
    },
    {
      id: 3,
      name: 'stone',
      displayName: 'Piedra',
      opaque: true,
      solid: true,
      material: {
        name: 'Stone',
        textures: createDefaultTextures('textures/pbr/stone/stone'),
      },
    },
    {
      id: 4,
      name: 'water',
      displayName: 'Agua',
      opaque: false,
      solid: false,
      material: {
        name: 'Water',
        isTranslucent: true,
        emissiveStrength: 0.1,
        textures: createDefaultTextures('textures/pbr/water/water'),
      },
    },
    {
      id: 5,
      name: 'sand',
      displayName: 'Arena',
      opaque: true,
      solid: true,
      material: {
        name: 'Sand',
        textures: createDefaultTextures('textures/pbr/sand/sand'),
      },
    },
  ];

  defaultBlocks.forEach((block) => registry.registerBlock(block));
  return registry;
};
