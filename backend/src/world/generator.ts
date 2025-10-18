import { Chunk, WorldState } from './state.js';
import { getWorldConfig, type WorldConfig } from './config.js';

export interface WorldGenerator {
  populateState(state: WorldState): void;
}

class ConfiguredWorldGenerator implements WorldGenerator {
  constructor(private readonly config: WorldConfig) {}

  populateState(state: WorldState): void {
    const chunk = new Chunk();
    chunk.id = '0,0,0';
    chunk.data = 'placeholder';
    state.chunks.push(chunk);

    state.terrainSeed = this.config.terrain.seed;
    state.terrainParameters = JSON.stringify(this.config.terrain);
  }
}

export function createWorldGenerator(): WorldGenerator {
  const config = getWorldConfig();
  return new ConfiguredWorldGenerator(config);
}
