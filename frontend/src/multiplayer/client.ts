import { Client, Room } from "colyseus.js";
import { useClientState } from "@multiplayer/state";

const endpoint = import.meta.env.VITE_API_URL ?? "http://localhost:2567";

class MultiplayerClient {
  private client = new Client(endpoint);
  private room: Room | null = null;

  async connect(username: string, password: string) {
    const { setSession, setUsername } = useClientState.getState();
    setUsername(username);

    this.room = await this.client.joinOrCreate("world", { username, password });
    setSession(this.room.sessionId);

    this.room.onLeave((code) => {
      if (code !== 1000) {
        console.warn("Colyseus connection closed", code);
      }
      setSession(null);
    });
  }

  getRoom() {
    return this.room;
  }
}

export const multiplayerClient = new MultiplayerClient();
