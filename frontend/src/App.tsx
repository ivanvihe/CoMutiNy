import { useEffect, useState } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import type { BuildBlueprint, BuildCategory, BuildPlacementStatus } from './buildings/types';
import { BuildMenu } from './components/BuildMenu/BuildMenu';
import { BuildStatusPanel } from './components/BuildMenu/BuildStatusPanel';
import { emitBuildSelection, gameEvents, GameEvent } from './game/events';
import './App.css';

function App() {
  const [activeCategory, setActiveCategory] = useState<BuildCategory>('houses');
  const [selectedBlueprint, setSelectedBlueprint] = useState<BuildBlueprint | null>(null);
  const [status, setStatus] = useState<(BuildPlacementStatus & { timestamp: number }) | null>(null);

  useEffect(() => {
    const game = new Phaser.Game(createGameConfig());
    return () => {
      game.destroy(true);
    };
  }, []);

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
      setStatus({ status: 'pending', message: `Modo construcción: ${blueprint.name}` , timestamp: Date.now() });
    }
  };

  const handleDismissStatus = () => setStatus(null);

  return (
    <div className="App">
      <div id="game-container" className="game-container" />
      <BuildMenu
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        selectedBlueprint={selectedBlueprint}
        onSelectBlueprint={handleBlueprintSelect}
      />
      <BuildStatusPanel status={status} onDismiss={handleDismissStatus} />
    </div>
  );
}

export default App;
