import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string')
  public id!: string;

  @type('string')
  public userId!: string;

  @type('string')
  public displayName!: string;

  @type('float32')
  public x = 0;

  @type('float32')
  public y = 0;

  @type('string')
  public chunkId!: string;
}

export class BuildingState extends Schema {
  @type('string')
  public id!: string;

  @type('string')
  public ownerId!: string;

  @type('string')
  public type!: string;

  @type('int32')
  public x!: number;

  @type('int32')
  public y!: number;

  @type('string')
  public chunkId!: string;
}

export class ChatMessageState extends Schema {
  @type('string')
  public id!: string;

  @type('string')
  public senderId!: string;

  @type('string')
  public senderName!: string;

  @type('string')
  public content!: string;

  @type('number')
  public timestamp!: number;

  @type('string')
  public scope: string = 'global';

  @type('boolean')
  public persistent = true;

  @type('string')
  public chunkId = '';
}

export class ChunkState extends Schema {
  @type('string')
  public id!: string;

  @type('int32')
  public x!: number;

  @type('int32')
  public y!: number;

  @type({ map: 'boolean' })
  public buildingIds = new MapSchema<boolean>();

  @type({ map: 'boolean' })
  public playerIds = new MapSchema<boolean>();
}

export class CommunityState extends Schema {
  @type('string')
  public worldId!: string;

  @type('string')
  public worldName!: string;

  @type('int32')
  public width!: number;

  @type('int32')
  public height!: number;

  @type({ map: PlayerState })
  public players = new MapSchema<PlayerState>();

  @type({ map: BuildingState })
  public buildings = new MapSchema<BuildingState>();

  @type([ChatMessageState])
  public chat = new ArraySchema<ChatMessageState>();

  @type({ map: ChunkState })
  public chunks = new MapSchema<ChunkState>();
}
