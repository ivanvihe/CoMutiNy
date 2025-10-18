import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { DataSource, Repository } from 'typeorm';
import { SessionEntity } from '../database/entities/Session.entity.js';
import { UserEntity } from '../database/entities/User.entity.js';

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS ?? 1000 * 60 * 60 * 24 * 7);

export interface AuthenticatedUser {
  id: string;
  username: string;
}

export interface SessionPayload {
  token: string;
  user: AuthenticatedUser;
  expiresAt: Date;
}

export class AuthService {
  private readonly users: Repository<UserEntity>;
  private readonly sessions: Repository<SessionEntity>;

  constructor(dataSource: DataSource) {
    this.users = dataSource.getRepository(UserEntity);
    this.sessions = dataSource.getRepository(SessionEntity);
  }

  async register(username: string, password: string): Promise<SessionPayload> {
    const normalized = this.normalizeUsername(username);
    await this.ensureUsernameAvailable(normalized);

    const passwordHash = await bcrypt.hash(password, 10);

    const user = this.users.create({
      username: normalized,
      passwordHash,
    });
    await this.users.save(user);

    return this.createSession(user);
  }

  async login(username: string, password: string): Promise<SessionPayload> {
    const normalized = this.normalizeUsername(username);
    const user = await this.users.findOne({
      where: { username: normalized },
    });

    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      throw new Error('Credenciales inválidas');
    }

    return this.createSession(user);
  }

  async createSession(user: UserEntity): Promise<SessionPayload> {
    const now = Date.now();
    const expiresAt = new Date(now + SESSION_TTL_MS);

    const token = crypto.randomBytes(32).toString('hex');
    const session = this.sessions.create({
      token,
      user,
      expiresAt,
      lastSeenAt: new Date(now),
    });

    await this.sessions.save(session);

    return {
      token,
      user: this.toAuthenticatedUser(user),
      expiresAt,
    };
  }

  async verifySession(token: string): Promise<SessionPayload | null> {
    if (!token) {
      return null;
    }

    const session = await this.sessions.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.sessions.remove(session);
      return null;
    }

    session.lastSeenAt = new Date();
    await this.sessions.save(session);

    return {
      token: session.token,
      user: this.toAuthenticatedUser(session.user),
      expiresAt: session.expiresAt,
    };
  }

  async logout(token: string): Promise<void> {
    if (!token) {
      return;
    }
    await this.sessions.delete({ token });
  }

  private normalizeUsername(username: string): string {
    const trimmed = username.trim();
    if (!trimmed) {
      throw new Error('El nombre de usuario es obligatorio');
    }
    return trimmed.toLowerCase();
  }

  private async ensureUsernameAvailable(username: string): Promise<void> {
    const existing = await this.users.findOne({ where: { username } });
    if (existing) {
      throw new Error('El nombre de usuario ya está en uso');
    }
  }

  private toAuthenticatedUser(user: UserEntity): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
    };
  }
}
