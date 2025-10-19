import { getAuthorizationHeader, SessionData } from './session';

interface AuthSuccessResponse {
  token: string;
  expiresAt: string;
  user: SessionData['user'];
}

interface ApiError extends Error {
  status?: number;
}

const API_BASE = (() => {
  const value = import.meta.env?.VITE_API_URL as string | undefined;
  if (!value || !value.trim()) {
    return '/api';
  }

  return value.replace(/\/$/, '');
})();

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthorizationHeader(),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error: ApiError = new Error('Request failed');
    error.status = response.status;

    try {
      const body = await response.json();
      if (body?.message) {
        error.message = body.message;
      }
    } catch (parseError) {
      console.warn('Unable to parse error body', parseError);
    }

    throw error;
  }

  return response.json() as Promise<T>;
};

export const register = async (payload: {
  email: string;
  password: string;
  displayName: string;
}): Promise<SessionData> => {
  const result = await request<AuthSuccessResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    token: result.token,
    expiresAt: result.expiresAt,
    createdAt: new Date().toISOString(),
    user: result.user,
  };
};

export const login = async (payload: { email: string; password: string }): Promise<SessionData> => {
  const result = await request<AuthSuccessResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    token: result.token,
    expiresAt: result.expiresAt,
    createdAt: new Date().toISOString(),
    user: result.user,
  };
};
