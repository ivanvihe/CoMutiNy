import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import MapViewport from '../MapViewport.jsx';
import ChatPanel from '../Chat/ChatPanel.jsx';
import SettingsModal from '../SettingsModal.tsx';
import { useWorld } from '../../context/WorldContext.jsx';
import phaserConfig from '../../phaser/config.js';
import '../../styles/game.css';

export default function GameView() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const gameContainerRef = useRef(null);
  const gameRef = useRef(null);
  const { connected, connectionStatus } = useWorld();

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
      parent: container
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

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

  return (
    <div className="game-view">
      <div className="game-view__map">
        <div id="game-container" ref={gameContainerRef} />
        <MapViewport onOpenSettings={handleOpenSettings} />
      </div>
      <aside className="game-view__chat">
        <ChatPanel />
      </aside>
      <SettingsModal open={settingsOpen} onClose={handleCloseSettings} />
    </div>
  );
}
