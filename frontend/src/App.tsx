import { useEffect } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import './App.css';

function App() {
  useEffect(() => {
    const game = new Phaser.Game(createGameConfig());
    return () => {
      game.destroy(true);
    };
  }, []);

  return (
    <div className="App">
      <div id="game-container" className="game-container" />
    </div>
  );
}

export default App;
