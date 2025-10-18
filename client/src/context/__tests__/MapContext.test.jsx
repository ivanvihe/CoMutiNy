import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { MapProvider, useMap } from '../MapContext.jsx';

jest.mock('../../game/maps.js', () => ({
  MAPS: [
    {
      id: 'mapa-prueba',
      name: 'Mapa de prueba',
      biome: 'Colaborativo',
      description: 'Espacio ficticio para pruebas automatizadas.',
      size: { width: 28, height: 28 },
      spawn: { x: 14, y: 14 },
      blockedAreas: [
        { x: 0, y: 0, width: 28, height: 1 },
        { x: 0, y: 27, width: 28, height: 1 },
        { x: 0, y: 0, width: 1, height: 28 },
        { x: 27, y: 0, width: 1, height: 28 }
      ],
      objects: [],
      portals: []
    }
  ],
  DEFAULT_MAP_ID: 'mapa-prueba',
  resolveDefaultMapId: jest.fn(() => 'mapa-prueba'),
  fetchServerMaps: jest.fn(() =>
    Promise.resolve({ maps: [], objectDefinitions: [], canvasDefinitions: [] })
  )
}));

jest.mock('../../api/objects.js', () => ({
  fetchObjectDefinitions: jest.fn(() => Promise.resolve([]))
}));

jest.mock('../../game/objects/definitions.js', () => ({
  listObjectDefinitions: jest.fn(() => []),
  registerObjectDefinitions: jest.fn()
}));

jest.mock('../WorldContext.jsx', () => ({
  useWorld: () => ({
    updateLocalPlayerState: jest.fn(),
    players: [],
    localPlayerId: 'local',
    connectionStatus: 'connected',
    interactWithObject: jest.fn(() => Promise.resolve({ ok: true, event: null }))
  })
}));

describe('MapContext', () => {
  const wrapper = ({ children }) => <MapProvider>{children}</MapProvider>;

  it('normaliza los mapas iniciales con tiles bloqueados', () => {
    const { result } = renderHook(() => useMap(), { wrapper });

    expect(result.current.currentMap).toBeTruthy();
    expect(result.current.currentMap.blockedTiles).toBeInstanceOf(Set);
    expect(result.current.currentMap.blockedTiles.size).toBeGreaterThan(0);
  });

  it('mantiene al jugador en el mapa compartido incluso al solicitar otro', () => {
    const { result } = renderHook(() => useMap(), { wrapper });

    const initialMapId = result.current.currentMapId;

    act(() => {
      result.current.switchMap('otro-mapa');
    });

    expect(result.current.currentMapId).toBe(initialMapId);
    expect(result.current.playerPosition).toEqual(result.current.currentMap.spawn);
  });

  it('limpia eventos cuando no hay objetos interactuables', async () => {
    const { result } = renderHook(() => useMap(), { wrapper });

    expect(result.current.objectAtPlayerPosition).toBeUndefined();

    let event;
    await act(async () => {
      event = await result.current.interact();
    });

    expect(event).toBeNull();
    expect(result.current.activeEvent).toBeNull();
  });

  it('detecta colisiones sin depender de indicadores visuales de celdas', () => {
    const { result } = renderHook(() => useMap(), { wrapper });

    expect(result.current.canMoveTo({ x: 14, y: 14 })).toBe(true);
    expect(result.current.canMoveTo({ x: 0, y: 0 })).toBe(false);
  });
});
