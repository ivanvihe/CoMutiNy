import { Client, Room } from 'colyseus.js';
import { getBackendBaseUrl } from '../config/backend';
import { PlayerState, WorldState } from './schema';
import {
  PlayerSnapshot,
  SnapshotBuffer,
  Vector3Like,
  WorldSnapshot,
} from './snapshots';

export interface ChatMessageEvent {
  id: string;
  authorId: string;
  authorName: string;
  message: string;
  timestamp: number;
  type: 'system' | 'player';
}

export interface BlockPlacedEvent {
  id: string;
  type: string;
  position: Vector3Like;
  by: string;
  timestamp: number;
}

export interface BlockRemovedEvent {
  id: string;
  by: string;
  timestamp: number;
}

export interface PlayerJoinEvent {
  id: string;
  displayName: string;
}

export interface PlayerLeaveEvent {
  id: string;
}

interface PlayerUpdateMessage {
  position: Vector3Like;
  rotation?: Vector3Like;
  sequence: number;
}

interface BlockPlacementMessage {
  type: string;
  position: Vector3Like;
}

interface BlockRemovalMessage {
  id?: string;
  position?: Vector3Like;
}

export type MultiplayerSnapshotEvent = WorldSnapshot;

type ConnectionState = 'desconectado' | 'conectando' | 'conectado' | 'error';

const INTERPOLATION_LAG_MS = 120;

export class MultiplayerClient extends EventTarget {
  private readonly statusElement: HTMLElement;
  private readonly snapshotBuffer: SnapshotBuffer;
  private client: Client | undefined;
  private room: Room<WorldState> | undefined;
  private latestSnapshot: WorldSnapshot = { timestamp: 0, players: new Map() };
  private sequence = 0;
  private updateHandle: number | undefined;
  private connectionState: ConnectionState = 'desconectado';
  private displayName: string;

  constructor(statusElement: HTMLElement) {
    super();
    this.statusElement = statusElement;
    this.snapshotBuffer = new SnapshotBuffer(INTERPOLATION_LAG_MS);
    this.displayName = this.resolveDisplayName();
    this.updateStatus('desconectado');
  }

  async connect(): Promise<void> {
    if (this.room) {
      return;
    }

    this.updateStatus('conectando');

    try {
      const endpoint = this.getEndpoint();
      this.client = new Client(endpoint);
      this.room = await this.client.joinOrCreate<WorldState>('world', {
        displayName: this.displayName,
      });

      this.registerRoomHandlers(this.room);
      this.captureSnapshot();
      this.startLoop();
      this.updateStatus('conectado');
      this.dispatchEvent(new CustomEvent('connected'));
    } catch (error) {
      console.error('No se pudo conectar con Colyseus:', error);
      this.updateStatus('error');
      this.dispatchEvent(new CustomEvent('connection-error', { detail: error }));
      throw error;
    }
  }

  disconnect(): void {
    if (!this.room) {
      return;
    }
    this.room.leave();
    this.stopLoop();
    this.room = undefined;
    this.client = undefined;
    this.updateStatus('desconectado');
    this.dispatchEvent(new CustomEvent('disconnected'));
  }

  getSnapshot(): WorldSnapshot {
    return this.latestSnapshot;
  }

  sendPlayerUpdate(update: { position: Vector3Like; rotation?: Vector3Like }): void {
    if (!this.room) {
      return;
    }
    this.sequence += 1;
    const payload: PlayerUpdateMessage = {
      position: update.position,
      rotation: update.rotation,
      sequence: this.sequence,
    };
    this.room.send('player:update', payload);
  }

  placeBlock(action: { position: Vector3Like; type: string }): void {
    if (!this.room) {
      return;
    }
    const payload: BlockPlacementMessage = {
      position: action.position,
      type: action.type,
    };
    this.room.send('block:place', payload);
  }

  removeBlock(action: { id?: string; position?: Vector3Like }): void {
    if (!this.room) {
      return;
    }
    const payload: BlockRemovalMessage = {};
    if (typeof action.id === 'string') {
      payload.id = action.id;
    }
    if (action.position) {
      payload.position = action.position;
    }
    this.room.send('block:remove', payload);
  }

