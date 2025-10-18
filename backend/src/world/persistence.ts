import type { DataSource, Repository } from 'typeorm';
import { BlockState, Chunk, WorldState } from './state.js';
import { WorldChunkEntity } from '../database/entities/WorldChunk.entity.js';

const CHUNK_SIZE = Number(process.env.WORLD_CHUNK_SIZE ?? 16);

interface StoredBlockState {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  placedBy?: string;
  updatedAt: number;
}

export class WorldPersistence {
  private readonly chunks: Repository<WorldChunkEntity>;

  constructor(dataSource: DataSource) {
    this.chunks = dataSource.getRepository(WorldChunkEntity);
  }

  async loadIntoState(state: WorldState): Promise<void> {
    const records = await this.chunks.find();
    state.chunks.splice(0, state.chunks.length);
    state.blocks.forEach((_, key) => {
      state.blocks.delete(key);
    });

    for (const record of records) {
      const chunk = new Chunk();
      chunk.id = record.id;
      chunk.data = record.data ?? '';
      state.chunks.push(chunk);

      const blocks = this.parseBlocks(record.blocksJson);
      for (const block of blocks) {
        const blockState = new BlockState();
        blockState.id = block.id;
        blockState.type = block.type;
        blockState.position.copyFrom(block.position);
        blockState.placedBy = block.placedBy ?? '';
        blockState.updatedAt = block.updatedAt;
        state.blocks.set(blockState.id, blockState);
      }
    }
  }

  async saveChunkSnapshot(chunkId: string, blocks: StoredBlockState[], data?: string | null): Promise<void> {
    const [chunkX, chunkY, chunkZ] = chunkId.split(',').map((value) => Number(value) || 0);

    const entity = this.chunks.create({
      id: chunkId,
      chunkX,
      chunkY,
      chunkZ,
      data: data ?? null,
      blocksJson: JSON.stringify(blocks),
    });

    await this.chunks.save(entity);
  }

  collectChunkBlocks(state: WorldState, chunkId: string): StoredBlockState[] {
    const [chunkX, chunkY, chunkZ] = chunkId.split(',').map((value) => Number(value) || 0);

    const minX = chunkX * CHUNK_SIZE;
    const minY = chunkY * CHUNK_SIZE;
    const minZ = chunkZ * CHUNK_SIZE;

    const maxX = minX + CHUNK_SIZE;
    const maxY = minY + CHUNK_SIZE;
    const maxZ = minZ + CHUNK_SIZE;

    const results: StoredBlockState[] = [];
    state.blocks.forEach((block) => {
      const { x, y, z } = block.position;
      if (x >= minX && x < maxX && y >= minY && y < maxY && z >= minZ && z < maxZ) {
        results.push({
          id: block.id,
          type: block.type,
          position: { x, y, z },
          placedBy: block.placedBy,
          updatedAt: block.updatedAt,
        });
      }
    });
    return results;
  }

  determineChunkIdFromBlockKey(blockKey: string): string {
    const [x, y, z] = blockKey.split(':').map((value) => Number(value) || 0);
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    return `${chunkX},${chunkY},${chunkZ}`;
  }

  private parseBlocks(blocksJson: string | null | undefined): StoredBlockState[] {
    if (!blocksJson) {
      return [];
    }

    try {
      const parsed = JSON.parse(blocksJson);
      if (!Array.isArray(parsed)) {
        return [];
      }

      const result: StoredBlockState[] = [];
      for (const raw of parsed) {
        if (
          !raw ||
          typeof raw !== 'object' ||
          typeof raw.id !== 'string' ||
          typeof raw.type !== 'string' ||
          typeof raw.position !== 'object'
        ) {
          continue;
        }

        const position = raw.position as Partial<{ x: number; y: number; z: number }>;
        if (
          typeof position.x !== 'number' ||
          typeof position.y !== 'number' ||
          typeof position.z !== 'number'
        ) {
          continue;
        }

        result.push({
          id: raw.id,
          type: raw.type,
          position: {
            x: position.x,
            y: position.y,
            z: position.z,
          },
          placedBy: typeof raw.placedBy === 'string' ? raw.placedBy : undefined,
          updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
        });
      }

      return result;
    } catch (error) {
      console.error('No se pudo parsear el bloque del chunk', error);
      return [];
    }
  }
}
