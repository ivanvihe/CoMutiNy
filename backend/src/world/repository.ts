import { postgresPool } from "../database/postgres";
import { redisClient } from "../database/redis";
import { ChunkCoords, ChunkPayload, generateChunk } from "./generator";

const CACHE_TTL_SECONDS = 60;

const cacheKey = (coords: ChunkCoords) => `chunk:${coords.x}:${coords.z}`;

export async function loadChunk(coords: ChunkCoords): Promise<ChunkPayload> {
  const cached = await redisClient.get(cacheKey(coords));
  if (cached) {
    return JSON.parse(cached) as ChunkPayload;
  }

  const result = await postgresPool.query<{ data: ChunkPayload }>(
    "SELECT data FROM world_chunks WHERE chunk_x = $1 AND chunk_z = $2",
    [coords.x, coords.z]
  );

  if (result.rowCount && result.rows[0]) {
    const payload = result.rows[0].data as unknown as ChunkPayload;
    await redisClient.set(cacheKey(coords), JSON.stringify(payload), "EX", CACHE_TTL_SECONDS);
    return payload;
  }

  const generated = generateChunk(coords);
  await saveChunk(generated);
  return generated;
}

export async function saveChunk(chunk: ChunkPayload) {
  await postgresPool.query(
    `INSERT INTO world_chunks (chunk_x, chunk_z, data, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (chunk_x, chunk_z)
     DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [chunk.coords.x, chunk.coords.z, JSON.stringify(chunk)]
  );
  await redisClient.set(cacheKey(chunk.coords), JSON.stringify(chunk), "EX", CACHE_TTL_SECONDS);
}
