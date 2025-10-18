import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL ?? "postgres://localhost:5432/comutiny";

export const postgresPool = new Pool({ connectionString });

export async function initialisePostgres() {
  const client = await postgresPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS world_chunks (
        chunk_x INTEGER NOT NULL,
        chunk_z INTEGER NOT NULL,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (chunk_x, chunk_z)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}
