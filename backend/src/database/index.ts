import 'reflect-metadata';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DataSource,
  type DataSourceOptions,
} from 'typeorm';
import { SessionEntity } from './entities/Session.entity.js';
import { UserEntity } from './entities/User.entity.js';
import { WorldChunkEntity } from './entities/WorldChunk.entity.js';

export interface DatabaseConnection {
  connect(): Promise<DataSource>;
  getDataSource(): DataSource;
}

function resolveDatabaseOptions(): DataSourceOptions {
  const explicitType = process.env.DB_TYPE ?? process.env.DATABASE_TYPE;
  const databaseUrl = process.env.DATABASE_URL;
  const type = explicitType
    ? explicitType.toLowerCase()
    : databaseUrl?.startsWith('postgres')
      ? 'postgres'
      : 'sqlite';

  if (type === 'postgres') {
    const url =
      databaseUrl ??
      `postgres://${process.env.PGUSER ?? 'postgres'}:${
        process.env.PGPASSWORD ?? 'postgres'
      }@${process.env.PGHOST ?? 'localhost'}:${
        process.env.PGPORT ?? '5432'
      }/${process.env.PGDATABASE ?? 'comutiny'}`;

    return {
      type: 'postgres',
      url,
      entities: [UserEntity, SessionEntity, WorldChunkEntity],
      synchronize: true,
      logging: process.env.DB_LOGGING === 'true',
    } satisfies DataSourceOptions;
  }

  const sqlitePath = process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data', 'comutiny.sqlite');

  return {
    type: 'sqlite',
    database: sqlitePath,
    entities: [UserEntity, SessionEntity, WorldChunkEntity],
    synchronize: true,
    logging: process.env.DB_LOGGING === 'true',
  } satisfies DataSourceOptions;
}

class OrmDatabase implements DatabaseConnection {
  private readonly dataSource: DataSource;

  constructor(options: DataSourceOptions) {
    this.dataSource = new DataSource(options);
  }

  async connect(): Promise<DataSource> {
    if (this.dataSource.isInitialized) {
      return this.dataSource;
    }

    if (this.dataSource.options.type === 'sqlite') {
      const databasePath = this.dataSource.options.database;
      if (typeof databasePath === 'string') {
        const directory = path.dirname(databasePath);
        await fs.mkdir(directory, { recursive: true }).catch(() => undefined);
      }
    }

    await this.dataSource.initialize();
    return this.dataSource;
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }
}

let connection: DatabaseConnection | null = null;

export function createDatabaseConnection(): DatabaseConnection {
  if (!connection) {
    const options = resolveDatabaseOptions();
    connection = new OrmDatabase(options);
  }
  return connection;
}
