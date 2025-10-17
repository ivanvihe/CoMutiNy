# Real-time Multiplayer Architecture

This document summarizes how the CoMutiNy real-time stack works after the multiplayer updates.

## Connection flow

1. **HTTP bootstrap** – the web client authenticates via REST (`/auth/*`) and obtains cookies/tokens.
2. **Socket handshake** – the client connects to the Socket.IO gateway (`/socket.io`) using the URL exposed via `VITE_SOCKET_URL`.
3. **World snapshot** – as soon as the server accepts the connection it sends the current world snapshot (`world`, `players`, `chat`, `spriteAtlas`). The client hydrates its `WorldContext` state using this payload.
4. **Player join** – the client emits `player:join` with:
   - `playerId` (user id or generated guest id)
   - optional metadata (avatar selection, map, cosmetics)
   - current transform & animation
   The server enriches the payload (avatar metadata, sprite) and persists it through the session manager.
5. **State replication** – every movement/animation update is published through `player:update`. Chat messages are emitted via `chat:message` and relayed to all peers.
6. **Graceful exit** – clients call `player:leave` (and also handled on `disconnect`). The server removes the player session and broadcasts `player:left`.

## Authentication & session management

- HTTP endpoints keep issuing auth cookies/tokens. The Socket.IO layer reads the same cookies via `cookies` middleware.
- `SessionManager` centralizes player/chat state. It:
  - stores authoritative data in memory (`WorldState`)
  - mirrors snapshots to Redis (optional) so multiple instances can sync state
  - publishes events via Redis Pub/Sub (player upsert/remove, chat, sprites)
  - emits `session:disconnect` to evict duplicated sessions (e.g., stale sockets when a user reconnects elsewhere)
- The client listens for `session:terminated` to reset the local state and show termination feedback.

## Scaling & concurrency

- Socket.IO uses the Redis adapter when `REDIS_*` env vars are present. All gateway nodes share the same Pub/Sub channels and session snapshots.
- `WorldState` tracks players by `playerId` and `socketId` separately, allowing reconnects and duplicate socket eviction.
- Chat history is trimmed to 200 records on the client and 50 records on the server.

## Handling simultaneous avatars

- `enrichJoinPayloadWithAvatar` fetches avatar sprites and merges cosmetics before persisting the player.
- Each join request overrides any existing socket mapped to the same `playerId`; the previous socket is removed and notified through `session:disconnect`.
- The client merges metadata updates so cosmetic changes propagate without losing other attributes.

## Load & latency testing

A load harness lives in `server/scripts/loadTest.js`. Run it with:

```bash
npm run load:test --prefix server
```

Environment knobs:

| Variable | Default | Description |
| --- | --- | --- |
| `LOAD_TARGET_URL` | `http://localhost:4000` | Gateway URL |
| `LOAD_CLIENTS` | `50` | Concurrent synthetic players |
| `LOAD_DURATION_MS` | `60000` | Run length (ms) |
| `LOAD_UPDATE_INTERVAL_MS` | `1000` | Interval between `player:update` packets |
| `LOAD_SPAWN_INTERVAL_MS` | `50` | Delay (ms) between spawning each synthetic client |

Metrics captured:

- join latency distribution (ms)
- update latency distribution (ms)
- connection / disconnect totals
- first 10 error samples (if any)

The script drives each synthetic client through join/update/leave cycles and reports aggregate statistics via `console.table`.

## Operational checklist

1. Provision Redis (or compatible broker) and expose `REDIS_URL` / `REDIS_HOST` env vars.
2. Set `CORS_ORIGIN` for cross-origin Socket.IO clients.
3. Deploy multiple server instances behind a load balancer; the Redis adapter guarantees cross-node fan-out.
4. Run `npm run load:test --prefix server` after scaling changes to verify latency targets.
