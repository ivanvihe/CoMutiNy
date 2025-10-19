export interface AuthenticatedUser {
  id: string;
  email: string | null;
  displayName: string;
  isAdmin: boolean;
}

export interface SessionData {
  token: string;
  expiresAt: string;
  createdAt: string;
  user: AuthenticatedUser;
}

const STORAGE_KEY = 'community.session';

const isBrowser = typeof window !== 'undefined';

const isValidSession = (value: unknown): value is SessionData => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<SessionData>;

  return (
    typeof session.token === 'string' &&
    typeof session.expiresAt === 'string' &&
    typeof session.createdAt === 'string' &&
    !!session.user &&
    typeof session.user.id === 'string' &&
    (typeof session.user.email === 'string' || session.user.email === null) &&
    typeof session.user.displayName === 'string' &&
    typeof session.user.isAdmin === 'boolean'
  );
};

export const loadSession = (): SessionData | null => {
  if (!isBrowser) {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isValidSession(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to parse stored session', error);
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const storeSession = (session: SessionData): void => {
  if (!isBrowser) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const clearSession = (): void => {
  if (!isBrowser) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
};

export const getAuthorizationHeader = (session?: SessionData | null): Record<string, string> => {
  const active = session ?? loadSession();

  if (!active) {
    return {};
  }

  return { Authorization: `Bearer ${active.token}` };
};
