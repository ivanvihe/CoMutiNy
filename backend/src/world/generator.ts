import { Chunk, WorldState } from './state.js';

export interface WorldGenerator {
  populateState(state: WorldState): void;
}

class PlaceholderWorldGenerator implements WorldGenerator {
  populateState(state: WorldState): void {
    const chunk = new Chunk();
    chunk.id = '0,0,0';
    chunk.data = 'placeholder';
    state.chunks.push(chunk);
  }
}

export function createWorldGenerator(): WorldGenerator {
  return new PlaceholderWorldGenerator();
}
