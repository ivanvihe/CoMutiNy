const toCoordinate = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const x = Number.isFinite(value.x) ? Number(value.x) : null;
  const y = Number.isFinite(value.y) ? Number(value.y) : null;
  if (x === null || y === null) {
    return null;
  }
  return { x, y };
};

const resolveSpawnPoint = (world, spawnKey) => {
  if (!world || typeof world !== 'object') {
    return null;
  }
  if (spawnKey && world.spawnPoints && typeof world.spawnPoints === 'object') {
    const point = world.spawnPoints[spawnKey];
    return toCoordinate(point);
  }
  return null;
};

const registerNavigationEvents = (sessionManager) => {
  if (!sessionManager || typeof sessionManager.on !== 'function') {
    return;
  }

  sessionManager.on('object:event', async ({ event, origin, socketId }) => {
    if (!event || origin === 'remote') {
      return;
    }

    const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
    const objectId = typeof metadata.objectId === 'string' ? metadata.objectId.trim() : null;
    if (objectId && objectId !== 'community_door') {
      return;
    }

    const targetMap = typeof metadata.targetMap === 'string' ? metadata.targetMap.trim() : null;
    if (!targetMap) {
      return;
    }

    try {
      await sessionManager.selectWorldByMapId(targetMap, { origin: 'door', socketId });
    } catch (error) {
      console.error('[world-events] Failed to apply world transition', error);
      return;
    }

    let destination = toCoordinate(metadata.targetPosition);
    const targetSpawn = typeof metadata.targetSpawn === 'string' ? metadata.targetSpawn.trim() : null;

    if (!destination && targetSpawn) {
      try {
        const world = sessionManager.worldState?.getWorld?.();
        destination = resolveSpawnPoint(world, targetSpawn);
      } catch (error) {
        console.warn('[world-events] Unable to resolve target spawn point', error);
      }
    }

    if (!destination) {
      try {
        const world = sessionManager.worldState?.getWorld?.();
        destination = world?.spawn ? toCoordinate(world.spawn) : null;
      } catch (error) {
        destination = null;
      }
    }

    if (destination && socketId && typeof sessionManager.worldState?.updatePlayer === 'function') {
      try {
        sessionManager.worldState.updatePlayer(socketId, { position: destination });
      } catch (error) {
        console.warn('[world-events] Failed to reposition player after transition', error);
      }
    }
  });
};

export default registerNavigationEvents;
