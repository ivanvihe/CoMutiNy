declare module 'colyseus.js' {
  export class Room<TState = unknown> {
    sessionId: string;
    onMessage<TMessage = unknown>(type: string, callback: (message: TMessage) => void): void;
    send(type: string, message?: unknown): void;
    leave(consented?: boolean): Promise<void>;
  }

  export class Client {
    constructor(endpoint: string);
    joinOrCreate<TState = unknown>(roomName: string, options?: unknown): Promise<Room<TState>>;
  }
}
