import { initializeEngine } from './engine';
import { bootstrapMultiplayer } from './multiplayer';
import { createClockSynchronizer } from './multiplayer/timeSync';
import { registerUi } from './ui';
import { fetchTerrainParameters, generateWorld } from './voxel';
import { GameController } from './game';

document.addEventListener('DOMContentLoaded', () => {
  const app = document.querySelector('#app');
  if (!(app instanceof HTMLElement)) {
    throw new Error('No se encontró el contenedor principal.');
  }

  app.innerHTML = `
    <main class="game-shell">
      <section id="world" class="game-shell__world" aria-label="Mundo"></section>
      <section
        id="status"
        class="game-shell__status sr-only"
        aria-live="polite"
        aria-atomic="true"
      ></section>
      <div id="ui-overlay" class="game-shell__overlay" aria-hidden="true"></div>
    </main>
  `;

  const multiplayer = bootstrapMultiplayer('#status', { autoConnect: false });
  registerUi(app, { multiplayer });

  const bootstrap = async () => {
    const engine = await initializeEngine('#world');
    const clock = await createClockSynchronizer();
    clock.start();
    engine.environment.setTimeProvider(clock.getCurrentTime);
    const originalDispose = engine.dispose;
    let game: GameController | null = null;
    engine.dispose = () => {
      clock.dispose();
      game?.dispose();
      originalDispose();
    };

    const terrainParameters = await fetchTerrainParameters();
    const world = await generateWorld(engine.scene, engine.camera.position, {
      terrainParameters,
      shadowGenerators: [
        engine.environment.sunShadow,
        engine.environment.moonShadow,
      ],
    });

    game = new GameController(engine, world, multiplayer);
    registerUi(app, { multiplayer, game });
  };

  bootstrap().catch((error) => {
    console.error('Error al inicializar el mundo de vóxeles:', error);
    const status = document.querySelector('#status');
    if (status instanceof HTMLElement) {
      status.innerHTML = `<p class="error">No se pudo cargar el mundo.</p>`;
    }
  });
});
