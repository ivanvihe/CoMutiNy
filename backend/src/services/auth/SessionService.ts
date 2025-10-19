import { randomBytes } from 'node:crypto';

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
}

export class SessionService {
  private readonly maxAgeMs: number;

  private readonly sessions = new Map<string, SessionRecord>();

  private readonly userTokens = new Map<string, Set<string>>();

  constructor(maxAgeMs: number = 1000 * 60 * 60 * 24 * 7) {
    this.maxAgeMs = maxAgeMs;
  }

  public createSession(userId: string): SessionRecord {
    const token = this.generateToken();
    const now = new Date();
    const record: SessionRecord = {
      token,
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.maxAgeMs),
      lastUsedAt: now,
    };

    this.sessions.set(token, record);

    const tokens = this.userTokens.get(userId) ?? new Set<string>();
    tokens.add(token);
    this.userTokens.set(userId, tokens);

    return record;
  }

  public getSession(token: string): SessionRecord | null {
    const record = this.sessions.get(token);
    if (!record) {
      return null;
    }

    if (this.isExpired(record)) {
      this.destroySession(token);
      return null;
    }

    record.lastUsedAt = new Date();
    return record;
  }

  public destroySession(token: string): void {
    const record = this.sessions.get(token);
    if (!record) {
      return;
    }

    this.sessions.delete(token);

    const tokens = this.userTokens.get(record.userId);
    if (tokens) {
      tokens.delete(token);
      if (tokens.size === 0) {
        this.userTokens.delete(record.userId);
      }
    }
  }

  public destroyUserSessions(userId: string): void {
    const tokens = this.userTokens.get(userId);
    if (!tokens) {
      return;
    }

    tokens.forEach((token) => {
      this.sessions.delete(token);
    });

    this.userTokens.delete(userId);
  }

  private isExpired(record: SessionRecord): boolean {
    return record.expiresAt.getTime() <= Date.now();
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }
}

export const sessionService = new SessionService();
