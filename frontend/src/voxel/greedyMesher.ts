import type { BlockRegistry } from './blocks';
import {
  AIR_BLOCK_ID,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  FACE_NORMALS,
  FACE_ORDER,
} from './constants';
import type { ChunkMesh } from './chunk';
import { VoxelChunk } from './chunk';

interface FaceConfig {
  axis: 0 | 1 | 2;
  direction: 1 | -1;
  faceKey: keyof typeof FACE_NORMALS;
  u: 0 | 1 | 2;
  v: 0 | 1 | 2;
  originOffset: [number, number, number];
  neighborOffset: [number, number, number];
}

interface FaceMaskCell {
  blockId: number;
}

const FACE_CONFIGS: Record<(typeof FACE_ORDER)[number], FaceConfig> = {
  px: {
    axis: 0,
    direction: 1,
    faceKey: 'px',
    u: 1,
    v: 2,
    originOffset: [1, 0, 0],
    neighborOffset: [1, 0, 0],
  },
  nx: {
    axis: 0,
    direction: -1,
    faceKey: 'nx',
    u: 1,
    v: 2,
    originOffset: [0, 0, 0],
    neighborOffset: [-1, 0, 0],
  },
  py: {
    axis: 1,
    direction: 1,
    faceKey: 'py',
    u: 2,
    v: 0,
    originOffset: [0, 1, 0],
    neighborOffset: [0, 1, 0],
  },
  ny: {
    axis: 1,
    direction: -1,
    faceKey: 'ny',
    u: 2,
    v: 0,
    originOffset: [0, 0, 0],
    neighborOffset: [0, -1, 0],
  },
  pz: {
    axis: 2,
    direction: 1,
    faceKey: 'pz',
    u: 0,
    v: 1,
    originOffset: [0, 0, 1],
    neighborOffset: [0, 0, 1],
  },
  nz: {
    axis: 2,
    direction: -1,
    faceKey: 'nz',
    u: 0,
    v: 1,
    originOffset: [0, 0, 0],
    neighborOffset: [0, 0, -1],
  },
};

export class GreedyMesher {
  private readonly registry: BlockRegistry;

  constructor(registry: BlockRegistry) {
    this.registry = registry;
  }

  generate(chunk: VoxelChunk): ChunkMesh {
    const mesh: ChunkMesh = {
      positions: [],
      normals: [],
      uvs: [],
      indices: [],
      faces: [],
    };

    const dims: [number, number, number] = [
      CHUNK_SIZE,
      CHUNK_HEIGHT,
      CHUNK_SIZE,
    ];

    for (const faceKey of FACE_ORDER) {
      this.buildFaces(chunk, FACE_CONFIGS[faceKey], mesh, dims);
    }

    return mesh;
  }