  sendChatMessage(message: string): void {
    if (!this.room) {
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    this.room.send('chat:message', { message: trimmed });
  }

  private registerRoomHandlers(room: Room<WorldState>): void {
    room.onLeave(() => {
      this.stopLoop();
      this.room = undefined;
      this.updateStatus('desconectado');
      this.dispatchEvent(new CustomEvent('disconnected'));
    });

    room.onMessage('chat:message', (payload: ChatMessageEvent) => {
      this.dispatchEvent(new CustomEvent<ChatMessageEvent>('chat', { detail: payload }));
    });

    room.onMessage('block:placed', (payload: BlockPlacedEvent) => {
      this.dispatchEvent(
        new CustomEvent<BlockPlacedEvent>('block:placed', { detail: payload }),
      );
    });

    room.onMessage('block:removed', (payload: BlockRemovedEvent) => {
      this.dispatchEvent(
        new CustomEvent<BlockRemovedEvent>('block:removed', { detail: payload }),
      );
    });

    room.state.players.onAdd = (player, id) => {
      this.dispatchEvent(
        new CustomEvent<PlayerJoinEvent>('player:join', {
          detail: { id, displayName: player.displayName },
        }),
      );
    };

    room.state.players.onRemove = (_player, id) => {
      this.dispatchEvent(
        new CustomEvent<PlayerLeaveEvent>('player:leave', { detail: { id } }),
      );
    };

    room.onStateChange(() => {
      this.captureSnapshot();
    });
  }

  private captureSnapshot(): void {
    if (!this.room) {
      return;
    }
    const timestamp = performance.now();
    const players = new Map<string, PlayerSnapshot>();
    this.room.state.players.forEach((player: PlayerState, id: string) => {
      players.set(id, this.createPlayerSnapshot(player));
    });

    this.snapshotBuffer.push({ timestamp, players });
  }

  private startLoop(): void {
    if (this.updateHandle !== undefined) {
      return;
    }
    const step = () => {
      this.latestSnapshot = this.snapshotBuffer.sample(performance.now());
      this.renderStatus();
      this.dispatchEvent(
        new CustomEvent<MultiplayerSnapshotEvent>('snapshot', {
          detail: this.latestSnapshot,
        }),
      );
      this.updateHandle = window.requestAnimationFrame(step);
    };
    this.updateHandle = window.requestAnimationFrame(step);
  }

  private stopLoop(): void {
    if (this.updateHandle !== undefined) {
      window.cancelAnimationFrame(this.updateHandle);
      this.updateHandle = undefined;
    }
  }

  private renderStatus(): void {
    const players = this.latestSnapshot.players;
    const stateLabel = this.connectionState[0]?.toUpperCase() + this.connectionState.slice(1);
    this.statusElement.innerHTML = `
      <div class="multiplayer-status">
        <p><strong>Estado:</strong> ${stateLabel}</p>
        <p><strong>Jugadores conectados:</strong> ${players.size}</p>
      </div>
    `;
  }

  private updateStatus(state: ConnectionState): void {
    this.connectionState = state;
    this.renderStatus();
  }

  private getEndpoint(): string {
    const baseUrl = new URL(getBackendBaseUrl());
    const protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const path = baseUrl.pathname.endsWith('/')
      ? baseUrl.pathname.slice(0, -1)
      : baseUrl.pathname;
    return `${protocol}//${baseUrl.host}${path}`;
  }

  private createPlayerSnapshot(player: PlayerState): PlayerSnapshot {
    return {
      id: player.id,
      displayName: player.displayName,
      position: player.position.toJSON(),
      rotation: player.rotation.toJSON(),
      lastUpdate: player.lastUpdate,
    };
  }

  private resolveDisplayName(): string {
    const stored = window.localStorage.getItem('comutiny:displayName');
    if (stored && stored.trim().length > 0) {
      return stored.trim();
    }
    const generated = `Tripulante ${Math.floor(Math.random() * 10_000)}`;
    window.localStorage.setItem('comutiny:displayName', generated);
    return generated;
  }
}
