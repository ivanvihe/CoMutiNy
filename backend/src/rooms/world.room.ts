import { Client, Room } from 'colyseus';
import { WorldState } from '../world/state.js';
import { createWorldGenerator } from '../world/generator.js';

export class WorldRoom extends Room<WorldState> {
  onCreate(): void {
    this.setState(new WorldState());

    const generator = createWorldGenerator();
    this.onMessage('ping', (client: Client) => {
      client.send('pong');
    });

    generator.populateState(this.state);
  }

  onJoin(client: Client): void {
    console.log(`Cliente ${client.sessionId} se unió a la sala world.`);
  }

  onLeave(client: Client): void {
    console.log(`Cliente ${client.sessionId} abandonó la sala world.`);
  }
}
