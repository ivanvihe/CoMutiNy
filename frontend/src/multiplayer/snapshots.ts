export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface PlayerSnapshot {
  id: string;
  displayName: string;
  position: Vector3Like;
  rotation: Vector3Like;
  lastUpdate: number;
}

export interface WorldSnapshot {
  timestamp: number;
  players: Map<string, PlayerSnapshot>;
}

const DEFAULT_LAG_MS = 100;
const MAX_HISTORY_MS = 2_000;

export class SnapshotBuffer {
  private readonly lagMs: number;
  private frames: WorldSnapshot[] = [];

  constructor(lagMs = DEFAULT_LAG_MS) {
    this.lagMs = lagMs;
  }

  push(frame: WorldSnapshot): void {
    this.frames.push(frame);
    const cutoff = frame.timestamp - MAX_HISTORY_MS;
    while (this.frames.length > 2 && this.frames[0]?.timestamp < cutoff) {
      this.frames.shift();
    }
  }

  sample(now: number): WorldSnapshot {
    const target = now - this.lagMs;

    if (this.frames.length === 0) {
      return { timestamp: target, players: new Map() };
    }

    let previous = this.frames[0];
    let next = this.frames[this.frames.length - 1];

    for (const frame of this.frames) {
      if (frame.timestamp <= target) {
        previous = frame;
      }
      if (frame.timestamp >= target) {
        next = frame;
        break;
      }
    }

    if (previous === next) {
      return {
        timestamp: target,
        players: this.clonePlayers(previous.players),
      };
    }

    const delta = next.timestamp - previous.timestamp;
    const ratio = delta <= 0 ? 0 : clamp((target - previous.timestamp) / delta, 0, 1);
    const players = new Map<string, PlayerSnapshot>();
    const ids = new Set<string>();

    previous.players.forEach((_value, key) => ids.add(key));
    next.players.forEach((_value, key) => ids.add(key));

    ids.forEach((id) => {
      const start = previous.players.get(id);
      const end = next.players.get(id) ?? start;
      if (!start && !end) {
        return;
      }
      const base = start ?? end!;
      const targetFrame = end ?? start!;
      players.set(id, {
        id,
        displayName: targetFrame.displayName,
        position: interpolateVector(base.position, targetFrame.position, ratio),
        rotation: interpolateVector(base.rotation, targetFrame.rotation, ratio),
        lastUpdate: Math.max(base.lastUpdate, targetFrame.lastUpdate),
      });
    });

    return { timestamp: target, players };
  }

  private clonePlayers(source: Map<string, PlayerSnapshot>): Map<string, PlayerSnapshot> {
    const copy = new Map<string, PlayerSnapshot>();
    source.forEach((player, key) => {
      copy.set(key, {
        id: player.id,
        displayName: player.displayName,
        position: { ...player.position },
        rotation: { ...player.rotation },
        lastUpdate: player.lastUpdate,
      });
    });
    return copy;
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const interpolateVector = (
  start: Vector3Like,
  end: Vector3Like,
  ratio: number,
): Vector3Like => ({
  x: interpolate(start.x, end.x, ratio),
  y: interpolate(start.y, end.y, ratio),
  z: interpolate(start.z, end.z, ratio),
});

const interpolate = (start: number, end: number, ratio: number) =>
  start + (end - start) * ratio;
