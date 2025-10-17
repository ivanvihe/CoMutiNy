jest.mock('../../maps.js', () => ({
  MAPS: [],
  fetchServerMaps: jest
    .fn()
    .mockResolvedValue({ maps: [], objectDefinitions: [], canvasDefinitions: [] }),
  resolveDefaultMapId: () => null
}));

import { GameStateManager } from '../index.js';

const buildMap = (id) => ({
  id,
  name: `Map ${id}`,
  biome: 'Test',
  description: '',
  size: { width: 10, height: 10 },
  spawn: { x: 1, y: 1 },
  blockedAreas: [],
  objects: [],
  doors: [],
  portals: [],
  theme: { borderColour: null },
  sourcePath: `${id}.map`
});

describe('GameStateManager', () => {
  test('notifies subscribers when the current map changes', async () => {
    const initialMap = buildMap('alpha');
    const manager = new GameStateManager({ maps: [initialMap] });
    const listener = jest.fn();

    manager.subscribe(listener);
    await manager.handleMapChange({ mapId: 'alpha' });

    expect(listener).toHaveBeenCalled();
    const lastCall = listener.mock.calls[listener.mock.calls.length - 1]?.[0];
    expect(lastCall.mapId).toBe('alpha');
    expect(lastCall.map).toEqual(initialMap);
  });

  test('fetches remote map definitions when an unknown map is requested', async () => {
    const remoteMap = buildMap('remote');
    const fetchMaps = jest
      .fn()
      .mockResolvedValue({ maps: [remoteMap], objectDefinitions: [], canvasDefinitions: [] });
    const manager = new GameStateManager({ maps: [], fetchMaps });

    const result = await manager.handleMapChange({ mapId: 'remote' });

    expect(fetchMaps).toHaveBeenCalled();
    expect(result).toEqual(remoteMap);
    expect(manager.currentMapId).toBe('remote');
    expect(manager.currentMap).toEqual(remoteMap);
  });
});
