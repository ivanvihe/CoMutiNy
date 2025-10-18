export type BlockId =
  | "air"
  | "stone"
  | "grass"
  | "soil"
  | "wood"
  | "glass"
  | "water"
  | "light";

export interface BlockDefinition {
  id: BlockId;
  label: string;
  palette: {
    albedo: [number, number, number];
    emissive?: [number, number, number];
    metallic: number;
    roughness: number;
  };
  isTransparent?: boolean;
  isLiquid?: boolean;
}

export interface ChunkCoordinates {
  x: number;
  z: number;
}

export interface ChunkBlock {
  id: BlockId;
  position: [number, number, number];
}

export interface ChunkData {
  coords: ChunkCoordinates;
  blocks: ChunkBlock[];
}
