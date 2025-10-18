const TAU = Math.PI * 2;

const xmur3 = (str: string): (() => number) => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
};

const mulberry32 = (a: number): (() => number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const shuffle = (array: number[], random: () => number): void => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number): number => a + t * (b - a);

const grad2 = (hash: number, x: number, y: number): number => {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
};

export class PerlinNoise {
  private readonly perm: number[];

  constructor(seed: string) {
    const seedFn = xmur3(seed);
    const random = mulberry32(seedFn());
    const p = Array.from({ length: 256 }, (_, i) => i);
    shuffle(p, random);
    this.perm = new Array(512);
    for (let i = 0; i < 512; i += 1) {
      this.perm[i] = p[i & 255];
    }
  }

  noise2D(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = fade(xf);
    const v = fade(yf);

    const aa = this.perm[xi + this.perm[yi]];
    const ab = this.perm[xi + this.perm[yi + 1]];
    const ba = this.perm[xi + 1 + this.perm[yi]];
    const bb = this.perm[xi + 1 + this.perm[yi + 1]];

    const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
    const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);

    return lerp(x1, x2, v);
  }
}

export interface FractalNoiseOptions {
  octaves: number;
  persistence: number;
  lacunarity: number;
}

export const fractalNoise2D = (
  noise: PerlinNoise,
  x: number,
  y: number,
  options: FractalNoiseOptions,
): number => {
  let amplitude = 1;
  let frequency = 1;
  let value = 0;
  let normalization = 0;

  for (let i = 0; i < options.octaves; i += 1) {
    value += noise.noise2D(x * frequency, y * frequency) * amplitude;
    normalization += amplitude;
    amplitude *= options.persistence;
    frequency *= options.lacunarity;
  }

  if (normalization === 0) {
    return 0;
  }

  return value / normalization;
};

export const octaveOffset = (
  seed: string,
  octave: number,
): [number, number] => {
  const seedFn = xmur3(`${seed}:${octave}`);
  const random = mulberry32(seedFn());
  return [random() * TAU, random() * TAU];
};
