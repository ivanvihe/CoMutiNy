import type { DataSource } from 'typeorm';
import { AuthService } from './auth/service.js';
import { WorldPersistence } from './world/persistence.js';

interface ApplicationContext {
  dataSource: DataSource;
  authService: AuthService;
  worldPersistence: WorldPersistence;
}

let context: ApplicationContext | null = null;

export function initializeContext(dataSource: DataSource): void {
  context = {
    dataSource,
    authService: new AuthService(dataSource),
    worldPersistence: new WorldPersistence(dataSource),
  };
}

function ensureContext(): ApplicationContext {
  if (!context) {
    throw new Error('Application context has not been initialized.');
  }
  return context;
}

export function getDataSource(): DataSource {
  return ensureContext().dataSource;
}

export function getAuthService(): AuthService {
  return ensureContext().authService;
}

export function getWorldPersistence(): WorldPersistence {
  return ensureContext().worldPersistence;
}
