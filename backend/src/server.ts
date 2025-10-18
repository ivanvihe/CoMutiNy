import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'colyseus';
import dotenv from 'dotenv';

import { initializeDatabase } from './database';
import { CommunityRoom, LobbyRoom } from './rooms';

dotenv.config();

const PORT = Number(process.env.PORT) || 2567;

async function bootstrap(): Promise<void> {
  await initializeDatabase();

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', (_req, res) => {
    res.json({ status: 'ready' });
  });

  const httpServer = createServer(app);
  const gameServer = new Server({ server: httpServer });

  gameServer.define('lobby', LobbyRoom);
  gameServer.define('community', CommunityRoom, {
    worldId: process.env.DEFAULT_WORLD_ID,
    chunkSize: Number(process.env.COMMUNITY_CHUNK_SIZE) || CommunityRoom.DEFAULT_CHUNK_SIZE,
  });

  httpServer.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', error);
  process.exit(1);
});
