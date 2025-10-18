import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import MapViewport from '../MapViewport.jsx';
import ChatPanel from '../Chat/ChatPanel.jsx';
import SettingsModal from '../SettingsModal.tsx';
import { useWorld } from '../../context/WorldContext.jsx';
import { useMap } from '../../context/MapContext.jsx';
import gameState from '../../game/state/index.js';
import phaserConfig from '../../phaser/config.js';
import PreloadScene from '../../phaser/scenes/PreloadScene.js';
import GameScene from '../../phaser/scenes/GameScene.js';
import '../../styles/game.css';

export default function GameView() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showMapViewport, setShowMapViewport] = useState(false);
  const gameContainerRef = useRef(null);
  const gameRef = useRef(null);
  const { connected, connectionStatus, players, localPlayerId, profile, getSocket } = useWorld();
  const { maps, currentMap } = useMap();
  const previousMapIdRef = useRef(null);
  const sceneInitializationRef = useRef({ socket: null, currentMap: null });

  const socket = typeof getSocket === 'function' ? getSocket() : null;
  sceneInitializationRef.current = {
    socket,
    currentMap: currentMap ?? null,
    maps: Array.isArray(maps) ? maps : [],
    players: Array.isArray(players) ? players : [],
    profile: profile ?? null
  };

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  useEffect(() => {
    const container = gameContainerRef.current;
    if (!container || typeof window === 'undefined') {
      return undefined;
    }

    const config = {
      ...phaserConfig,
      parent: container,
      scene: []
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    const initializationData = sceneInitializationRef.current ?? {};
    const scenes = [
      { key: 'GameScene', Scene: GameScene, autoStart: false },
      { key: 'PreloadScene', Scene: PreloadScene, autoStart: true }
    ];

    scenes.forEach(({ key, Scene, autoStart }) => {
      const instance = new Scene();
      game.scene.add(key, instance, autoStart, {
        socket: initializationData.socket ?? null,
        currentMap: initializationData.currentMap ?? null,
        maps: Array.isArray(initializationData.maps) ? initializationData.maps : [],
        players: Array.isArray(initializationData.players) ? initializationData.players : [],
        profile: initializationData.profile ?? null
      });
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) {
      return;
    }

    game.registry.set('socket:connected', connected);
    game.registry.set('socket:status', connectionStatus);
    game.events.emit('socket:connection-changed', {
      connected,
      status: connectionStatus
    });
  }, [connected, connectionStatus]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) {
      return;
    }

    const assignIfChanged = (key, value) => {
      if (game.registry.get(key) !== value) {
        game.registry.set(key, value);
      }
    };

    assignIfChanged('network:socket', socket);
    assignIfChanged('player:localId', localPlayerId ?? null);
    assignIfChanged('player:profile', profile ?? null);
    assignIfChanged('world:players', Array.isArray(players) ? players : []);
  }, [socket, localPlayerId, players, profile, connectionStatus, connected]);

  useEffect(() => {
    if (!Array.isArray(maps) || maps.length === 0) {
      return;
    }

    maps.forEach((map) => {
      if (map && typeof map === 'object') {
        gameState.registerMap(map);
      }
    });
  }, [maps]);

  useEffect(() => {
    const game = gameRef.current;
    if (game && game.registry.get('world:currentMap') !== (currentMap ?? null)) {
      game.registry.set('world:currentMap', currentMap ?? null);
    }

    const mapId = currentMap?.id ?? null;
    if (mapId === previousMapIdRef.current) {
      return;
    }

    previousMapIdRef.current = mapId;

    if (!currentMap) {
      return;
    }

    gameState.registerMap(currentMap);
    gameState.handleMapChange({ definition: currentMap }).catch(() => {});
  }, [currentMap]);

  return (
    <div className="game-view">
      <div className="game-view__map">
        <div id="game-container" ref={gameContainerRef} />
        {showMapViewport ? <MapViewport onOpenSettings={handleOpenSettings} /> : null}
        <div className="game-view__map-toggle">
          <button type="button" onClick={() => setShowMapViewport((value) => !value)}>
            {showMapViewport ? 'Ocultar HUD' : 'Mostrar HUD'}
          </button>
        </div>
      </div>
      <aside className="game-view__chat">
        <ChatPanel />
      </aside>
      <SettingsModal open={settingsOpen} onClose={handleCloseSettings} />
    </div>
  );
}
