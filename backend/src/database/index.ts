export interface DatabaseConnection {
  connect(): Promise<void>;
}

class InMemoryDatabase implements DatabaseConnection {
  async connect(): Promise<void> {
    console.log('Base de datos en memoria lista. Sustituir por PostgreSQL/Redis en el futuro.');
  }
}

export function createDatabaseConnection(): DatabaseConnection {
  return new InMemoryDatabase();
}