  private buildFaces(
    chunk: VoxelChunk,
    config: FaceConfig,
    mesh: ChunkMesh,
    dims: [number, number, number],
  ): void {
    const [sizeX, sizeY, sizeZ] = dims;
    const uSize = config.u === 0 ? sizeX : config.u === 1 ? sizeY : sizeZ;
    const vSize = config.v === 0 ? sizeX : config.v === 1 ? sizeY : sizeZ;
    const axisSize =
      config.axis === 0 ? sizeX : config.axis === 1 ? sizeY : sizeZ;
    const mask: (FaceMaskCell | null)[] = new Array(uSize * vSize);

    const cursor: [number, number, number] = [0, 0, 0];
    const neighbor: [number, number, number] = [0, 0, 0];

    for (let axis = 0; axis <= axisSize; axis += 1) {
      let n = 0;
      for (let v = 0; v < vSize; v += 1) {
        for (let u = 0; u < uSize; u += 1) {
          cursor[0] = u;
          cursor[1] = v;
          cursor[2] = axis;

          neighbor[0] = u + config.neighborOffset[0];
          neighbor[1] = v + config.neighborOffset[1];
          neighbor[2] = axis + config.neighborOffset[2];

          const blockId = this.sample(chunk, cursor, config, dims);
          const neighborId = this.sample(chunk, neighbor, config, dims);
          mask[n] = this.shouldRenderFace(blockId, neighborId)
            ? this.createMaskCell(blockId)
            : null;
          n += 1;
        }
      }

      n = 0;
      for (let v = 0; v < vSize; v += 1) {
        for (let u = 0; u < uSize; ) {
          const cell = mask[n];
          if (!cell) {
            u += 1;
            n += 1;
            continue;
          }

          let width = 1;
          while (u + width < uSize && this.canMerge(cell, mask[n + width])) {
            width += 1;
          }

          let height = 1;
          while (v + height < vSize) {
            let mergeable = true;
            for (let k = 0; k < width; k += 1) {
              if (!this.canMerge(cell, mask[n + k + height * uSize])) {
                mergeable = false;
                break;
              }
            }
            if (!mergeable) {
              break;
            }
            height += 1;
          }

          this.createQuad(config, u, v, axis, width, height, cell, mesh);

          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              mask[n + x + y * uSize] = null;
            }
          }

          u += width;
          n += width;
        }
        n += (uSize - (n % uSize)) % uSize;
      }
    }
  }

  private sample(
    chunk: VoxelChunk,
    coords: [number, number, number],
    config: FaceConfig,
    dims: [number, number, number],
  ): number {
    const mapped = this.mapCoordinates(coords, config);
    if (
      mapped[0] < 0 ||
      mapped[1] < 0 ||
      mapped[2] < 0 ||
      mapped[0] >= dims[0] ||
      mapped[1] >= dims[1] ||
      mapped[2] >= dims[2]
    ) {
      return AIR_BLOCK_ID;
    }
    return chunk.getBlock(mapped[0], mapped[1], mapped[2]);
  }

  private mapCoordinates(
    coords: [number, number, number],
    config: FaceConfig,
  ): [number, number, number] {
    const result: [number, number, number] = [0, 0, 0];
    result[config.u] = coords[0];
    result[config.v] = coords[1];
    result[config.axis] = coords[2];
    return result;
  }

  private createMaskCell(blockId: number): FaceMaskCell {
    return { blockId };
  }

  private canMerge(
    cell: FaceMaskCell | null,
    other?: FaceMaskCell | null,
  ): boolean {
    if (!cell || !other) {
      return false;
    }
    return cell.blockId === other.blockId;
  }

  private shouldRenderFace(blockId: number, neighborId: number): boolean {
    if (blockId === AIR_BLOCK_ID) {
      return false;
    }

    const block = this.registry.getById(blockId);
    const neighbor =
      neighborId === AIR_BLOCK_ID
        ? undefined
        : this.registry.getById(neighborId);

    const isBlockRenderable = block
      ? block.solid || !block.opaque || Boolean(block.lightEmission)
      : false;
    if (!isBlockRenderable) {
      return false;
    }

    if (!neighbor) {
      return true;
    }

    const isNeighborRenderable =
      neighbor.solid || !neighbor.opaque || Boolean(neighbor.lightEmission);
    if (!isNeighborRenderable) {
      return true;
    }

    return neighborId !== blockId;
  }

  private createQuad(
    config: FaceConfig,
    u: number,
    v: number,
    axis: number,
    width: number,
    height: number,
    cell: FaceMaskCell,
    mesh: ChunkMesh,
  ): void {
    const base: [number, number, number] = [0, 0, 0];
    base[config.u] = u;
    base[config.v] = v;
    base[config.axis] = axis;

    const origin: [number, number, number] = [
      base[0] + (config.direction === 1 ? config.originOffset[0] : 0),
      base[1] + (config.direction === 1 ? config.originOffset[1] : 0),
      base[2] + (config.direction === 1 ? config.originOffset[2] : 0),
    ];

    const du: [number, number, number] = [0, 0, 0];
    du[config.u] = width;
    const dv: [number, number, number] = [0, 0, 0];
    dv[config.v] = height;

    const vertices: [number, number, number][] =
      config.direction === 1
        ? [
            origin,
            [origin[0] + du[0], origin[1] + du[1], origin[2] + du[2]],
            [
              origin[0] + du[0] + dv[0],
              origin[1] + du[1] + dv[1],
              origin[2] + du[2] + dv[2],
            ],
            [origin[0] + dv[0], origin[1] + dv[1], origin[2] + dv[2]],
          ]
        : [
            origin,
            [origin[0] + dv[0], origin[1] + dv[1], origin[2] + dv[2]],
            [
              origin[0] + du[0] + dv[0],
              origin[1] + du[1] + dv[1],
              origin[2] + du[2] + dv[2],
            ],
            [origin[0] + du[0], origin[1] + du[1], origin[2] + du[2]],
          ];

    const normal = FACE_NORMALS[config.faceKey];
    const uvWidth = width;
    const uvHeight = height;

    const indexOffset = mesh.positions.length / 3;

    const uvCoordinates =
      config.direction === 1
        ? [
            [0, 0],
            [uvWidth, 0],
            [uvWidth, uvHeight],
            [0, uvHeight],
          ]
        : [
            [0, 0],
            [0, uvHeight],
            [uvWidth, uvHeight],
            [uvWidth, 0],
          ];

    for (let i = 0; i < vertices.length; i += 1) {
      const vertex = vertices[i];
      mesh.positions.push(vertex[0], vertex[1], vertex[2]);
      mesh.normals.push(normal[0], normal[1], normal[2]);
      const uv = uvCoordinates[i];
      mesh.uvs.push(uv[0], uv[1]);
    }

    mesh.indices.push(
      indexOffset,
      indexOffset + 1,
      indexOffset + 2,
      indexOffset,
      indexOffset + 2,
      indexOffset + 3,
    );
    mesh.faces.push({ blockId: cell.blockId, face: config.faceKey });
  }
}
