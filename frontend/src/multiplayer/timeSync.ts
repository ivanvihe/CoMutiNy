import { getBackendBaseUrl, sanitizeBackendUrl } from '../config/backend';

type TimeResponse = {
  timestamp?: number;
  iso?: string;
  dayLengthMs?: number;
};

export interface ClockSynchronizer {
  /** Returns the synchronized timestamp in milliseconds. */
  getCurrentTime: () => number;
  /** Starts periodic synchronization with the backend. */
  start: () => void;
  /** Stops the synchronization interval. */
  dispose: () => void;
}

export interface ClockSynchronizerOptions {
  baseUrl?: string;
  refreshIntervalMs?: number;
}

const DEFAULT_REFRESH_INTERVAL = 60_000;

export const createClockSynchronizer = async (
  options: ClockSynchronizerOptions = {},
): Promise<ClockSynchronizer> => {
  const baseUrl = options.baseUrl
    ? sanitizeBackendUrl(options.baseUrl)
    : getBackendBaseUrl();

  let offset = 0;
  let intervalId: number | undefined;

  const readServerTimestamp = (payload: TimeResponse): number | undefined => {
    if (
      typeof payload.timestamp === 'number' &&
      Number.isFinite(payload.timestamp)
    ) {
      return payload.timestamp;
    }
    if (typeof payload.iso === 'string') {
      const parsed = Date.parse(payload.iso);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return undefined;
  };

  const fetchTime = async () => {
    try {
      const response = await fetch(`${baseUrl}/world/time`, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as TimeResponse;
      const serverTimestamp = readServerTimestamp(data);
      if (typeof serverTimestamp === 'number') {
        const localNow = Date.now();
        offset = serverTimestamp - localNow;
      }
    } catch (error) {
      console.warn('No se pudo sincronizar el reloj con el servidor.', error);
    }
  };

  await fetchTime();

  const getCurrentTime = () => Date.now() + offset;

  const start = () => {
    if (intervalId !== undefined) {
      return;
    }
    intervalId = window.setInterval(() => {
      void fetchTime();
    }, options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL);
  };

  const dispose = () => {
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
      intervalId = undefined;
    }
  };

  return { getCurrentTime, start, dispose };
};
