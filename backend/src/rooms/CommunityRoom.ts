import { randomUUID } from 'node:crypto';

import { MapSchema } from '@colyseus/schema';
import { Client, Room } from 'colyseus';
import { Repository } from 'typeorm';

import { AppDataSource } from '../database';
import { Building, ChatMessage, ChatScope, User, WorldState } from '../entities';
import { BuildingService, ChatService } from '../services';
import { ParcelDefinition, parseWorldParcels } from '../services/buildings/parcels';
import {
  BuildingState,
  ChatMessageState,
  ChunkState,
  CommunityState,
  PlayerState,
} from './schemas/CommunityState';

export interface CommunityRoomOptions {
  worldId?: string;
  chunkSize?: number;
  chatHistoryLimit?: number;
}

interface MoveMessagePayload {
  x: number;
  y: number;
}

interface BuildMessagePayload {
  type: string;
  x: number;
  y: number;
}

interface BuildRemoveMessagePayload {
  buildingId: string;
}

interface ChatSendPayload {
  content: string;
  persist?: boolean;
}

interface TypingPayload {
  scope: ChatScope;
  typing: boolean;
}

interface ChunkSubscriptionPayload {
  chunkX: number;
  chunkY: number;
}

interface ChunkSnapshot {
  chunkId: string;
  x: number;
  y: number;
  buildings: Array<ReturnType<CommunityRoom['serializeBuildingState']>>;
  players: Array<ReturnType<CommunityRoom['serializePlayerState']>>;
}

interface ChatMessageStateInput {
  id: string;
  senderId: string | null;
  senderName: string;
  content: string;
  timestamp: number;
  scope: ChatScope;
  persistent: boolean;
  chunkId: string | null;
}

interface ChatTypingBroadcast {
  scope: ChatScope;
  userId: string;
  displayName: string;
  typing: boolean;
  chunkId: string | null;
}

const DEFAULT_SPAWN_OFFSET = 0.5;

export class CommunityRoom extends Room<CommunityState> {
  public static readonly DEFAULT_CHUNK_SIZE = 32;
  private static readonly DEFAULT_CHAT_HISTORY_LIMIT = 100;

  private readonly worldRepository: Repository<WorldState>;
  private readonly userRepository: Repository<User>;
  private readonly buildingRepository: Repository<Building>;
  private readonly chatRepository: Repository<ChatMessage>;

  private readonly buildingService: BuildingService;
  private readonly chatService: ChatService;

  private world!: WorldState;
  private parcels: ParcelDefinition[] = [];
  private chunkSize = CommunityRoom.DEFAULT_CHUNK_SIZE;
  private chatHistoryLimit = CommunityRoom.DEFAULT_CHAT_HISTORY_LIMIT;

  private readonly chunkListeners = new Map<string, Set<string>>();
  private readonly playerChunks = new Map<string, string>();
  private readonly activeUsers = new Map<string, User>();
  private readonly chatGuards = new Map<string, { lastSentAt: number; lastContent: string; duplicateCount: number }>();
  private readonly typingStates = new Map<string, { scope: ChatScope }>();

  constructor() {
    super();

    this.worldRepository = AppDataSource.getRepository(WorldState);
    this.userRepository = AppDataSource.getRepository(User);
    this.buildingRepository = AppDataSource.getRepository(Building);
    this.chatRepository = AppDataSource.getRepository(ChatMessage);

    this.buildingService = new BuildingService(this.buildingRepository, this.worldRepository);
    this.chatService = new ChatService(this.chatRepository);
  }

