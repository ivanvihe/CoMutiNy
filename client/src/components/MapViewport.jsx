import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMap } from '../context/MapContext.jsx';
import { useWorld } from '../context/WorldContext.jsx';
import IsometricEngine from '../game/isometricEngine.js';

const CONNECTION_LABELS = {
  idle: 'Desconectado',
  connecting: 'Conectando…',
  connected: 'Conectado',
  disconnected: 'Desconectado',
  error: 'Con errores',
  terminated: 'Sesión terminada'
};

const KEY_BLOCKLIST = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export default function MapViewport() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const {
    maps = [],
    currentMap,
    currentMapId,
    playerRenderPosition,
    playerDirection,
    playerIsMoving,
    movePlayer,
    interact,
    activeEvent,
    clearEvent,
    objectAtPlayerPosition,
    switchMap
  } = useMap();
  const { players: worldPlayers, localPlayerId, connectionStatus, profile } = useWorld();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const engine = new IsometricEngine(canvas, {
      tileset: { tileWidth: 64, tileHeight: 32 },
      sprites: {
        frameWidth: 48,
        frameHeight: 64,
        framesPerDirection: 4,
        directions: { down: 0, left: 1, right: 2, up: 3 },
        animationSpeed: 120
      }
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const remotePlayers = useMemo(() => {
    return worldPlayers
      .filter((player) => player.id && player.id !== localPlayerId)
      .map((player) => ({
        id: player.id,
        name: player.alias ?? player.metadata?.alias ?? player.name ?? 'Tripulante',
        position: player.renderPosition ?? player.position ?? { x: 0, y: 0 },
        direction: player.direction ?? player.metadata?.heading ?? 'down',
        animation: player.animation ?? 'idle',
        avatar: player.metadata?.avatar ?? null,
        sprite: player.sprite ?? player.metadata?.avatar?.sprite ?? null
      }));
  }, [localPlayerId, worldPlayers]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    if (!currentMap) {
      engine.setScene({ map: null });
      return;
    }

    const localPlayer = {
      id: localPlayerId ?? 'local-player',
      name: profile?.alias ?? 'Tú',
      position: playerRenderPosition ?? currentMap.spawn ?? { x: 0, y: 0 },
      direction: playerDirection ?? 'down',
      animation: playerIsMoving ? 'walk' : 'idle'
    };

    engine.setScene({
      map: currentMap,
      player: localPlayer,
      remotePlayers
    });
  }, [
    currentMap,
    localPlayerId,
    playerDirection,
    playerIsMoving,
    playerRenderPosition,
    remotePlayers,
    profile?.alias
  ]);

  const cycleMap = useCallback(
    (step) => {
      if (!maps.length) {
        return;
      }
      const index = maps.findIndex((map) => map?.id === currentMapId);
      const nextIndex = index >= 0 ? (index + step + maps.length) % maps.length : 0;
      const nextMap = maps[nextIndex];
      if (nextMap?.id) {
        switchMap(nextMap.id);
      }
    },
    [currentMapId, maps, switchMap]
  );

  const handlePrevMap = useCallback(() => cycleMap(-1), [cycleMap]);
  const handleNextMap = useCallback(() => cycleMap(1), [cycleMap]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) {
        return;
      }
      const target = event.target;
      if (target && target.nodeType === 1) {
        const tagName = target.tagName?.toUpperCase();
        if (tagName && (KEY_BLOCKLIST.has(tagName) || target.isContentEditable)) {
          return;
        }
      }

      const key = event.key?.toLowerCase();
      if (!key) {
        return;
      }

      const prevent = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      if (key === 'arrowup' || key === 'w') {
        prevent();
        movePlayer('up');
      } else if (key === 'arrowdown' || key === 's') {
        prevent();
        movePlayer('down');
      } else if (key === 'arrowleft' || key === 'a') {
        prevent();
        movePlayer('left');
      } else if (key === 'arrowright' || key === 'd') {
        prevent();
        movePlayer('right');
      } else if (key === 'e' || key === 'enter' || key === ' ') {
        prevent();
        interact();
      } else if (key === 'q') {
        prevent();
        handlePrevMap();
      } else if (key === 'r') {
        prevent();
        handleNextMap();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextMap, handlePrevMap, interact, movePlayer]);

  const mapIndex = useMemo(
    () => maps.findIndex((map) => map?.id === currentMapId),
    [maps, currentMapId]
  );

  const interactLabel = objectAtPlayerPosition?.name
    ? `Interactuar con ${objectAtPlayerPosition.name}`
    : 'Interactuar';

  const remoteCount = remotePlayers.length;
  const totalCrew = remoteCount + (currentMap ? 1 : 0);
  const statusLabel = CONNECTION_LABELS[connectionStatus] ?? connectionStatus;

  return (
    <div className="map-viewport">
      <canvas ref={canvasRef} className="map-viewport__canvas" />

      {currentMap && (
        <div className="viewport-overlay viewport-overlay--top-left">
          <div className="hud-card">
            <div className="hud-card__title">{currentMap.name}</div>
            <p className="hud-card__subtitle">{currentMap.description}</p>
            <div className="hud-meta">
              <span>Bioma: {currentMap.biome}</span>
              <span>Tripulantes: {totalCrew}</span>
            </div>
          </div>
        </div>
      )}

      <div className="viewport-overlay viewport-overlay--top-right">
        <div className={`hud-chip hud-chip--${connectionStatus}`}>{statusLabel}</div>
      </div>

      <div className="viewport-overlay viewport-overlay--bottom-left">
        <div className="hud-card">
          <div className="hud-card__title">Controles</div>
          <p className="hud-card__subtitle">WASD / flechas para moverte · E para interactuar</p>
          <div className="hud-actions">
            <button type="button" className="hud-button" onClick={handlePrevMap}>
              ◀
            </button>
            <span className="hud-actions__label">
              Mapa {mapIndex >= 0 ? mapIndex + 1 : 1} de {maps.length || 1}
            </span>
            <button type="button" className="hud-button" onClick={handleNextMap}>
              ▶
            </button>
          </div>
        </div>
      </div>

      {objectAtPlayerPosition?.interaction && (
        <div className="viewport-overlay viewport-overlay--bottom-right">
          <button type="button" className="hud-button hud-button--primary" onClick={interact}>
            {interactLabel} (E)
          </button>
        </div>
      )}

      {activeEvent && (
        <div className="viewport-overlay viewport-overlay--center">
          <div className="hud-card hud-card--event">
            <div className="hud-card__title">{activeEvent.title}</div>
            <p className="hud-card__subtitle">{activeEvent.description}</p>
            <div className="hud-actions hud-actions--end">
              <button type="button" className="hud-button" onClick={clearEvent}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
