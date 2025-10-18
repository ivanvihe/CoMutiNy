import express from 'express';
import { createServer } from 'http';
import { Server } from 'colyseus';
import { WorldRoom } from './rooms/world.room.js';
import { createDatabaseConnection } from './database/index.js';

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const database = createDatabaseConnection();

database.connect().catch((error) => {
  console.error('Error al inicializar la base de datos', error);
});

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
