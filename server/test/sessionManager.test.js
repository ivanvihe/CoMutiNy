import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

import { SessionManager } from '../src/services/sessionManager.js';
import { WorldState } from '../src/services/worldState.js';

test('coalesces rapid player updates into a single broadcast', async () => {
  const state = new WorldState();
  const manager = new SessionManager(state, { updateDebounceMs: 10, snapshotDebounceMs: 10 });

  const joined = [];
  const updates = [];

  manager.on('player:joined', (payload) => joined.push(payload));
  manager.on('player:updated', (payload) => updates.push(payload));

  const player = manager.addPlayer('socket-1', {
    alias: 'Alpha',
    sprite: 'explorer',
    position: { x: 0, y: 0, z: 0 },
    direction: 'down'
  });

  assert.equal(joined.length, 1);
  assert.equal(joined[0].player.id, player.id);
  assert.equal(joined[0].player.metadata.alias, 'Alpha');

  manager.updatePlayer('socket-1', {
    position: { x: 1, y: 2, z: 0 },
    animation: 'walk'
  });
  manager.updatePlayer('socket-1', {
    position: { x: 2, y: 3, z: 0 },
    direction: 'left'
  });

  await delay(30);

  assert.equal(updates.length, 1);
  const update = updates[0].player;
  assert.deepEqual(update.position, { x: 2, y: 3, z: 0 });
  assert.equal(update.direction, 'left');
  assert.equal(update.animation, 'walk');
  assert.equal(update.metadata.alias, 'Alpha');
  assert.equal(update.metadata.avatar.sprite, 'explorer');

  manager.removeAllListeners();
});

test('removing a player cancels pending updates and clears state', async () => {
  const state = new WorldState();
  const manager = new SessionManager(state, { updateDebounceMs: 10, snapshotDebounceMs: 10 });

  const events = [];

  manager.on('player:left', (payload) => events.push({ type: 'left', payload }));
  manager.on('player:updated', (payload) => events.push({ type: 'updated', payload }));

  const player = manager.addPlayer('socket-2', {
    alias: 'Beta',
    sprite: 'scientist',
    position: { x: 4, y: 4, z: 0 },
    direction: 'up'
  });

  manager.updatePlayer('socket-2', {
    position: { x: 5, y: 6, z: 0 }
  });

  const removed = manager.removePlayer('socket-2', 'test:disconnect');
  assert.equal(removed?.id, player.id);

  await delay(30);

  const leftEvents = events.filter((event) => event.type === 'left');
  const updateEvents = events.filter((event) => event.type === 'updated');

  assert.equal(leftEvents.length, 1);
  assert.equal(leftEvents[0].payload.player.id, player.id);
  assert.equal(updateEvents.length, 0);
  assert.equal(state.getPlayerById(player.id), null);

  manager.removeAllListeners();
});
