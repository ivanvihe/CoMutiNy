import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveDatabaseConfig } from './data-source';

describe('resolveDatabaseConfig', () => {
  it('returns parsed values from DATABASE_URL when it is valid', () => {
    const config = resolveDatabaseConfig({
      DATABASE_URL: 'postgresql://user:secret@localhost:6543/app_db?sslmode=require',
    } as NodeJS.ProcessEnv);

    expect(config).toEqual(
      expect.objectContaining({
        url: 'postgresql://user:secret@localhost:6543/app_db?sslmode=require',
        host: 'localhost',
        port: 6543,
        username: 'user',
        password: 'secret',
        database: 'app_db',
      }),
    );
  });

  it('prefers discrete PostgreSQL environment variables over DATABASE_URL when provided', () => {
    const config = resolveDatabaseConfig({
      DATABASE_URL: 'postgresql://user:secret@localhost:6543/app_db',
      POSTGRES_USER: 'override-user',
      POSTGRES_PASSWORD: 'override-password',
      POSTGRES_DB: 'override-db',
      DATABASE_HOST: 'db-service',
      DATABASE_PORT: '5433',
    } as NodeJS.ProcessEnv);

    expect(config).toEqual(
      expect.objectContaining({
        url: 'postgresql://override-user:override-password@db-service:5433/override-db',
        host: 'db-service',
        port: 5433,
        username: 'override-user',
        password: 'override-password',
        database: 'override-db',
      }),
    );
  });

  it('falls back to individual environment variables when DATABASE_URL cannot be parsed', () => {
    const config = resolveDatabaseConfig({
      DATABASE_URL: 'postgresql://user:P@ssword@/app_db',
      POSTGRES_USER: 'user',
      POSTGRES_PASSWORD: 'P@ssword',
      POSTGRES_DB: 'app_db',
      DATABASE_HOST: 'db-service',
      DATABASE_PORT: '5434',
    } as NodeJS.ProcessEnv);

    expect(config).toEqual(
      expect.objectContaining({
        url: 'postgresql://user:P%40ssword@db-service:5434/app_db',
        host: 'db-service',
        port: 5434,
        username: 'user',
        password: 'P@ssword',
        database: 'app_db',
      }),
    );
  });

  it('applies default values when no relevant environment variables are present', () => {
    const config = resolveDatabaseConfig({} as NodeJS.ProcessEnv);

    expect(config).toEqual(
      expect.objectContaining({
        url: 'postgresql://app_user:app_password@postgres:5432/app_db',
        host: 'postgres',
        port: 5432,
        username: 'app_user',
        password: 'app_password',
        database: 'app_db',
      }),
    );
  });

  it('loads credentials from *_FILE environment variables when available', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'database-config-test-'));
    const passwordFile = path.join(tempDir, 'db-password');
    fs.writeFileSync(passwordFile, 'from-file');

    const config = resolveDatabaseConfig({
      POSTGRES_PASSWORD_FILE: passwordFile,
      POSTGRES_USER: 'user-from-env',
    } as NodeJS.ProcessEnv);

    expect(config).toEqual(
      expect.objectContaining({
        username: 'user-from-env',
        password: 'from-file',
      }),
    );
  });
});
