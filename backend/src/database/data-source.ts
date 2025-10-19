import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

import { expandEnvPlaceholders } from '../config/environment';

dotenv.config();

const DEFAULT_HOST = 'postgres';
const DEFAULT_PORT = 5432;
const DEFAULT_USERNAME = 'app_user';
const DEFAULT_PASSWORD = 'com-21';
const DEFAULT_DATABASE = 'app_db';

export interface DatabaseConnectionConfig {
  url: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

const normalizePort = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDatabaseUrl = (databaseUrl: string): DatabaseConnectionConfig | null => {
  try {
    const parsedUrl = new URL(databaseUrl);
    const port = normalizePort(parsedUrl.port, DEFAULT_PORT);
    const database = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, '')) || DEFAULT_DATABASE;

    return {
      url: parsedUrl.toString(),
      host: parsedUrl.hostname || DEFAULT_HOST,
      port,
      username: decodeURIComponent(parsedUrl.username || DEFAULT_USERNAME),
      password: decodeURIComponent(parsedUrl.password || DEFAULT_PASSWORD),
      database,
    };
  } catch {
    return null;
  }
};

const hasExplicitValue = (key: string, env: NodeJS.ProcessEnv): boolean => {
  return env[key] !== undefined || env[`${key}_FILE`] !== undefined;
};

const readEnvFile = (filePath: string): string => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read environment file "${filePath}": ${(error as Error).message}`);
  }
};

const resolveEnvValue = (key: string, env: NodeJS.ProcessEnv, fallback: string): string => {
  const fileKey = `${key}_FILE`;
  const filePath = expandEnvPlaceholders(env[fileKey], env)?.trim();

  if (filePath) {
    return readEnvFile(filePath).trim();
  }

  const expanded = expandEnvPlaceholders(env[key], env)?.trim();

  if (expanded && expanded.length > 0) {
    return expanded;
  }

  return fallback;
};

export const resolveDatabaseConfig = (env: NodeJS.ProcessEnv): DatabaseConnectionConfig => {
  const expandedDatabaseUrl = expandEnvPlaceholders(env.DATABASE_URL, env)?.trim();

  if (expandedDatabaseUrl) {
    const parsed = parseDatabaseUrl(expandedDatabaseUrl);

    if (parsed) {
      let host = parsed.host;
      let port = parsed.port;
      let username = parsed.username;
      let password = parsed.password;
      let database = parsed.database;

      if (hasExplicitValue('DATABASE_HOST', env)) {
        host = resolveEnvValue('DATABASE_HOST', env, host);
      }

      if (hasExplicitValue('DATABASE_PORT', env)) {
        port = normalizePort(resolveEnvValue('DATABASE_PORT', env, String(port)), port);
      }

      if (hasExplicitValue('POSTGRES_USER', env)) {
        username = resolveEnvValue('POSTGRES_USER', env, username);
      }

      if (hasExplicitValue('POSTGRES_PASSWORD', env)) {
        password = resolveEnvValue('POSTGRES_PASSWORD', env, password);
      }

      if (hasExplicitValue('POSTGRES_DB', env)) {
        database = resolveEnvValue('POSTGRES_DB', env, database);
      }

      const normalizedUrl = new URL(parsed.url);
      normalizedUrl.hostname = host;
      normalizedUrl.port = String(port);
      normalizedUrl.username = username;
      normalizedUrl.password = password;
      normalizedUrl.pathname = `/${database}`;

      return {
        url: normalizedUrl.toString(),
        host,
        port,
        username,
        password,
        database,
      };
    }

    // eslint-disable-next-line no-console
    console.warn(
      'DATABASE_URL could not be parsed. Falling back to discrete PostgreSQL environment variables.',
    );
  }

  const host = resolveEnvValue('DATABASE_HOST', env, DEFAULT_HOST);
  const port = normalizePort(resolveEnvValue('DATABASE_PORT', env, String(DEFAULT_PORT)), DEFAULT_PORT);
  const username = resolveEnvValue('POSTGRES_USER', env, DEFAULT_USERNAME);
  const password = resolveEnvValue('POSTGRES_PASSWORD', env, DEFAULT_PASSWORD);
  const database = resolveEnvValue('POSTGRES_DB', env, DEFAULT_DATABASE);

  const fallbackUrl = new URL('postgresql://placeholder');
  fallbackUrl.hostname = host;
  fallbackUrl.port = String(port);
  fallbackUrl.username = username;
  fallbackUrl.password = password;
  fallbackUrl.pathname = `/${database}`;

  return {
    url: fallbackUrl.toString(),
    host,
    port,
    username,
    password,
    database,
  };
};

const databaseConfig = resolveDatabaseConfig(process.env);

process.env.DATABASE_URL = databaseConfig.url;

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseConfig.url,
  host: databaseConfig.host,
  port: databaseConfig.port,
  username: databaseConfig.username,
  password: databaseConfig.password,
  database: databaseConfig.database,
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
