import { Client, Room } from 'colyseus';

/**
 * Minimal lobby room that can be used to verify server bootstrapping.
 */
export class LobbyRoom extends Room {
  onCreate(): void {
    this.setState({ players: [] });
  }

  onJoin(client: Client): void {
    const players = this.state.players as string[];
    players.push(client.sessionId);
  }

  onLeave(client: Client): void {
    this.state.players = (this.state.players as string[]).filter(
      (playerId) => playerId !== client.sessionId,
    );
  }
}
