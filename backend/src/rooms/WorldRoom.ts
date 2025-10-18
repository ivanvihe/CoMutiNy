import { Room, Client } from "colyseus";
import { Schema, MapSchema, type } from "@colyseus/schema";
import { loadChunk } from "../world/repository";
import type { ChunkPayload } from "../world/generator";

class PlayerState extends Schema {
  @type("string")
  username = "";

  @type("number")
  x = 0;

  @type("number")
  y = 0;

  @type("number")
  z = 0;
}

class WorldState extends Schema {
  @type({ map: PlayerState })
  players = new MapSchema<PlayerState>();

  @type({ map: Schema })
  chunks = new MapSchema<Schema>();
}

export class WorldRoom extends Room<WorldState> {
  maxClients = 120;

  async onCreate(options: { username?: string }) {
    this.setState(new WorldState());

    this.onMessage("chat", (client, payload: { text: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        return;
      }
      const text = payload.text?.toString().slice(0, 280) ?? "";
      this.broadcast("chat", { from: player.username, text, at: Date.now() });
    });

    this.onMessage("request_chunk", async (client, coords: { x: number; z: number }) => {
      const chunk = await loadChunk(coords);
      this.sendChunkToClient(client, chunk);
    });
  }

  onJoin(client: Client, options: { username?: string }) {
    const player = new PlayerState();
    player.username = options.username ?? `Visitante-${client.sessionId.slice(0, 4)}`;
    player.y = 20;
    this.state.players.set(client.sessionId, player);

    this.loadSpawnChunks(client).catch((error) => {
      console.error("Failed to load initial chunks", error);
    });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("WorldRoom disposed");
  }

  private async loadSpawnChunks(client: Client) {
    const spawnCoords = [
      { x: 0, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: -1 }
    ];

    for (const coords of spawnCoords) {
      const chunk = await loadChunk(coords);
      this.sendChunkToClient(client, chunk);
    }
  }

  private sendChunkToClient(client: Client, chunk: ChunkPayload) {
    client.send("chunk", chunk);
  }
}
