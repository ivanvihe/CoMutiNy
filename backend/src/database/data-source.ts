import 'reflect-metadata';
import path from 'node:path';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

import { expandEnvPlaceholders } from '../config/environment';

dotenv.config();

const databaseUrl = expandEnvPlaceholders(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

process.env.DATABASE_URL = databaseUrl;

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [path.join(__dirname, '../entities/**/*.{ts,js}')],
  migrations: [path.join(__dirname, './migrations/**/*.{ts,js}')],
  migrationsRun: true,
  synchronize: false,
  logging: false,
});

/**
 * Initialize the TypeORM data source.
 */
export const initializeDatabase = async (): Promise<DataSource> => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  return AppDataSource;
};
