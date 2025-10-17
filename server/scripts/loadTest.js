import { io } from 'socket.io-client';
import { setTimeout as delay } from 'node:timers/promises';

const TARGET_URL = process.env.LOAD_TARGET_URL || 'http://localhost:4000';
const CLIENT_COUNT = Number.parseInt(process.env.LOAD_CLIENTS ?? '50', 10);
const TEST_DURATION_MS = Number.parseInt(process.env.LOAD_DURATION_MS ?? '60000', 10);
const UPDATE_INTERVAL_MS = Number.parseInt(process.env.LOAD_UPDATE_INTERVAL_MS ?? '1000', 10);
const SPAWN_INTERVAL_MS = Number.parseInt(process.env.LOAD_SPAWN_INTERVAL_MS ?? '50', 10);

const metrics = {
  connections: 0,
  disconnects: 0,
  joinLatencies: [],
  updateLatencies: [],
  errors: []
};

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const summarize = (values) => {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  const average = sum / sorted.length;
  const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    average,
    p50: percentile(50),
    p90: percentile(90),
    p95: percentile(95)
  };
};

class LoadClient {
  constructor(index) {
    this.index = index;
    this.playerId = `load-${index}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.socket = io(TARGET_URL, {
      autoConnect: false,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 5000
    });

    this.updateTimer = null;
    this.active = false;
    this.connected = false;
  }

  async start () {
    return new Promise((resolve) => {
      this.socket.on('connect', () => {
        metrics.connections += 1;
        this.connected = true;
        this.join().finally(resolve);
      });

      this.socket.on('disconnect', () => {
        metrics.disconnects += 1;
        this.connected = false;
        if (this.updateTimer) {
          clearInterval(this.updateTimer);
          this.updateTimer = null;
        }
      });

      this.socket.on('connect_error', (error) => {
        metrics.errors.push(`connect:${error.message}`);
        resolve();
      });

      this.socket.on('error', (error) => {
        metrics.errors.push(`socket:${error?.message ?? String(error)}`);
      });

      this.socket.connect();
    });
  }

  async join () {
    return new Promise((resolve) => {
      const payload = {
        playerId: this.playerId,
        name: `Load Tester ${this.index}`,
        position: { x: randomBetween(-10, 10), y: 0, z: randomBetween(-10, 10) },
        animation: 'idle'
      };

      const start = Date.now();

      this.socket.emit('player:join', payload, (ack) => {
        if (ack?.ok) {
          metrics.joinLatencies.push(Date.now() - start);
          this.active = true;
          this.scheduleUpdates();
        } else {
          metrics.errors.push(`join:${ack?.message ?? 'unknown'}`);
        }

        resolve();
      });
    });
  }

  scheduleUpdates () {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(() => {
      if (!this.active || !this.socket.connected) {
        return;
      }

      const start = Date.now();
      const payload = {
        position: {
          x: randomBetween(-25, 25),
          y: randomBetween(0, 5),
          z: randomBetween(-25, 25)
        },
        animation: 'walk'
      };

      this.socket.emit('player:update', payload, (ack) => {
        if (ack?.ok) {
          metrics.updateLatencies.push(Date.now() - start);
        } else {
          metrics.errors.push(`update:${ack?.message ?? 'unknown'}`);
        }
      });
    }, UPDATE_INTERVAL_MS);
  }

  async shutdown () {
    this.active = false;

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    return new Promise((resolve) => {
      if (!this.socket.connected) {
        this.socket.disconnect();
        resolve();
        return;
      }

      const finalize = () => {
        this.socket.disconnect();
        resolve();
      };

      this.socket.emit('player:leave', () => finalize());

      setTimeout(finalize, 500);
    });
  }
}

const run = async () => {
  console.log(`Running load test against ${TARGET_URL} with ${CLIENT_COUNT} clients for ${TEST_DURATION_MS}ms`);

  const clients = [];

  for (let i = 0; i < CLIENT_COUNT; i++) {
    const client = new LoadClient(i);
    clients.push(client);
    await client.start();

    if (SPAWN_INTERVAL_MS > 0) {
      await delay(SPAWN_INTERVAL_MS);
    }
  }

  await delay(TEST_DURATION_MS);

  await Promise.all(clients.map((client) => client.shutdown()));

  const joinSummary = summarize(metrics.joinLatencies);
  const updateSummary = summarize(metrics.updateLatencies);

  console.log('\nLoad test summary:');
  console.table([
    {
      connections: metrics.connections,
      disconnects: metrics.disconnects,
      errors: metrics.errors.length
    }
  ]);

  if (joinSummary) {
    console.log('\nJoin latency (ms):');
    console.table([joinSummary]);
  }

  if (updateSummary) {
    console.log('\nUpdate latency (ms):');
    console.table([updateSummary]);
  }

  if (metrics.errors.length > 0) {
    console.log('\nErrors captured during run:');
    metrics.errors.slice(0, 10).forEach((error) => console.log(` - ${error}`));
    if (metrics.errors.length > 10) {
      console.log(`   ...and ${metrics.errors.length - 10} more`);
    }
  }
};

run().catch((error) => {
  console.error('Load test failed', error);
  process.exitCode = 1;
});