  public async onCreate(options: CommunityRoomOptions): Promise<void> {
    this.chunkSize = options.chunkSize ?? CommunityRoom.DEFAULT_CHUNK_SIZE;
    this.chatHistoryLimit = options.chatHistoryLimit ?? CommunityRoom.DEFAULT_CHAT_HISTORY_LIMIT;

    const worldId = options.worldId ?? (await this.resolveDefaultWorldId());
    const world = await this.worldRepository.findOne({ where: { id: worldId } });

    if (!world) {
      throw new Error(`World with id ${worldId} could not be found.`);
    }

    this.world = world;
    this.parcels = parseWorldParcels(this.world);

    const buildings = await this.buildingRepository.find({
      where: { world: { id: this.world.id } },
      relations: ['owner'],
    });

    const chatMessages = await this.chatRepository.find({
      where: { world: { id: this.world.id }, isPersistent: true },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
      take: this.chatHistoryLimit,
    });

    const state = new CommunityState();
    state.worldId = this.world.id;
    state.worldName = this.world.name;
    state.width = this.world.width;
    state.height = this.world.height;

    this.setState(state);

    buildings.forEach((building) => {
      this.addBuildingToState(building);
    });

    chatMessages.forEach((message) => {
      this.recordChatMessage(this.toChatMessageInput(message), true);
    });

    this.onMessage('player:move', this.handlePlayerMove.bind(this));
    this.onMessage('build:place', this.handleBuildPlacement.bind(this));
    this.onMessage('build:remove', this.handleBuildRemoval.bind(this));
    this.onMessage('chat:global', this.handleGlobalChat.bind(this));
    this.onMessage('chat:proximity', this.handleProximityChat.bind(this));
    this.onMessage('chat:typing', this.handleTypingNotification.bind(this));
    this.onMessage('chunk:subscribe', this.handleChunkSubscribe.bind(this));
    this.onMessage('chunk:unsubscribe', this.handleChunkUnsubscribe.bind(this));
  }

  public async onJoin(
    client: Client,
    options: { userId?: string; spawnX?: number; spawnY?: number },
  ): Promise<void> {
    if (!options.userId) {
      throw new Error('userId option is required to join the community room.');
    }

    const user = await this.userRepository.findOne({ where: { id: options.userId } });

    if (!user) {
      throw new Error(`User with id ${options.userId} could not be found.`);
    }

    this.activeUsers.set(client.sessionId, user);

    const spawnX =
      typeof options.spawnX === 'number' ? options.spawnX : this.world.width * DEFAULT_SPAWN_OFFSET;
    const spawnY =
      typeof options.spawnY === 'number'
        ? options.spawnY
        : this.world.height * DEFAULT_SPAWN_OFFSET;

    client.send('world:info', {
      width: this.world.width,
      height: this.world.height,
      parcels: this.parcels.map((parcel) => this.serializeParcel(parcel)),
      assignedParcelIds: this.parcels.filter((parcel) => parcel.ownerId === user.id).map((parcel) => parcel.id),
    });

    const playerState = new PlayerState();
    playerState.id = client.sessionId;
    playerState.userId = user.id;
    playerState.displayName = user.displayName;
    playerState.x = spawnX;
    playerState.y = spawnY;

    const { chunkId, chunkX, chunkY } = this.getChunkInfo(playerState.x, playerState.y);
    playerState.chunkId = chunkId;

    this.state.players.set(client.sessionId, playerState);

    const chunkState = this.ensureChunkState(chunkId, chunkX, chunkY);
    chunkState.playerIds.set(client.sessionId, true);

    this.playerChunks.set(client.sessionId, chunkId);
    this.addListener(chunkId, client.sessionId);

    client.send('chunk:snapshot', this.serializeChunk(chunkState));
    this.broadcastToChunk(chunkId, 'chunk:playerJoined', {
      player: this.serializePlayerState(playerState),
    });

    this.broadcastSystemNotification(`${user.displayName} se ha conectado.`);
  }

  public onLeave(client: Client): void {
    const user = this.activeUsers.get(client.sessionId);
    const playerState = this.state.players.get(client.sessionId);

    if (playerState) {
      const chunkId = this.playerChunks.get(client.sessionId);
      if (chunkId) {
        const chunkState = this.state.chunks.get(chunkId);
        chunkState?.playerIds.delete(client.sessionId);
        this.broadcastToChunk(chunkId, 'chunk:playerLeft', { playerId: client.sessionId });
      }

      this.state.players.delete(client.sessionId);
    }

    if (user) {
      this.broadcastSystemNotification(`${user.displayName} se ha desconectado.`);
    }

    const typingState = this.typingStates.get(client.sessionId);
    if (user && typingState) {
      const chunkId = typingState.scope === 'proximity' ? this.playerChunks.get(client.sessionId) ?? null : null;
      this.typingStates.delete(client.sessionId);
      this.broadcastTypingStatus({
        scope: typingState.scope,
        userId: user.id,
        displayName: user.displayName,
        typing: false,
        chunkId,
      });
    }

    this.removeAllListenersForClient(client.sessionId);
    this.chatGuards.delete(client.sessionId);
    this.typingStates.delete(client.sessionId);
    this.playerChunks.delete(client.sessionId);
    this.activeUsers.delete(client.sessionId);
  }

