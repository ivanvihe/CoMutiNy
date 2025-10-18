import resolveServerUrl from './resolveServerUrl.js';

describe('resolveServerUrl (server environment)', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    try {
      delete global.window;
    } catch {
      global.window = undefined;
    }
  });

  afterEach(() => {
    if (typeof originalWindow === 'undefined') {
      try {
        delete global.window;
      } catch {
        global.window = undefined;
      }
    } else {
      global.window = originalWindow;
    }

    delete process.env.VITE_SOCKET_URL;
    delete process.env.VITE_SOCKET_PORT;
    delete process.env.VITE_SOCKET_HOST;
    delete process.env.VITE_SOCKET_PROTOCOL;
    delete process.env.VITE_API_BASE_URL;
    delete process.env.VITE_API_PORT;
    delete process.env.VITE_API_HOST;
    delete process.env.VITE_API_PROTOCOL;
  });

  it('prefers the socket URL and appends the configured port when missing', () => {
    process.env.VITE_SOCKET_URL = 'http://api.example.com';
    process.env.VITE_SOCKET_PORT = '4500';

    expect(resolveServerUrl()).toBe('http://api.example.com:4500/');
  });

  it('falls back to configured host and port when URL is not provided', () => {
    process.env.VITE_SOCKET_HOST = '0.0.0.0';
    process.env.VITE_SOCKET_PORT = '4100';

    expect(resolveServerUrl()).toBe('http://0.0.0.0:4100');
  });

  it('resolves relative URLs against the configured host', () => {
    process.env.VITE_SOCKET_URL = '/socket';
    process.env.VITE_SOCKET_HOST = '10.0.0.5';
    process.env.VITE_SOCKET_PORT = '5000';

    expect(resolveServerUrl()).toBe('http://10.0.0.5:5000/socket');
  });
});
