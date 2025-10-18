import { ArraySchema, Schema, type } from '@colyseus/schema';

export class Chunk extends Schema {
  @type('string')
  id = '';

  @type('string')
  data = '';
}

export class WorldState extends Schema {
  @type([Chunk])
  chunks = new ArraySchema<Chunk>();

  @type('string')
  terrainSeed = '';

  @type('string')
  terrainParameters = '';
}