  private async resolveDefaultWorldId(): Promise<string> {
    const world = await this.worldRepository.findOne({ order: { createdAt: 'ASC' } });

    if (!world) {
      throw new Error('No world states are available in the database.');
    }

    return world.id;
  }

  private async handlePlayerMove(client: Client, payload: MoveMessagePayload): Promise<void> {
    const playerState = this.state.players.get(client.sessionId);

    if (!playerState) {
      return;
    }

    if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
      return;
    }

    const clampedX = Math.max(0, Math.min(payload.x, this.world.width));
    const clampedY = Math.max(0, Math.min(payload.y, this.world.height));

    playerState.x = clampedX;
    playerState.y = clampedY;

    const previousChunkId = this.playerChunks.get(client.sessionId);
    const { chunkId, chunkX, chunkY } = this.getChunkInfo(playerState.x, playerState.y);

    if (previousChunkId !== chunkId) {
      if (previousChunkId) {
        const previousChunkState = this.state.chunks.get(previousChunkId);
        previousChunkState?.playerIds.delete(client.sessionId);
        this.removeListener(previousChunkId, client.sessionId);
        this.broadcastToChunk(previousChunkId, 'chunk:playerLeft', { playerId: client.sessionId });
      }

      const newChunkState = this.ensureChunkState(chunkId, chunkX, chunkY);
      newChunkState.playerIds.set(client.sessionId, true);
      playerState.chunkId = chunkId;
      this.broadcastToChunk(chunkId, 'chunk:playerJoined', {
        player: this.serializePlayerState(playerState),
      });
      this.playerChunks.set(client.sessionId, chunkId);
      this.addListener(chunkId, client.sessionId);
      client.send('chunk:snapshot', this.serializeChunk(newChunkState));
    } else {
      playerState.chunkId = chunkId;
    }

