import { BlockDefinition, BlockId } from "@voxel/types";

export const BLOCK_REGISTRY: Record<BlockId, BlockDefinition> = {
  air: {
    id: "air",
    label: "Vacío",
    palette: { albedo: [0, 0, 0], metallic: 0, roughness: 1 },
    isTransparent: true
  },
  stone: {
    id: "stone",
    label: "Piedra",
    palette: { albedo: [0.45, 0.47, 0.5], metallic: 0.05, roughness: 0.7 }
  },
  grass: {
    id: "grass",
    label: "Césped",
    palette: { albedo: [0.32, 0.58, 0.33], metallic: 0.03, roughness: 0.55 }
  },
  soil: {
    id: "soil",
    label: "Tierra",
    palette: { albedo: [0.36, 0.26, 0.19], metallic: 0.02, roughness: 0.75 }
  },
  wood: {
    id: "wood",
    label: "Madera",
    palette: { albedo: [0.45, 0.32, 0.18], metallic: 0.08, roughness: 0.6 }
  },
  glass: {
    id: "glass",
    label: "Vidrio",
    palette: { albedo: [0.8, 0.86, 0.94], metallic: 0.02, roughness: 0.05 },
    isTransparent: true
  },
  water: {
    id: "water",
    label: "Agua",
    palette: { albedo: [0.1, 0.25, 0.6], metallic: 0.02, roughness: 0.02 },
    isLiquid: true,
    isTransparent: true
  },
  light: {
    id: "light",
    label: "Luz",
    palette: {
      albedo: [0.95, 0.92, 0.8],
      emissive: [1.5, 1.4, 1.2],
      metallic: 0.0,
      roughness: 0.2
    }
  }
};

export const INVENTORY_PRESET: BlockId[] = [
  "grass",
  "soil",
  "stone",
  "wood",
  "glass",
  "water",
  "light"
];
