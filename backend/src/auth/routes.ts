import type { Request } from 'express';
import { Router } from 'express';
import { getAuthService } from '../context.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
      return;
    }

    const session = await getAuthService().register(username, password);
    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Error inesperado' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
      return;
    }

    const session = await getAuthService().login(username, password);
    res.json(session);
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : 'Credenciales inválidas' });
  }
});

router.get('/session', async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesión no válida' });
    return;
  }

  const session = await getAuthService().verifySession(token);
  if (!session) {
    res.status(401).json({ error: 'Sesión no válida' });
    return;
  }

  res.json(session);
});

router.post('/logout', async (req, res) => {
  const token = extractToken(req);
  if (token) {
    await getAuthService().logout(token);
  }
  res.status(204).send();
});

function extractToken(req: Request): string | null {
  const authHeader = req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const token = (req.body as Record<string, unknown> | undefined)?.token ?? req.query?.token;
  return typeof token === 'string' ? token : null;
}

export default router;
