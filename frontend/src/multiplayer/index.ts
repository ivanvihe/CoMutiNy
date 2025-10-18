import { MultiplayerClient } from './client';

export type {
  MultiplayerClient,
  ChatMessageEvent,
  ChatScope,
  ConnectionState,
  BlockPlacedEvent,
  BlockRemovedEvent,
  PlayerJoinEvent,
  PlayerLeaveEvent,
  MultiplayerSnapshotEvent,
} from './client';

export { SnapshotBuffer } from './snapshots';

export interface MultiplayerBootstrapOptions {
  autoConnect?: boolean;
}

export function bootstrapMultiplayer(
  statusSelector: string,
  options: MultiplayerBootstrapOptions = {},
): MultiplayerClient {
  const status = document.querySelector(statusSelector);
  if (!(status instanceof HTMLElement)) {
    throw new Error('No se encontró el contenedor de estado.');
  }

  const client = new MultiplayerClient(status);
  if (options.autoConnect ?? true) {
    client.connect().catch((error) => {
      console.error('Error conectando el cliente de Colyseus:', error);
    });
  }

  return client;
}
