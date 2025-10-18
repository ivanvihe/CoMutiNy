import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from '../context/MapContext.jsx';
import { useWorld } from '../context/WorldContext.jsx';
import IsometricEngine from '../game/isometricEngine.js';
import { normaliseCharacterAppearance } from '../game/characters/customization.js';
import { ensureCharacterTexture } from '../game/characters/textureLoader.js';
import Topbar from '../layout/Topbar.tsx';
import {
  clampZoom,
  resolveZoomPreference,
  subscribeToUserPreferences,
  updateUserPreferences
} from '../state/userPreferences.js';

const CONNECTION_LABELS = {
  idle: 'Desconectado',
  connecting: 'Conectando…',
  connected: 'Conectado',
  disconnected: 'Desconectado',
  error: 'Con errores',
  terminated: 'Sesión terminada'
};

const KEY_BLOCKLIST = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 1;

export default function MapViewport({ onOpenSettings } = {}) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [zoom, setZoom] = useState(() => resolveZoomPreference({ min: MIN_ZOOM, max: MAX_ZOOM }));

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
  const {
    players: worldPlayers,
    localPlayerId,
    connectionStatus,
    profile,
    chatMessages,
    appearance: localAppearance
  } = useWorld();

  const sceneMap = useMemo(() => {
    if (!currentMap) {
      return null;
    }

    const layers = Array.isArray(currentMap.layers) ? currentMap.layers : [];
    const objectLayers = Array.isArray(currentMap.objectLayers) ? currentMap.objectLayers : [];

    return {
      ...currentMap,
      layers,
      objectLayers
    };
  }, [currentMap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const engine = new IsometricEngine(canvas, {
      tileset: { tileWidth: 64, tileHeight: 64 },
      sprites: {
        frameWidth: 48,
        frameHeight: 64,
        framesPerDirection: 4,
        directions: { down: 0, left: 1, right: 2, up: 3 },
        animationSpeed: 120
      },
      zoom
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setZoom(zoom);
    }
  }, [zoom]);

  useEffect(() => {
    updateUserPreferences({ mapZoom: zoom });
  }, [zoom]);

  useEffect(() => {
    const unsubscribe = subscribeToUserPreferences((preferences) => {
      const nextZoom = clampZoom(preferences?.mapZoom ?? DEFAULT_ZOOM, { min: MIN_ZOOM, max: MAX_ZOOM });
      setZoom((current) => {
        if (Math.abs(current - nextZoom) < 0.0001) {
          return current;
        }
        return nextZoom;
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const remotePlayers = useMemo(() => {
    return worldPlayers
      .filter((player) => player.id && player.id !== localPlayerId)
      .map((player) => {
        const appearance = normaliseCharacterAppearance(
          player.metadata?.appearance ?? player.metadata?.avatar ?? player.avatar ?? null
        );
        if (appearance?.texture) {
          ensureCharacterTexture(appearance.texture);
        }
        return {
          id: player.id,
          name: player.alias ?? player.metadata?.alias ?? player.name ?? 'Usuario',
          position: player.renderPosition ?? player.position ?? { x: 0, y: 0 },
          direction: player.direction ?? player.metadata?.heading ?? 'down',
          animation: player.animation ?? 'idle',
          appearance,
          avatar: player.metadata?.avatar ?? null,
          sprite: player.sprite ?? player.metadata?.avatar?.sprite ?? null
        };
      });
  }, [localPlayerId, worldPlayers]);

  const chatBubbles = useMemo(() => {
    if (!Array.isArray(chatMessages)) {
      return [];
    }

    const latestByPlayer = new Map();

    chatMessages.forEach((message) => {
      const playerId = typeof message?.playerId === 'string' ? message.playerId.trim() : '';
      const content = typeof message?.content === 'string' ? message.content.trim() : '';
      if (!playerId || !content) {
        return;
      }

      const receivedAt =
        typeof message?.receivedAt === 'number' && Number.isFinite(message.receivedAt)
          ? message.receivedAt
          : typeof message?.occurredAt === 'number' && Number.isFinite(message.occurredAt)
            ? message.occurredAt
            : null;

      if (receivedAt === null) {
        return;
      }

      const existing = latestByPlayer.get(playerId);
      if (!existing || receivedAt > existing.receivedAt) {
        latestByPlayer.set(playerId, { playerId, content, receivedAt });
      }
    });

    return Array.from(latestByPlayer.values());
  }, [chatMessages]);

  const layerDiagnostics = useMemo(() => {
    const tileLayers = Array.isArray(currentMap?.layers) ? currentMap.layers : [];
    const overlayCount = tileLayers.filter((layer) => {
      const placement = (layer?.placement ?? layer?.mode ?? '').toString().toLowerCase();
      return placement === 'overlay';
    }).length;
    const solidCount = Array.isArray(currentMap?.objects)
      ? currentMap.objects.filter((object) => object?.solid).length
      : 0;
    const maxVolumeHeight = Array.isArray(currentMap?.objects)
      ? currentMap.objects.reduce((max, object) => {
          const height = Number.parseFloat(object?.volume?.height);
          return Number.isFinite(height) ? Math.max(max, height) : max;
        }, 0)
      : 0;

    return {
      totalLayers: tileLayers.length,
      overlayLayers: overlayCount,
      solidObjects: solidCount,
      maxVolumeHeight: Number.isFinite(maxVolumeHeight) ? maxVolumeHeight : 0
    };
  }, [currentMap]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    if (!sceneMap) {
      engine.setScene({ map: null });
      return;
    }

    const appearance = normaliseCharacterAppearance(localAppearance);
    if (appearance?.texture) {
      ensureCharacterTexture(appearance.texture);
    }

    const localPlayer = {
      id: localPlayerId ?? 'local-player',
      name: profile?.alias ?? 'Tú',
      position: playerRenderPosition ?? currentMap.spawn ?? { x: 0, y: 0 },
      direction: playerDirection ?? 'down',
      animation: playerIsMoving ? 'walk' : 'idle',
      appearance
    };

    engine.setScene({
      map: sceneMap,
      player: localPlayer,
      remotePlayers,
      chatBubbles
    });
  }, [
    sceneMap,
    localPlayerId,
    localAppearance,
    playerDirection,
    playerIsMoving,
    playerRenderPosition,
    remotePlayers,
    profile?.alias,
    chatBubbles
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

  const normaliseZoom = useCallback((value) => {
    const clamped = clampZoom(value, { min: MIN_ZOOM, max: MAX_ZOOM });
    return Math.round(clamped * 100) / 100;
  }, []);

  const setZoomValue = useCallback(
    (value) => {
      setZoom((current) => {
        const next = normaliseZoom(value);
        if (Math.abs(current - next) < 0.0001) {
          return current;
        }
        return next;
      });
    },
    [normaliseZoom]
  );

  const adjustZoom = useCallback(
    (delta) => {
      setZoom((current) => {
        const next = normaliseZoom(current + delta);
        if (Math.abs(current - next) < 0.0001) {
          return current;
        }
        return next;
      });
    },
    [normaliseZoom]
  );

  const handleZoomIn = useCallback(() => adjustZoom(ZOOM_STEP), [adjustZoom]);
  const handleZoomOut = useCallback(() => adjustZoom(-ZOOM_STEP), [adjustZoom]);
  const handleZoomReset = useCallback(() => setZoomValue(DEFAULT_ZOOM), [setZoomValue]);
  const handleZoomSlider = useCallback(
    (event) => {
      const value = Number.parseFloat(event?.target?.value);
      if (Number.isFinite(value)) {
        setZoomValue(value);
      }
    },
    [setZoomValue]
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.ctrlKey || event.metaKey) {
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
      } else if (key === '+' || key === '=' || key === 'add') {
        prevent();
        handleZoomIn();
      } else if (key === '-' || key === '_') {
        prevent();
        handleZoomOut();
      } else if (key === '0') {
        prevent();
        handleZoomReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextMap, handlePrevMap, handleZoomIn, handleZoomOut, handleZoomReset, interact, movePlayer]);

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
  const zoomPercentage = Math.round(zoom * 100);
  const safeMapIndex = mapIndex >= 0 ? mapIndex : 0;
  const mapCount = Math.max(maps.length, 1);
  const canNavigateMaps = maps.length > 1;
  const controlsHint = 'WASD o flechas · E para interactuar';

  return (
    <div className="map-viewport">
      <canvas
        ref={canvasRef}
        className="map-viewport__canvas"
        data-layer-count={layerDiagnostics.totalLayers}
        data-overlay-count={layerDiagnostics.overlayLayers}
        data-solid-count={layerDiagnostics.solidObjects}
        data-max-volume-height={layerDiagnostics.maxVolumeHeight.toFixed(2)}
      />

      <Topbar
        alias={profile?.alias ?? null}
        connectionStatus={connectionStatus}
        connectionLabel={statusLabel}
        mapName={currentMap?.name ?? null}
        mapDescription={currentMap?.description ?? null}
        biome={currentMap?.biome ?? null}
        totalCrew={totalCrew}
        mapIndex={safeMapIndex}
        mapCount={mapCount}
        canNavigateMaps={canNavigateMaps}
        onPrevMap={handlePrevMap}
        onNextMap={handleNextMap}
        onOpenSettings={onOpenSettings}
        controlsHint={controlsHint}
        zoom={zoom}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        step={ZOOM_STEP}
        onZoomChange={handleZoomSlider}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        zoomPercentage={zoomPercentage}
      />

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
