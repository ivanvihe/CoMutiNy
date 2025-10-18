import { CHUNK_HEIGHT, CHUNK_SIZE } from './constants';
import type { BlockId } from './blocks';
import type { FaceKey } from './constants';

const TOTAL_VOXELS = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;

export class VoxelChunk {
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
  readonly lodLevel: number;
  readonly blocks: Uint16Array;
  needsRemesh = true;

  constructor(
    chunkX: number,
    chunkY: number,
    chunkZ: number,
    lodLevel = 0,
    blocks?: Uint16Array,
  ) {
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.chunkZ = chunkZ;
    this.lodLevel = lodLevel;
    this.blocks = blocks ?? new Uint16Array(TOTAL_VOXELS);
  }

  static index(x: number, y: number, z: number): number {
    return x + CHUNK_SIZE * (z + CHUNK_HEIGHT * y);
  }

  getBlock(x: number, y: number, z: number): BlockId {
    return this.blocks[VoxelChunk.index(x, y, z)];
  }

  setBlock(x: number, y: number, z: number, id: BlockId): void {
    this.blocks[VoxelChunk.index(x, y, z)] = id;
    this.needsRemesh = true;
  }

  fill(fillBlock: BlockId): void {
    this.blocks.fill(fillBlock);
    this.needsRemesh = true;
  }
}

export interface ChunkFaceDescriptor {
  blockId: number;
  face: FaceKey;
}

export interface ChunkMesh {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  faces: ChunkFaceDescriptor[];
}

export type ChunkKey = string;

export const getChunkKey = (x: number, y: number, z: number): ChunkKey =>
  `${x}|${y}|${z}`;

export const worldToChunk = (
  x: number,
  y: number,
  z: number,
): [number, number, number] => [
  Math.floor(x / CHUNK_SIZE),
  Math.floor(y / CHUNK_HEIGHT),
  Math.floor(z / CHUNK_SIZE),
];

export const chunkToWorld = (
  chunkX: number,
  chunkY: number,
  chunkZ: number,
): [number, number, number] => [
  chunkX * CHUNK_SIZE,
  chunkY * CHUNK_HEIGHT,
  chunkZ * CHUNK_SIZE,
];
