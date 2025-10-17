import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  DEFAULT_MAP_ID,
  MAPS,
  fetchServerMaps,
  resolveDefaultMapId
} from '../game/maps.js';
import { useWorld } from './WorldContext.jsx';
import { createErrorEvent, normaliseInteractionEvent } from '../game/interaction/index.js';

const MapContext = createContext(undefined);

const MOVEMENT_DURATION = 280;
const DEFAULT_DIRECTION = 'down';

const DIRECTION_DELTAS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const expandArea = ({ x, y, width = 1, height = 1 }) => {
  const tiles = [];
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      tiles.push(`${x + dx},${y + dy}`);
    }
  }
  return tiles;
};

const normaliseMap = (mapDefinition) => {
  const blockedTiles = new Set();
  mapDefinition.blockedAreas?.forEach((area) => {
    expandArea(area).forEach((tile) => blockedTiles.add(tile));
  });

  mapDefinition.collidableTiles?.forEach((position) => {
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
      blockedTiles.add(`${position.x},${position.y}`);
    }
  });

  mapDefinition.objects?.forEach((object) => {
    if (object.solid) {
      expandArea({ ...object.position, ...object.size }).forEach((tile) => blockedTiles.add(tile));
    }
  });

  return {
    ...mapDefinition,
    blockedTiles
  };
};

const INITIAL_MAPS = MAPS.map((map) => normaliseMap(map));
const INITIAL_DEFAULT_MAP_ID = resolveDefaultMapId(MAPS);
const INITIAL_DEFAULT_MAP =
  INITIAL_MAPS.find((map) => map.id === INITIAL_DEFAULT_MAP_ID) ?? INITIAL_MAPS[0] ?? null;
const INITIAL_SPAWN = INITIAL_DEFAULT_MAP?.spawn ?? { x: 0, y: 0 };