    this.broadcastToChunk(chunkId, 'chunk:playerMoved', {
      player: this.serializePlayerState(playerState),
    });
  }

  private async handleBuildPlacement(client: Client, payload: BuildMessagePayload): Promise<void> {
    const user = this.activeUsers.get(client.sessionId);

    if (!user) {
      return;
    }

    if (!payload || typeof payload.type !== 'string') {
      return;
    }

    const x = Math.floor(payload.x);
    const y = Math.floor(payload.y);

    if (Number.isNaN(x) || Number.isNaN(y)) {
      return;
    }

    try {
      const type = payload.type.trim();

      if (!type) {
        throw new Error('Building type cannot be empty.');
      }

      const building = await this.buildingService.createBuilding({
        owner: user,
        type,
        worldId: this.world.id,
        x,
        y,
      });

      const buildingState = this.addBuildingToState(building);
      this.broadcastToChunk(buildingState.chunkId, 'chunk:buildingPlaced', {
        building: this.serializeBuildingState(buildingState),
      });
    } catch (error) {
      client.send('error', { message: (error as Error).message });
    }
  }

  private async handleBuildRemoval(client: Client, payload: BuildRemoveMessagePayload): Promise<void> {
    const user = this.activeUsers.get(client.sessionId);

    if (!user || !payload || typeof payload.buildingId !== 'string') {
      return;
    }

    const buildingId = payload.buildingId.trim();

    if (!buildingId) {
      return;
    }

    try {
      const removedBuilding = await this.buildingService.removeBuilding(buildingId, user);
      const location = this.removeBuildingFromState(removedBuilding);

      if (location) {
        this.broadcastToChunk(location.chunkId, 'chunk:buildingRemoved', {
          buildingId: removedBuilding.id,
          x: location.x,
          y: location.y,
          chunkId: location.chunkId,
        });
      }
    } catch (error) {
      client.send('error', { message: (error as Error).message });
    }
  }

  private async handleGlobalChat(client: Client, payload: ChatSendPayload): Promise<void> {
    await this.handleChatSend(client, payload, { scope: 'global' });
  }

  private async handleProximityChat(client: Client, payload: ChatSendPayload): Promise<void> {
    const chunkId = this.playerChunks.get(client.sessionId);

    if (!chunkId) {
      return;
    }

    await this.handleChatSend(client, payload, { scope: 'proximity', chunkId });
  }

  private async handleChatSend(
    client: Client,
    payload: ChatSendPayload,
    options: { scope: ChatScope; chunkId?: string | null },
  ): Promise<void> {
    const user = this.activeUsers.get(client.sessionId);

    if (!user || !payload || typeof payload.content !== 'string') {
      return;
    }

    const sanitized = payload.content.trim();

    if (!sanitized) {
      return;
    }

    const normalized = sanitized.slice(0, 280);
    const guard = this.enforceChatGuards(client.sessionId, normalized);

    if (guard.blocked) {
      client.send('error', { message: guard.reason ?? 'Mensaje bloqueado por el servidor.' });
      return;
    }

    try {
      const persistDefault = options.scope === 'global';
      const persist = payload.persist ?? persistDefault;
      const message = await this.chatService.postMessage({
        content: normalized,
        sender: user,
        world: this.world,
        scope: options.scope,
        persist,
        chunkId: options.chunkId ?? null,
      });

      const messageData = this.toChatMessageInput(message);

      if (persist) {
        this.recordChatMessage(messageData, true);
      }

      this.dispatchChatMessage(messageData);

      const typingState = this.typingStates.get(client.sessionId);
      if (typingState) {
        this.typingStates.delete(client.sessionId);
        const chunkIdForTyping =
          typingState.scope === 'proximity'
            ? options.chunkId ?? this.playerChunks.get(client.sessionId) ?? null
            : null;
        this.broadcastTypingStatus({
          scope: typingState.scope,
          userId: user.id,
          displayName: user.displayName,
          typing: false,
          chunkId: chunkIdForTyping,
        });
      }
    } catch (error) {
      client.send('error', { message: (error as Error).message });
    }
  }

  private handleTypingNotification(client: Client, payload: TypingPayload): void {
    const user = this.activeUsers.get(client.sessionId);

    if (!user || !payload) {
      return;
    }

    const scope: ChatScope = payload.scope === 'proximity' ? 'proximity' : 'global';
    const typing = Boolean(payload.typing);
    let chunkId: string | null = null;

    if (scope === 'proximity') {
      chunkId = this.playerChunks.get(client.sessionId) ?? null;
      if (!chunkId) {
        return;
      }
    }

    if (typing) {
      this.typingStates.set(client.sessionId, { scope });
    } else {
      this.typingStates.delete(client.sessionId);
    }

    const broadcast: ChatTypingBroadcast = {
      scope,
      userId: user.id,
      displayName: user.displayName,
      typing,
      chunkId,
    };

    this.broadcastTypingStatus(broadcast);
  }

  private handleChunkSubscribe(client: Client, payload: ChunkSubscriptionPayload): void {
    if (!payload) {
      return;
    }

    const chunkX = Math.floor(payload.chunkX);
    const chunkY = Math.floor(payload.chunkY);

    if (!Number.isFinite(chunkX) || !Number.isFinite(chunkY)) {
      return;
    }

    const {
      chunkId,
      chunkX: normalizedChunkX,
      chunkY: normalizedChunkY,
    } = this.getChunkInfoFromChunkCoords(chunkX, chunkY);
    const chunkState = this.ensureChunkState(chunkId, normalizedChunkX, normalizedChunkY);
    this.addListener(chunkId, client.sessionId);
    client.send('chunk:snapshot', this.serializeChunk(chunkState));
  }

  private handleChunkUnsubscribe(client: Client, payload: ChunkSubscriptionPayload): void {
    if (!payload) {
      return;
    }

    const chunkX = Math.floor(payload.chunkX);
    const chunkY = Math.floor(payload.chunkY);

    if (!Number.isFinite(chunkX) || !Number.isFinite(chunkY)) {
      return;
    }

    const { chunkId } = this.getChunkInfoFromChunkCoords(chunkX, chunkY);
    this.removeListener(chunkId, client.sessionId);
  }

  private addBuildingToState(building: Building): BuildingState {
    const buildingState = new BuildingState();
    buildingState.id = building.id;
    buildingState.ownerId = building.owner.id;
    buildingState.type = building.type;
    buildingState.x = building.x;
    buildingState.y = building.y;

    const { chunkId, chunkX, chunkY } = this.getChunkInfo(building.x, building.y);
    buildingState.chunkId = chunkId;

    this.state.buildings.set(building.id, buildingState);

    const chunkState = this.ensureChunkState(chunkId, chunkX, chunkY);
    chunkState.buildingIds.set(building.id, true);

    return buildingState;
  }

  private recordChatMessage(data: ChatMessageStateInput, addToState: boolean): ChatMessageState | null {
    if (!addToState) {
      return null;
    }

    const chatState = new ChatMessageState();
    chatState.id = data.id;
    chatState.senderId = data.senderId ?? '';
    chatState.senderName = data.senderName;
    chatState.content = data.content;
    chatState.timestamp = data.timestamp;
    chatState.scope = data.scope;
    chatState.persistent = data.persistent;
    chatState.chunkId = data.chunkId ?? '';

    this.state.chat.push(chatState);

    while (this.state.chat.length > this.chatHistoryLimit) {
      this.state.chat.shift();
    }

    return chatState;
  }

  private enforceChatGuards(
    sessionId: string,
    content: string,
  ): { blocked: boolean; reason?: string } {
    const now = Date.now();
    const guard =
      this.chatGuards.get(sessionId) ?? ({ lastSentAt: 0, lastContent: '', duplicateCount: 0 } as {
        lastSentAt: number;
        lastContent: string;
        duplicateCount: number;
      });

    let blocked = false;
    let reason: string | undefined;

    if (now - guard.lastSentAt < 750) {
      blocked = true;
      reason = 'Estás enviando mensajes demasiado rápido.';
    }

    if (!blocked) {
      if (guard.lastContent === content) {
        guard.duplicateCount += 1;
        if (guard.duplicateCount >= 2) {
          blocked = true;
          reason = 'Evita repetir el mismo mensaje.';
        }
      } else {
        guard.duplicateCount = 0;
      }
    }

    guard.lastSentAt = now;
    guard.lastContent = content;
    this.chatGuards.set(sessionId, guard);

    return { blocked, reason };
  }

  private dispatchChatMessage(data: ChatMessageStateInput): void {
    const payload = this.serializeChatMessageData(data);

    if (data.scope === 'proximity' && data.chunkId) {
      this.broadcastToChunk(data.chunkId, 'chat:message', payload);
    } else {
      this.broadcast('chat:message', payload);
    }
  }

  private broadcastTypingStatus(status: ChatTypingBroadcast): void {
    if (status.scope === 'proximity' && status.chunkId) {
      this.broadcastToChunk(status.chunkId, 'chat:typing', status);
    } else {
      this.broadcast('chat:typing', status);
    }
  }

  private toChatMessageInput(message: ChatMessage): ChatMessageStateInput {
    const sender = message.sender as User | undefined;

    return {
      id: message.id,
      senderId: sender?.id ?? null,
      senderName: sender?.displayName ?? 'Desconocido',
      content: message.content,
      timestamp: message.createdAt.getTime(),
      scope: message.scope,
      persistent: message.isPersistent,
      chunkId: message.chunkId ?? null,
    };
  }

  private serializeChatMessageData(data: ChatMessageStateInput): {
    id: string;
    senderId: string | null;
    senderName: string;
    content: string;
    timestamp: number;
    scope: ChatScope;
    persistent: boolean;
    chunkId: string | null;
  } {
    return {
      id: data.id,
      senderId: data.senderId,
      senderName: data.senderName,
      content: data.content,
      timestamp: data.timestamp,
      scope: data.scope,
      persistent: data.persistent,
      chunkId: data.chunkId,
    };
  }

  private broadcastSystemNotification(content: string): void {
    const data: ChatMessageStateInput = {
      id: randomUUID(),
      senderId: null,
      senderName: 'Sistema',
      content,
      timestamp: Date.now(),
      scope: 'system',
      persistent: false,
      chunkId: null,
    };

    this.recordChatMessage(data, true);
    this.dispatchChatMessage(data);
  }

  private removeBuildingFromState(
    building: Pick<Building, 'id' | 'x' | 'y'>,
  ): { chunkId: string; x: number; y: number } {
    const existingState = this.state.buildings.get(building.id);

    let chunkId: string;
    let x = building.x;
    let y = building.y;

    if (existingState) {
      chunkId = existingState.chunkId;
      x = existingState.x;
      y = existingState.y;
      const chunkState = this.state.chunks.get(chunkId);
      chunkState?.buildingIds.delete(building.id);
      this.state.buildings.delete(building.id);
      return { chunkId, x, y };
    }

    const { chunkId: derivedChunkId } = this.getChunkInfo(building.x, building.y);
    chunkId = derivedChunkId;
    const chunkState = this.state.chunks.get(chunkId);
    chunkState?.buildingIds.delete(building.id);
    this.state.buildings.delete(building.id);

    return { chunkId, x, y };
  }

  private ensureChunkState(chunkId: string, chunkX: number, chunkY: number): ChunkState {
    let chunkState = this.state.chunks.get(chunkId);

    if (!chunkState) {
      chunkState = new ChunkState();
      chunkState.id = chunkId;
      chunkState.x = chunkX;
      chunkState.y = chunkY;
      this.state.chunks.set(chunkId, chunkState);
    }

    return chunkState;
  }

  private serializeChunk(chunkState: ChunkState): ChunkSnapshot {
    return {
      chunkId: chunkState.id,
      x: chunkState.x,
      y: chunkState.y,
      buildings: this.mapSchemaKeys(chunkState.buildingIds)
        .map((buildingId) => this.state.buildings.get(buildingId))
        .filter((value): value is BuildingState => Boolean(value))
        .map((buildingState) => this.serializeBuildingState(buildingState)),
      players: this.mapSchemaKeys(chunkState.playerIds)
        .map((playerId) => this.state.players.get(playerId))
        .filter((value): value is PlayerState => Boolean(value))
        .map((playerState) => this.serializePlayerState(playerState)),
    };
  }

  private serializePlayerState(playerState: PlayerState): {
    id: string;
    userId: string;
    displayName: string;
    x: number;
    y: number;
    chunkId: string;
  } {
    return {
      id: playerState.id,
      userId: playerState.userId,
      displayName: playerState.displayName,
      x: playerState.x,
      y: playerState.y,
      chunkId: playerState.chunkId,
    };
  }

  private serializeBuildingState(buildingState: BuildingState): {
    id: string;
    ownerId: string;
    type: string;
    x: number;
    y: number;
    chunkId: string;
  } {
    return {
      id: buildingState.id,
      ownerId: buildingState.ownerId,
      type: buildingState.type,
      x: buildingState.x,
      y: buildingState.y,
      chunkId: buildingState.chunkId,
    };
  }

  private serializeParcel(parcel: ParcelDefinition): ParcelDefinition {
    return {
      id: parcel.id,
      ownerId: parcel.ownerId,
      x: parcel.x,
      y: parcel.y,
      width: parcel.width,
      height: parcel.height,
      allowPublic: parcel.allowPublic,
    };
  }

  private mapSchemaKeys(schema: MapSchema<unknown>): string[] {
    const keys: string[] = [];
    schema.forEach((_value, key) => {
      keys.push(key);
    });
    return keys;
  }

  private getChunkInfo(x: number, y: number): { chunkId: string; chunkX: number; chunkY: number } {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkY = Math.floor(y / this.chunkSize);
    return { chunkId: this.toChunkId(chunkX, chunkY), chunkX, chunkY };
  }

  private getChunkInfoFromChunkCoords(
    chunkX: number,
    chunkY: number,
  ): { chunkId: string; chunkX: number; chunkY: number } {
    return { chunkId: this.toChunkId(chunkX, chunkY), chunkX, chunkY };
  }

  private toChunkId(chunkX: number, chunkY: number): string {
    return `${chunkX}:${chunkY}`;
  }

  private broadcastToChunk(chunkId: string, type: string, payload: unknown): void {
    const listeners = this.chunkListeners.get(chunkId);

    if (!listeners) {
      return;
    }

    for (const sessionId of listeners) {
      const client = this.clients.find(
        (connectedClient) => connectedClient.sessionId === sessionId,
      );
      client?.send(type, payload);
    }
  }

  private addListener(chunkId: string, sessionId: string): void {
    let listeners = this.chunkListeners.get(chunkId);

    if (!listeners) {
      listeners = new Set<string>();
      this.chunkListeners.set(chunkId, listeners);
    }

    listeners.add(sessionId);
  }

  private removeListener(chunkId: string, sessionId: string): void {
    const listeners = this.chunkListeners.get(chunkId);

    if (!listeners) {
      return;
    }

    listeners.delete(sessionId);

    if (listeners.size === 0) {
      this.chunkListeners.delete(chunkId);
    }
  }

  private removeAllListenersForClient(sessionId: string): void {
    for (const [chunkId, listeners] of this.chunkListeners.entries()) {
      if (listeners.delete(sessionId) && listeners.size === 0) {
        this.chunkListeners.delete(chunkId);
      }
    }
  }
}
