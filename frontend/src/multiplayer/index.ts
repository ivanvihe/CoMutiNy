import { MultiplayerClient } from './client';

export type {
  MultiplayerClient,
  ChatMessageEvent,
  BlockPlacedEvent,
  BlockRemovedEvent,
  PlayerJoinEvent,
  PlayerLeaveEvent,
  MultiplayerSnapshotEvent,
} from './client';

export { SnapshotBuffer } from './snapshots';

export function bootstrapMultiplayer(statusSelector: string): MultiplayerClient {
  const status = document.querySelector(statusSelector);
  if (!(status instanceof HTMLElement)) {
    throw new Error('No se encontró el contenedor de estado.');
  }

  const client = new MultiplayerClient(status);
  client.connect().catch((error) => {
    console.error('Error conectando el cliente de Colyseus:', error);
  });

  return client;
}
