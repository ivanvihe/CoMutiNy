import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'colyseus';
import dotenv from 'dotenv';

import { AppDataSource, initializeDatabase } from './database';
import { CommunityRoom, LobbyRoom } from './rooms';
import { User } from './entities';
import { AuthService, ensureDefaultAdmin, sessionService } from './services';

dotenv.config();

const PORT = Number(process.env.PORT) || 2567;

async function bootstrap(): Promise<void> {
  await initializeDatabase();

  const app = express();
  app.use(express.json());

  const userRepository = AppDataSource.getRepository(User);
  const authService = new AuthService(userRepository);

  await ensureDefaultAdmin(userRepository);

  const sanitizeUser = (user: User) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
  });

  app.post('/api/auth/register', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';

    if (!email || !password || !displayName) {
      return res.status(400).json({ message: 'email, password y displayName son obligatorios.' });
    }

    try {
      const user = await authService.register({ email, password, displayName });
      sessionService.destroyUserSessions(user.id);
      const session = sessionService.createSession(user.id);

      return res.status(201).json({
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
        user: sanitizeUser(user),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Email already registered') {
        return res.status(409).json({ message: error.message });
      }

      console.error('Failed to register user', error);
      return res.status(500).json({ message: 'No se pudo completar el registro.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!identifier || !password) {
      return res.status(400).json({ message: 'identificador y password son obligatorios.' });
    }

    try {
      const user = await authService.validateCredentials({ identifier, password });

      if (!user) {
        return res.status(401).json({ message: 'Credenciales inválidas.' });
      }

      sessionService.destroyUserSessions(user.id);
      const session = sessionService.createSession(user.id);

      return res.status(200).json({
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
        user: sanitizeUser(user),
      });
    } catch (error) {
      console.error('Failed to process login', error);
      return res.status(500).json({ message: 'No se pudo iniciar sesión.' });
    }
  });

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
