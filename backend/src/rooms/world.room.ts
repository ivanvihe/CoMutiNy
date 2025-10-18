import { Client, Room } from 'colyseus';
import { BlockState, PlayerState, WorldState } from '../world/state.js';
import { createWorldGenerator } from '../world/generator.js';

type Vector3Message = Partial<Record<'x' | 'y' | 'z', number>>;
type NormalizedVector3 = { x: number; y: number; z: number };

interface PlayerUpdateMessage {
  position?: Vector3Message;
  rotation?: Vector3Message;
  sequence?: number;
}

interface BlockPlacementMessage {
  type: string;
  position: Vector3Message;
}

interface BlockRemovalMessage {
  id?: string;
  position?: Vector3Message;
}

interface ChatMessagePayload {
  message: string;
}

type ChatBroadcastPayload = {
  id: string;
  authorId: string;
  authorName: string;
  message: string;
  timestamp: number;
  type: 'system' | 'player';
};

const DEFAULT_SPAWN: Vector3Message = { x: 0, y: 64, z: 0 };

export class WorldRoom extends Room<WorldState> {
  private chatCounter = 0;

  onCreate(): void {
    this.setState(new WorldState());

    const generator = createWorldGenerator();
    generator.populateState(this.state);

    this.onMessage('ping', (client: Client) => {
      client.send('pong');
    });

    this.onMessage('player:update', (client, message: PlayerUpdateMessage) => {
      this.handlePlayerUpdate(client, message);
    });

    this.onMessage('block:place', (client, message: BlockPlacementMessage) => {
      this.handleBlockPlacement(client, message);
    });

    this.onMessage('block:remove', (client, message: BlockRemovalMessage) => {
      this.handleBlockRemoval(client, message);
    });

    this.onMessage('chat:message', (client, message: ChatMessagePayload) => {
      this.handleChatMessage(client, message);
    });
  }

  onJoin(client: Client, options?: { displayName?: string }): void {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.displayName = this.sanitizeDisplayName(options?.displayName);
    player.position.copyFrom(DEFAULT_SPAWN);
    player.rotation.copyFrom({ x: 0, y: 0, z: 0 });
    player.lastUpdate = Date.now();
    this.state.players.set(client.sessionId, player);

    this.broadcastChat({
      id: this.createChatId(),
      authorId: client.sessionId,
      authorName: player.displayName,
      message: `${player.displayName} se ha unido al servidor`,
      timestamp: Date.now(),
      type: 'system',
    });

    console.log(`Cliente ${client.sessionId} se unió a la sala world.`);
  }

  onLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      const name = player.displayName;
      this.state.players.delete(client.sessionId);
      this.broadcastChat({
        id: this.createChatId(),
        authorId: client.sessionId,
        authorName: name,
        message: `${name} abandonó la sala`,
        timestamp: Date.now(),
        type: 'system',
      });
    }

    console.log(`Cliente ${client.sessionId} abandonó la sala world.`);
  }

  private handlePlayerUpdate(client: Client, message: PlayerUpdateMessage): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    if (!message || typeof message !== 'object') {
      return;
    }

    const nextSequence = Number.isFinite(message.sequence)
      ? Number(message.sequence)
      : undefined;
    if (typeof nextSequence === 'number' && nextSequence <= player.sequence) {
      return;
    }

    if (this.isVector3Message(message.position)) {
      this.applyVector3(player.position, message.position);
    }

    if (this.isVector3Message(message.rotation)) {
      this.applyVector3(player.rotation, message.rotation);
    }

    player.lastUpdate = Date.now();
    if (typeof nextSequence === 'number') {
      player.sequence = nextSequence;
    }
  }

  private handleBlockPlacement(
    client: Client,
    message: BlockPlacementMessage,
  ): void {
    if (!message || typeof message.type !== 'string') {
      return;
    }
    if (!this.isVector3Message(message.position)) {
      return;
    }

    const position = this.sanitizeVector3(message.position);
    const key = this.getBlockKey(position);
    let block = this.state.blocks.get(key);
    if (!block) {
      block = new BlockState();
      block.id = key;
      block.position.copyFrom(position);
      this.state.blocks.set(key, block);
    } else {
      block.position.copyFrom(position);
    }
    block.type = message.type;
    block.placedBy = client.sessionId;
    block.updatedAt = Date.now();

    this.broadcast('block:placed', {
      id: key,
      type: block.type,
      position,
      by: client.sessionId,
      timestamp: block.updatedAt,
    });
  }

  private handleBlockRemoval(client: Client, message: BlockRemovalMessage): void {
    let key = typeof message?.id === 'string' ? message.id : undefined;
    if (!key && message?.position && this.isVector3Message(message.position)) {
      key = this.getBlockKey(this.sanitizeVector3(message.position));
    }
    if (!key) {
      return;
    }

    if (this.state.blocks.has(key)) {
      this.state.blocks.delete(key);
      this.broadcast('block:removed', {
        id: key,
        by: client.sessionId,
        timestamp: Date.now(),
      });
    }
  }

  private handleChatMessage(client: Client, message: ChatMessagePayload): void {
    if (!message || typeof message.message !== 'string') {
      return;
    }

    const trimmed = message.message.trim();
    if (!trimmed) {
      return;
    }

    const player = this.state.players.get(client.sessionId);
    const payload: ChatBroadcastPayload = {
      id: this.createChatId(),
      authorId: client.sessionId,
      authorName: player?.displayName ?? 'Anónimo',
      message: trimmed.slice(0, 500),
      timestamp: Date.now(),
      type: 'player',
    };

    this.broadcastChat(payload);
  }

  private broadcastChat(payload: ChatBroadcastPayload): void {
    this.broadcast('chat:message', payload);
  }

  private createChatId(): string {
    this.chatCounter += 1;
    return `${Date.now()}-${this.chatCounter}`;
  }

  private sanitizeDisplayName(raw: unknown): string {
    if (typeof raw !== 'string') {
      return `Tripulante ${Math.floor(Math.random() * 10_000)}`;
    }
    const name = raw.trim().slice(0, 32);
    return name.length > 0 ? name : `Tripulante ${Math.floor(Math.random() * 10_000)}`;
  }

  private isVector3Message(value: unknown): value is Vector3Message {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const vector = value as Record<string, unknown>;
    return ['x', 'y', 'z'].some((key) => typeof vector[key] === 'number');
  }

  private applyVector3(target: { copyFrom: (data: Vector3Message) => void }, patch: Vector3Message): void {
    const sanitized: Vector3Message = {};
    if (typeof patch.x === 'number' && Number.isFinite(patch.x)) {
      sanitized.x = patch.x;
    }
    if (typeof patch.y === 'number' && Number.isFinite(patch.y)) {
      sanitized.y = patch.y;
    }
    if (typeof patch.z === 'number' && Number.isFinite(patch.z)) {
      sanitized.z = patch.z;
    }
    if (Object.keys(sanitized).length > 0) {
      target.copyFrom(sanitized);
    }
  }

  private sanitizeVector3(source: Vector3Message): NormalizedVector3 {
    return {
      x: this.toFiniteNumber(source.x),
      y: this.toFiniteNumber(source.y),
      z: this.toFiniteNumber(source.z),
    };
  }

  private toFiniteNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return fallback;
  }

  private getBlockKey(position: NormalizedVector3): string {
    const x = Math.round(position.x);
    const y = Math.round(position.y);
    const z = Math.round(position.z);
    return `${x}:${y}:${z}`;
  }
}
