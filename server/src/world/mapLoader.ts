import type { PathLike } from 'node:fs';

export interface MapSize {
  width: number;
  height: number;
}

export interface MapPosition {
  x: number;
  y: number;
}

export interface MapDoor {
  id: string;
  kind: 'in' | 'out';
  position: MapPosition;
  targetMap?: string | null;
  targetPosition?: MapPosition | null;
}

export interface MapObject {
  id: string;
  name: string;
  position: MapPosition;
  size: MapSize;
  solid: boolean;
  objectId?: string;
  metadata?: Record<string, unknown>;
}

export interface MapLayer {
  id: string;
  name: string;
  order: number;
  visible: boolean;
  tiles: (string | null)[][];
}

export interface ObjectLayer {
  id: string;
  name: string;
  order: number;
  visible: boolean;
  objects: MapObject[];
}

export interface MapDefinition {
  id: string;
  name: string;
  biome: string;
  description: string;
  size: MapSize;
  spawn: MapPosition;
  spawnPoints?: Record<string, MapPosition>;
  blockedAreas: Array<{ x: number; y: number; width: number; height: number }>;
  objects: MapObject[];
  objectLayers: ObjectLayer[];
  doors: MapDoor[];
  portals: unknown[];
  theme: { borderColour: string | null };
  sourcePath: string | null;
  tileTypes: Record<string, unknown>;
  layers: MapLayer[];
  collidableTiles: MapPosition[];
}

export interface LoadOptions {
  baseDirectory?: string;
}

export declare function parseTiledMapDefinition(
  tiledMap: unknown,
  options?: { filePath?: PathLike | string | null; baseDirectory?: string | null }
): Promise<MapDefinition>;

export declare function loadTiledMapDefinition(
  filePath: PathLike | string,
  options?: LoadOptions
): Promise<MapDefinition>;

export { parseTiledMapDefinition, loadTiledMapDefinition } from './mapLoader.js';

export default loadTiledMapDefinition;
