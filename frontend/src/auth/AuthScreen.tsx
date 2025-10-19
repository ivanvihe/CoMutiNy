import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { login, register } from './api';
import { storeSession } from './session';
import type { SessionData } from './session';
import './AuthScreen.css';

interface AuthScreenProps {
  onAuthenticated(session: SessionData): void;
}

type AuthMode = 'login' | 'register';

const emptyForm = {
  email: '',
  password: '',
  displayName: '',
};

export const AuthScreen = ({ onAuthenticated }: AuthScreenProps) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [form, setForm] = useState({ ...emptyForm });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = form.email.trim();
    const password = form.password.trim();
    const displayName = form.displayName.trim();

    if (!email || !password || (mode === 'register' && !displayName)) {
      setError('Completa todos los campos requeridos.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const session =
        mode === 'login'
          ? await login({ email, password })
          : await register({ email, password, displayName });

      storeSession(session);
      onAuthenticated(session);
    } catch (authError) {
      if (authError instanceof Error) {
        setError(authError.message);
      } else {
        setError('No se pudo completar la operación.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (key: keyof typeof emptyForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const toggleMode = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'));
    setForm((current) => ({ email: current.email, password: '', displayName: '' }));
    setError(null);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <h1>CoMutiNy</h1>
          <p>Inicia sesión para entrar a la comunidad.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label">
            Correo electrónico
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange('email')}
              required
              disabled={isSubmitting}
            />
          </label>

          {mode === 'register' && (
            <label className="auth-label">
              Nombre para mostrar
              <input
                type="text"
                autoComplete="nickname"
                value={form.displayName}
                onChange={handleChange('displayName')}
                required
                disabled={isSubmitting}
              />
            </label>
          )}

          <label className="auth-label">
            Contraseña
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={handleChange('password')}
              required
              disabled={isSubmitting}
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Cargando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <button type="button" className="auth-toggle" onClick={toggleMode} disabled={isSubmitting}>
          {mode === 'login'
            ? '¿Aún no tienes cuenta? Regístrate'
            : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </div>
    </div>
  );
};