export function MapProvider({ children }) {
  const [maps, setMaps] = useState(INITIAL_MAPS);
  const [currentMapId, setCurrentMapId] = useState(
    INITIAL_DEFAULT_MAP_ID ?? DEFAULT_MAP_ID ?? 'empty-map'
  );
  const [playerPosition, setPlayerPosition] = useState(INITIAL_SPAWN);
  const [playerRenderPosition, setPlayerRenderPosition] = useState(INITIAL_SPAWN);
  const [playerDirection, setPlayerDirection] = useState(DEFAULT_DIRECTION);
  const [playerIsMoving, setPlayerIsMoving] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const { updateLocalPlayerState, interactWithObject: sendInteractionRequest } = useWorld();

  const movementRef = useRef(null);
  const animationFrameRef = useRef(null);
  const playerRenderPositionRef = useRef(INITIAL_SPAWN);

  const mapLookup = useMemo(() => new Map(maps.map((map) => [map.id, map])), [maps]);
  const currentMap = useMemo(() => mapLookup.get(currentMapId) ?? null, [mapLookup, currentMapId]);
  const defaultMapId = useMemo(() => resolveDefaultMapId(maps.length ? maps : MAPS), [maps]);
  const availableMaps = maps;

  useEffect(() => {
    playerRenderPositionRef.current = playerRenderPosition;
  }, [playerRenderPosition]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

    fetchServerMaps({ signal: controller?.signal })
      .then((remoteMaps) => {
        if (cancelled || !remoteMaps.length) {
          return;
        }
        setMaps((existing) => {
          const normalised = remoteMaps.map((map) => normaliseMap(map));
          return normalised.length ? normalised : existing;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (controller) {
        controller.abort();
      }
    };
  }, []);

  useEffect(() => {
    const fallbackId = defaultMapId ?? DEFAULT_MAP_ID;
    setCurrentMapId((previous) => {
      if (previous && mapLookup.has(previous)) {
        return previous;
      }
      return fallbackId;
    });
  }, [defaultMapId, mapLookup]);

  useEffect(() => {
    if (!currentMap) {
      return;
    }

    const spawn = currentMap.spawn ?? { x: 0, y: 0 };

    setPlayerPosition((previous) => {
      if (!previous) {
        return spawn;
      }
      const withinBounds =
        previous.x >= 0 &&
        previous.y >= 0 &&
        previous.x < currentMap.size.width &&
        previous.y < currentMap.size.height;
      return withinBounds ? previous : spawn;
    });

    setPlayerRenderPosition((previous) => {
      if (!previous) {
        playerRenderPositionRef.current = spawn;
        return spawn;
      }
      const withinBounds =
        previous.x >= 0 &&
        previous.y >= 0 &&
        previous.x < currentMap.size.width &&
        previous.y < currentMap.size.height;
      if (withinBounds) {
        playerRenderPositionRef.current = previous;
        return previous;
      }
      playerRenderPositionRef.current = spawn;
      return spawn;
    });
  }, [currentMap]);

  useEffect(() => {
    if (movementRef.current) {
      return;
    }
    setPlayerRenderPosition((previous) => {
      if (!previous) {
        return playerPosition;
      }
      const dx = Math.abs((previous.x ?? 0) - playerPosition.x);
      const dy = Math.abs((previous.y ?? 0) - playerPosition.y);
      if (dx < 0.001 && dy < 0.001) {
        return previous;
      }
      return playerPosition;
    });
    playerRenderPositionRef.current = playerPosition;
  }, [playerPosition]);

  const isWithinBounds = useCallback(
    ({ x, y }) =>
      Boolean(
        currentMap &&
          x >= 0 &&
          y >= 0 &&
          x < currentMap.size.width &&
          y < currentMap.size.height
      ),
    [currentMap]
  );

  const isBlocked = useCallback(
    ({ x, y }) => {
      if (!currentMap) {
        return true;
      }
      const key = `${x},${y}`;
      return currentMap.blockedTiles.has(key);
    },
    [currentMap]
  );

  const canMoveTo = useCallback(
    (position) => isWithinBounds(position) && !isBlocked(position),
    [isWithinBounds, isBlocked]
  );

  const findObjectAt = useCallback(
    ({ x, y }) => {
      if (!currentMap?.objects?.length) {
        return undefined;
      }

      return currentMap.objects.find((object) => {
        const width = object.size?.width ?? 1;
        const height = object.size?.height ?? 1;
        const withinX = x >= object.position.x && x < object.position.x + width;
        const withinY = y >= object.position.y && y < object.position.y + height;
        return withinX && withinY;
      });
    },
    [currentMap]
  );

  const findPortalAt = useCallback(
    ({ x, y }) => {
      if (!currentMap?.portals?.length) {
        return undefined;
      }

      return currentMap.portals.find((portal) => {
        const area = portal.from ?? {};
        const width = area.width ?? 1;
        const height = area.height ?? 1;
        const withinX = x >= area.x && x < area.x + width;
        const withinY = y >= area.y && y < area.y + height;
        return withinX && withinY;
      });
    },
    [currentMap]
  );

  const switchMap = useCallback(
    (mapId, { position, event } = {}) => {
      const fallbackId = defaultMapId ?? DEFAULT_MAP_ID;
      const targetMap = mapLookup.get(mapId) ?? mapLookup.get(fallbackId);
      if (!targetMap) {
        return false;
      }

      movementRef.current = null;
      if (typeof window !== 'undefined' && animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;

      const nextPosition = position ?? targetMap.spawn ?? { x: 0, y: 0 };
      setCurrentMapId(targetMap.id);
      setPlayerPosition(nextPosition);
      setPlayerRenderPosition(nextPosition);
      playerRenderPositionRef.current = nextPosition;
      setPlayerDirection(DEFAULT_DIRECTION);
      setPlayerIsMoving(false);
      updateLocalPlayerState({
        position: { ...nextPosition, z: 0 },
        metadata: { heading: DEFAULT_DIRECTION },
        animation: 'idle'
      });
      if (event) {
        setActiveEvent(event);
      } else {
        setActiveEvent(null);
      }
      return true;
    },
    [defaultMapId, mapLookup, updateLocalPlayerState]
  );

  const runMovementFrame = useCallback(
    (timestamp) => {
      const movement = movementRef.current;
      if (!movement) {
        animationFrameRef.current = null;
        return;
      }

      if (!movement.startTime) {
        movement.startTime = timestamp;
      }

      const elapsed = timestamp - movement.startTime;
      const progress = Math.min(elapsed / movement.duration, 1);
      const x = movement.from.x + (movement.to.x - movement.from.x) * progress;
      const y = movement.from.y + (movement.to.y - movement.from.y) * progress;
      const interpolated = { x, y };
      setPlayerRenderPosition(interpolated);
      playerRenderPositionRef.current = interpolated;

      if (progress >= 1) {
        movementRef.current = null;
        setPlayerRenderPosition(movement.to);
        playerRenderPositionRef.current = movement.to;
        setPlayerIsMoving(false);
        animationFrameRef.current = null;
        updateLocalPlayerState({
          position: { ...movement.to, z: 0 },
          animation: 'idle',
          metadata: { heading: movement.direction }
        });
        return;
      }

      if (typeof window !== 'undefined') {
        animationFrameRef.current = window.requestAnimationFrame(runMovementFrame);
      }
    },
    [updateLocalPlayerState]
  );

  const movePlayer = useCallback(
    (direction) => {
      const delta = DIRECTION_DELTAS[direction];
      if (!delta) {
        return { moved: false, reason: 'unknown-direction' };
      }

      if (movementRef.current) {
        return { moved: false, reason: 'moving' };
      }

      const nextPosition = {
        x: playerPosition.x + delta.x,
        y: playerPosition.y + delta.y
      };

      if (!canMoveTo(nextPosition)) {
        return { moved: false, reason: 'blocked' };
      }

      const portal = findPortalAt(nextPosition);
      if (portal) {
        const targetMap = portal.targetMap ? mapLookup.get(portal.targetMap) : null;
        if (targetMap) {
          const travelEvent = {
            type: 'travel',
            title: targetMap.name,
            description: portal.description ?? 'Te desplazas a otra sección de la comunidad.'
          };

          switchMap(portal.targetMap, {
            position: portal.targetPosition,
            event: travelEvent
          });
          return { moved: true, reason: 'map-changed' };
        }
      }

      const fromPosition = playerRenderPositionRef.current ?? playerPosition;

      setPlayerPosition(nextPosition);
      setPlayerDirection(direction);
      setActiveEvent(null);
      setPlayerIsMoving(true);

      const movement = {
        from: { ...fromPosition },
        to: { ...nextPosition },
        startTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        duration: MOVEMENT_DURATION,
        direction
      };

      movementRef.current = movement;
      setPlayerRenderPosition(fromPosition);
      playerRenderPositionRef.current = fromPosition;

      updateLocalPlayerState({
        position: { ...nextPosition, z: 0 },
        metadata: { heading: direction },
        animation: 'walk'
      });

      if (typeof window === 'undefined') {
        movementRef.current = null;
        setPlayerRenderPosition(nextPosition);
        playerRenderPositionRef.current = nextPosition;
        setPlayerIsMoving(false);
        updateLocalPlayerState({
          position: { ...nextPosition, z: 0 },
          metadata: { heading: direction },
          animation: 'idle'
        });
      } else if (!animationFrameRef.current) {
        animationFrameRef.current = window.requestAnimationFrame(runMovementFrame);
      }

      return { moved: true, reason: 'moved' };
    },
    [
      canMoveTo,
      findPortalAt,
      mapLookup,
      playerPosition,
      runMovementFrame,
      switchMap,
      updateLocalPlayerState
    ]
  );

  const interact = useCallback(async () => {
    const object = findObjectAt(playerPosition);
    if (!object?.interaction) {
      setActiveEvent(null);
      return null;
    }

    try {
      const response = await sendInteractionRequest({
        objectId: object.id,
        mapId: currentMapId,
        action: 'interact'
      });

      const event = response?.event
        ? normaliseInteractionEvent(response.event, {
            fallbackTitle: object.name ?? 'Interacción',
            fallbackDescription:
              object.interaction?.description ?? object.description ?? 'No se registró ninguna descripción.'
          })
        : {
            ...object.interaction,
            objectId: object.id,
            objectName: object.name,
            mapId: currentMapId
          };

      setActiveEvent(event);
      return event;
    } catch (error) {
      const fallback = createErrorEvent(error.message, {
        title: object.name ?? 'Interacción',
        description:
          object.interaction?.description ?? 'No se pudo completar la interacción con este objeto.'
      });
      setActiveEvent(fallback);
      return fallback;
    }
  }, [currentMapId, findObjectAt, playerPosition, sendInteractionRequest]);

  const clearEvent = useCallback(() => setActiveEvent(null), []);

  const value = useMemo(
    () => ({
      maps: availableMaps,
      currentMap,
      currentMapId,
      playerPosition,
      playerRenderPosition,
      playerDirection,
      playerIsMoving,
      canMoveTo,
      movePlayer,
      interact,
      activeEvent,
      switchMap,
      clearEvent,
      objectAtPlayerPosition: findObjectAt(playerPosition)
    }),
    [
      activeEvent,
      availableMaps,
      canMoveTo,
      clearEvent,
      currentMap,
      currentMapId,
      findObjectAt,
      interact,
      movePlayer,
      playerDirection,
      playerIsMoving,
      playerPosition,
      playerRenderPosition,
      switchMap
    ]
  );

  useEffect(() => {
    updateLocalPlayerState({
      position: { ...playerPosition, z: 0 },
      metadata: { heading: playerDirection }
    });
  }, [currentMapId, playerDirection, playerPosition, updateLocalPlayerState]);

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMap() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap debe utilizarse dentro de un MapProvider.');
  }
  return context;
}
