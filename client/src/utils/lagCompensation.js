const DEFAULT_BUFFER_MS = 120;
const DEFAULT_MAX_EXTRAPOLATION_MS = 250;
const DEFAULT_HISTORY_LIMIT = 32;
const EPSILON = 1e-6;

const clamp = (value, min, max) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const clonePosition = (position = {}) => ({
  x: Number.isFinite(position.x) ? position.x : 0,
  y: Number.isFinite(position.y) ? position.y : 0,
  z: Number.isFinite(position.z) ? position.z : 0
});

const addPositions = (a, b) => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z
});

const scalePosition = (position, scalar) => ({
  x: position.x * scalar,
  y: position.y * scalar,
  z: position.z * scalar
});

const subtractPositions = (a, b) => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z
});

const distanceBetween = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export class LagCompensator {
  constructor({
    bufferMs = DEFAULT_BUFFER_MS,
    maxExtrapolationMs = DEFAULT_MAX_EXTRAPOLATION_MS,
    historyLimit = DEFAULT_HISTORY_LIMIT
  } = {}) {
    this.bufferMs = bufferMs;
    this.maxExtrapolationMs = maxExtrapolationMs;
    this.historyLimit = historyLimit;
    this.samples = [];
  }

  reset() {
    this.samples = [];
  }

  addSample(position, timestamp = Date.now()) {
    const sample = { position: clonePosition(position), timestamp };

    const lastSample = this.samples[this.samples.length - 1];
    if (lastSample && timestamp < lastSample.timestamp) {
      // Keep samples sorted by timestamp when out-of-order updates arrive.
      let insertIndex = this.samples.findIndex((item) => item.timestamp > timestamp);
      if (insertIndex === -1) {
        insertIndex = this.samples.length;
      }
      this.samples.splice(insertIndex, 0, sample);
    } else {
      this.samples.push(sample);
    }

    if (this.samples.length > this.historyLimit) {
      this.samples.splice(0, this.samples.length - this.historyLimit);
    }

    return clonePosition(sample.position);
  }

  getInterpolatedPosition(now = Date.now()) {
    if (this.samples.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    if (this.samples.length === 1) {
      return clonePosition(this.samples[0].position);
    }

    const targetTime = now - this.bufferMs;

    let previous = this.samples[0];

    for (let index = 1; index < this.samples.length; index += 1) {
      const current = this.samples[index];

      if (current.timestamp >= targetTime) {
        if (current.timestamp === previous.timestamp) {
          return clonePosition(current.position);
        }

        if (targetTime <= previous.timestamp) {
          return clonePosition(previous.position);
        }

        const span = current.timestamp - previous.timestamp;
        const t = clamp((targetTime - previous.timestamp) / span, 0, 1);
        const delta = subtractPositions(current.position, previous.position);
        const interpolated = addPositions(previous.position, scalePosition(delta, t));
        return interpolated;
      }

      previous = current;
    }

    const last = this.samples[this.samples.length - 1];

    if (this.samples.length < 2) {
      return clonePosition(last.position);
    }

    const secondLast = this.samples[this.samples.length - 2];
    const deltaTime = last.timestamp - secondLast.timestamp;

    if (deltaTime < EPSILON) {
      return clonePosition(last.position);
    }

    const velocity = scalePosition(subtractPositions(last.position, secondLast.position), 1 / deltaTime);
    const extrapolationTime = clamp(targetTime - last.timestamp, 0, this.maxExtrapolationMs);
    const extrapolated = addPositions(last.position, scalePosition(velocity, extrapolationTime));

    return extrapolated;
  }

  hasSignificantDeviation(position, threshold = 0.01) {
    if (this.samples.length === 0) {
      return false;
    }

    const latest = this.samples[this.samples.length - 1];
    return distanceBetween(latest.position, clonePosition(position)) > threshold;
  }
}

export default LagCompensator;
