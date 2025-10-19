import { useEffect, useState } from 'react';
import Phaser from 'phaser';
import { AuthScreen } from './auth/AuthScreen';
import { loadSession, clearSession } from './auth/session';
import type { SessionData } from './auth/session';
import { createGameConfig } from './game/config';
import type { BuildBlueprint, BuildCategory, BuildPlacementStatus } from './buildings/types';
import { BuildMenu } from './components/BuildMenu/BuildMenu';
import { BuildStatusPanel } from './components/BuildMenu/BuildStatusPanel';
import { ChatOverlay } from './components/ChatOverlay/ChatOverlay';
import { emitBuildSelection, gameEvents, GameEvent } from './game/events';
import './App.css';

interface GameViewProps {
  session: SessionData;
  onLogout(): void;
}

const GameView = ({ session, onLogout }: GameViewProps) => {
  const [activeCategory, setActiveCategory] = useState<BuildCategory>('houses');
  const [selectedBlueprint, setSelectedBlueprint] = useState<BuildBlueprint | null>(null);
  const [status, setStatus] = useState<(BuildPlacementStatus & { timestamp: number }) | null>(null);

  useEffect(() => {
    const game = new Phaser.Game(createGameConfig());
    return () => {
      game.destroy(true);
    };
  }, [session.user.id]);

  useEffect(() => {
    const handlePlacementStatus = (payload: BuildPlacementStatus) => {
      setStatus({ ...payload, timestamp: Date.now() });
    };

    gameEvents.on(GameEvent.BuildPlacementResult, handlePlacementStatus);
    return () => {
      gameEvents.off(GameEvent.BuildPlacementResult, handlePlacementStatus);
    };
  }, []);

  useEffect(() => {
    emitBuildSelection(selectedBlueprint);
  }, [selectedBlueprint]);

  const handleBlueprintSelect = (blueprint: BuildBlueprint | null) => {
    setSelectedBlueprint(blueprint);
    if (blueprint) {
      setStatus({
        status: 'pending',
        message: `Modo construcción: ${blueprint.name}`,
        timestamp: Date.now(),
      });
    }
  };

  const handleDismissStatus = () => setStatus(null);

  return (
    <div className="App">
      <header className="app-header">
        <div className="app-user">
          <span className="app-user__greeting">Hola, {session.user.displayName}</span>
          <span className="app-user__email">{session.user.email}</span>
        </div>
        <button type="button" className="app-logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </header>
      <div id="game-container" className="game-container" />
      <BuildMenu
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        selectedBlueprint={selectedBlueprint}
        onSelectBlueprint={handleBlueprintSelect}
      />
      <BuildStatusPanel status={status} onDismiss={handleDismissStatus} />
      <ChatOverlay />
    </div>
  );
};

function App() {
  const [session, setSession] = useState<SessionData | null>(() => loadSession());

  const handleAuthenticated = (next: SessionData) => {
    setSession(next);
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  if (!session) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return <GameView session={session} onLogout={handleLogout} />;
}

export default App;
