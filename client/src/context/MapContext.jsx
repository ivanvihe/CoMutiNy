import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MAPS } from '../game/maps.js';
import { useWorld } from './WorldContext.jsx';
import {
  applyMissionUpdatesToState,
  createInitialMissionState,
  DEFAULT_MISSION_STATUS
} from './mapMissions.js';

const MapContext = createContext(undefined);

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

const MAP_LOOKUP = new Map(MAPS.map((map) => [map.id, normaliseMap(map)]));

const DEFAULT_MAP_ID = MAPS[0]?.id;
const MAX_LOG_ENTRIES = 30;

export function MapProvider({ children }) {
  const [currentMapId, setCurrentMapId] = useState(DEFAULT_MAP_ID);
  const [playerPosition, setPlayerPosition] = useState(() => {
    const startMap = MAP_LOOKUP.get(DEFAULT_MAP_ID);
    return startMap?.spawn ?? { x: 0, y: 0 };
  });
  const [activeEvent, setActiveEvent] = useState(null);
  const [missionStates, setMissionStates] = useState(() => createInitialMissionState(MAPS));
  const [missionLog, setMissionLog] = useState([]);
  const { updateLocalPlayerState } = useWorld();

  const availableMaps = useMemo(() => MAPS.map((map) => MAP_LOOKUP.get(map.id)), []);
  const currentMap = useMemo(() => MAP_LOOKUP.get(currentMapId), [currentMapId]);
  const missions = useMemo(() => {
    const mapMissions = currentMap?.missions ?? [];
    if (!mapMissions.length) {
      return [];
    }

    const currentState = missionStates[currentMapId] ?? {};
    return mapMissions.map((mission) => ({
      ...mission,
      status: currentState[mission.id] ?? mission.status ?? DEFAULT_MISSION_STATUS
    }));
  }, [currentMap, currentMapId, missionStates]);

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
      const targetMap = MAP_LOOKUP.get(mapId);
      if (!targetMap) {
        return false;
      }

      setCurrentMapId(mapId);
      const nextPosition = position ?? targetMap.spawn ?? { x: 0, y: 0 };
      setPlayerPosition(nextPosition);
      updateLocalPlayerState({
        position: { ...nextPosition, z: 0 },
        metadata: { mapId },
        animation: 'idle'
      });
      if (event) {
        setActiveEvent(event);
      } else {
        setActiveEvent(null);
      }
      return true;
    },
    []
  );

  const movePlayer = useCallback(
    (direction) => {
      const deltas = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 }
      };

      const delta = deltas[direction];
      if (!delta) {
        return { moved: false, reason: 'unknown-direction' };
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
        const targetMap = MAP_LOOKUP.get(portal.targetMap);
        if (targetMap) {
          const travelEvent = {
            type: 'travel',
            title: targetMap.name,
            description: portal.description ?? 'Te desplazas a otra sección de la nave.'
          };

          switchMap(portal.targetMap, {
            position: portal.targetPosition,
            event: travelEvent
          });
          return { moved: true, reason: 'map-changed', mapId: portal.targetMap };
        }
      }

      setPlayerPosition(nextPosition);
      setActiveEvent(null);
      updateLocalPlayerState({
        position: { ...nextPosition, z: 0 },
        metadata: { mapId: currentMapId },
        animation: 'walk'
      });
      return { moved: true, reason: 'moved', mapId: currentMapId };
    },
    [canMoveTo, currentMapId, findPortalAt, playerPosition, switchMap, updateLocalPlayerState]
  );

  const applyMissionUpdates = useCallback(
    (updates = [], context = {}) => {
      if (!Array.isArray(updates) || updates.length === 0) {
        return { applied: false, updates: [] };
      }

      const resolvedMapId = context.mapId ?? currentMapId;
      let mutated = false;

      setMissionStates((previous) => {
        const nextState = applyMissionUpdatesToState(previous, updates, resolvedMapId);
        mutated = nextState !== previous;
        return nextState;
      });

      if (mutated) {
        const timestamp = Date.now();
        setMissionLog((previousLog) => {
          const nextEntries = updates
            .filter((update) => update?.missionId)
            .map((update, index) => {
              const entryMapId = update.mapId ?? resolvedMapId;
              const mapDefinition = MAP_LOOKUP.get(entryMapId);
              const missionDefinition = mapDefinition?.missions?.find(
                (mission) => mission.id === update.missionId
              );

              return {
                id: `${entryMapId}-${update.missionId}-${timestamp}-${index}`,
                timestamp,
                mapId: entryMapId,
                mapName: mapDefinition?.name ?? entryMapId,
                missionId: update.missionId,
                missionTitle: missionDefinition?.title ?? update.missionId,
                status: update.status,
                message: update.log ?? ''
              };
            });

          if (!nextEntries.length) {
            return previousLog;
          }

          const merged = [...nextEntries, ...previousLog];
          return merged.slice(0, MAX_LOG_ENTRIES);
        });
      }

      return { applied: mutated, updates };
    },
    [currentMapId]
  );

  const updateMissionStatus = useCallback(
    (missionId, status, mapId = currentMapId) => {
      if (!missionId || typeof status !== 'string') {
        return { applied: false, updates: [] };
      }

      return applyMissionUpdates([
        {
          mapId,
          missionId,
          status
        }
      ]);
    },
    [applyMissionUpdates, currentMapId]
  );

  const interact = useCallback(() => {
    const object = findObjectAt(playerPosition);
    if (!object?.interaction) {
      setActiveEvent(null);
      return null;
    }

    const event = {
      ...object.interaction,
      objectId: object.id,
      objectName: object.name,
      mapId: currentMapId
    };

    if (Array.isArray(object.interaction.missionUpdates)) {
      const result = applyMissionUpdates(object.interaction.missionUpdates);
      event.missionUpdates = object.interaction.missionUpdates;
      event.missionsChanged = result.applied;
    }

    setActiveEvent(event);
    return event;
  }, [applyMissionUpdates, currentMapId, findObjectAt, playerPosition]);

  const clearEvent = useCallback(() => setActiveEvent(null), []);

  const value = useMemo(
    () => ({
      maps: availableMaps,
      currentMap,
      currentMapId,
      playerPosition,
      canMoveTo,
      movePlayer,
      interact,
      activeEvent,
      switchMap,
      clearEvent,
      missions,
      missionStates,
      updateMissionStatus,
      missionLog,
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
      missionLog,
      missionStates,
      missions,
      movePlayer,
      playerPosition,
      switchMap,
      updateMissionStatus
    ]
  );

  useEffect(() => {
    updateLocalPlayerState({
      position: { ...playerPosition, z: 0 },
      metadata: { mapId: currentMapId }
    });
  }, [currentMapId, playerPosition, updateLocalPlayerState]);

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMap() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap debe utilizarse dentro de un MapProvider.');
  }
  return context;
}
