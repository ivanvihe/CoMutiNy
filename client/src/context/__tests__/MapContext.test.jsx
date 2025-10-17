import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { MapProvider, useMap } from '../MapContext.jsx';

jest.mock('../WorldContext.jsx', () => ({
  useWorld: () => ({
    updateLocalPlayerState: jest.fn(),
    players: [],
    localPlayerId: 'local',
    connectionStatus: 'connected'
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

  it('permite cambiar de mapa y restablecer la posición de aparición', () => {
    const { result } = renderHook(() => useMap(), { wrapper });

    const initialMapId = result.current.currentMapId;

    act(() => {
      result.current.switchMap('hydroponics');
    });

    expect(result.current.currentMapId).toBe('hydroponics');
    expect(result.current.playerPosition).toEqual(result.current.currentMap.spawn);
    expect(result.current.currentMapId).not.toBe(initialMapId);
  });

  it('crea un evento al interactuar con un objeto cercano', () => {
    const { result } = renderHook(() => useMap(), { wrapper });

    act(() => {
      result.current.switchMap('bridge', { position: { x: 3, y: 1 } });
    });

    expect(result.current.objectAtPlayerPosition?.id).toBe('nav-console');

    let event;
    act(() => {
      event = result.current.interact();
    });

    expect(event).toMatchObject({
      objectId: 'nav-console',
      objectName: 'Consola de navegación',
      mapId: 'bridge'
    });
    expect(result.current.activeEvent).toEqual(event);
  });
});
