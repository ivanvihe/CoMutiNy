import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class Vector3State extends Schema {
  @type('number')
  x = 0;

  @type('number')
  y = 0;

  @type('number')
  z = 0;

  toJSON(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }
}

export class PlayerState extends Schema {
  @type('string')
  id = '';

  @type('string')
  displayName = '';

  @type(Vector3State)
  position = new Vector3State();

  @type(Vector3State)
  rotation = new Vector3State();

  @type('number')
  lastUpdate = 0;

  @type('number')
  sequence = 0;
}

export class BlockState extends Schema {
  @type('string')
  id = '';

  @type('string')
  type = '';

  @type(Vector3State)
  position = new Vector3State();

  @type('string')
  placedBy = '';

  @type('number')
  updatedAt = 0;
}

export class ChunkState extends Schema {
  @type('string')
  id = '';

  @type('string')
  data = '';
}

export class WorldState extends Schema {
  @type([ChunkState])
  chunks = new ArraySchema<ChunkState>();

  @type({ map: PlayerState })
  players = new MapSchema<PlayerState>();

  @type({ map: BlockState })
  blocks = new MapSchema<BlockState>();

  @type('string')
  terrainSeed = '';

  @type('string')
  terrainParameters = '';
}
