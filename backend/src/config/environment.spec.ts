import { expandEnvPlaceholders } from './environment';

describe('expandEnvPlaceholders', () => {
  it('returns undefined when value is undefined', () => {
    expect(expandEnvPlaceholders(undefined)).toBeUndefined();
  });

  it('returns the original value when there are no placeholders', () => {
    expect(expandEnvPlaceholders('postgresql://localhost/app_db')).toBe('postgresql://localhost/app_db');
  });

  it('expands referenced environment variables', () => {
    const env = { ...process.env, POSTGRES_USER: 'app_user', POSTGRES_PASSWORD: 'secret', POSTGRES_DB: 'app_db' };

    const expanded = expandEnvPlaceholders('postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost/${POSTGRES_DB}', env);

    expect(expanded).toBe('postgresql://app_user:secret@localhost/app_db');
  });

  it('uses the provided default value when the variable is missing', () => {
    const env = { ...process.env };

    const expanded = expandEnvPlaceholders('postgresql://${POSTGRES_USER:-app_user}@localhost/app_db', env);

    expect(expanded).toBe('postgresql://app_user@localhost/app_db');
  });

  it('throws when a variable is missing and there is no default value', () => {
    expect(() => expandEnvPlaceholders('postgresql://${POSTGRES_USER}@localhost/app_db', {})).toThrow(
      'Environment variable "POSTGRES_USER" is not set.',
    );
  });
});
