import 'reflect-metadata';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'colyseus';
import authRouter from './auth/routes.js';
import { WorldRoom } from './rooms/world.room.js';
import { createDatabaseConnection } from './database/index.js';
import { getWorldConfig } from './world/config.js';
import { initializeContext } from './context.js';

const PORT = Number(process.env.PORT ?? 2567);

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());
app.use('/auth', authRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/world/config', (_req, res) => {
  res.json(getWorldConfig());
});

app.get('/world/time', (_req, res) => {
  const now = new Date();
  res.json({
    timestamp: now.getTime(),
    iso: now.toISOString(),
    timezoneOffsetMinutes: now.getTimezoneOffset(),
    dayLengthMs: 24 * 60 * 60 * 1000,
  });
});

async function bootstrap(): Promise<void> {
  try {
    const database = createDatabaseConnection();
    const dataSource = await database.connect();
    initializeContext(dataSource);
    console.log('Conexión a base de datos lista.');

    const httpServer = createServer(app);
    const gameServer = new Server({
      server: httpServer,
    });

    gameServer.define('world', WorldRoom);

    gameServer.onShutdown(() => {
      console.log('Cerrando servidor de juegos');
    });

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor HTTP escuchando en http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Error al inicializar la aplicación', error);
    process.exitCode = 1;
  }
}

void bootstrap();
