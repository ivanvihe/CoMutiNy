import {
  applyMissionUpdatesToState,
  createInitialMissionState,
  DEFAULT_MISSION_STATUS
} from '../mapMissions.js';

describe('MapContext mission helpers', () => {
  it('crea el estado inicial de misiones con valores por defecto', () => {
    const maps = [
      {
        id: 'demo',
        missions: [
          { id: 'a', status: 'completed' },
          { id: 'b' }
        ]
      }
    ];

    const initialState = createInitialMissionState(maps);

    expect(initialState.demo.a).toBe('completed');
    expect(initialState.demo.b).toBe(DEFAULT_MISSION_STATUS);
  });

  it('actualiza estados de misión sin mutar el estado original', () => {
    const initial = {
      bridge: {
        alpha: 'available'
      }
    };

    const updates = [
      { mapId: 'bridge', missionId: 'alpha', status: 'completed', log: 'Listo' },
      { missionId: 'beta', status: 'in-progress' }
    ];

    const next = applyMissionUpdatesToState(initial, updates, 'bridge');

    expect(next).not.toBe(initial);
    expect(next.bridge.alpha).toBe('completed');
    expect(next.bridge.beta).toBe('in-progress');
    expect(initial.bridge.alpha).toBe('available');
  });

  it('devuelve el mismo objeto cuando no hay cambios', () => {
    const initial = {
      bridge: {
        alpha: 'completed'
      }
    };

    const updates = [{ mapId: 'bridge', missionId: 'alpha', status: 'completed' }];

    const next = applyMissionUpdatesToState(initial, updates, 'bridge');

    expect(next).toBe(initial);
  });
});
