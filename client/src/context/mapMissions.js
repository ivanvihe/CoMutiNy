export const DEFAULT_MISSION_STATUS = 'available';

export const createInitialMissionState = (maps = []) => {
  if (!Array.isArray(maps)) {
    return {};
  }

  return maps.reduce((acc, map) => {
    if (!map?.id || !Array.isArray(map.missions) || map.missions.length === 0) {
      return acc;
    }

    acc[map.id] = map.missions.reduce((missionAcc, mission) => {
      if (!mission?.id) {
        return missionAcc;
      }

      missionAcc[mission.id] = mission.status ?? DEFAULT_MISSION_STATUS;
      return missionAcc;
    }, {});

    return acc;
  }, {});
};

export const applyMissionUpdatesToState = (state, updates = [], fallbackMapId) => {
  if (!Array.isArray(updates) || updates.length === 0) {
    return state;
  }

  const nextState = { ...state };
  let mutated = false;

  updates.forEach((update) => {
    if (!update || typeof update !== 'object') {
      return;
    }

    const mapId = update.mapId ?? fallbackMapId;
    const missionId = update.missionId;
    const status = update.status;

    if (!mapId || !missionId || typeof status !== 'string') {
      return;
    }

    const currentMapState = nextState[mapId] ?? state[mapId] ?? {};
    const existingStatus = currentMapState[missionId];

    if (existingStatus === status) {
      if (!nextState[mapId]) {
        nextState[mapId] = { ...currentMapState };
      }
      return;
    }

    const mapStateClone = { ...currentMapState, [missionId]: status };
    nextState[mapId] = mapStateClone;
    mutated = true;
  });

  return mutated ? nextState : state;
};
