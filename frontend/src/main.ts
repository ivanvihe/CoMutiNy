import { initializeEngine } from './engine';
import { bootstrapMultiplayer } from './multiplayer';
import { createClockSynchronizer } from './multiplayer/timeSync';
import { registerUi } from './ui';
import { fetchTerrainParameters, generateWorld } from './voxel';

document.addEventListener('DOMContentLoaded', () => {
  const app = document.querySelector('#app');
  if (!(app instanceof HTMLElement)) {
    throw new Error('No se encontró el contenedor principal.');
  }

  app.innerHTML = `
    <main>
      <h1>CoMutiNy</h1>
      <section id="status"></section>
      <section id="world"></section>
    </main>
  `;

  const multiplayer = bootstrapMultiplayer('#status');
  registerUi(app, multiplayer);

  const bootstrap = async () => {
    const engine = await initializeEngine('#world');
    const clock = await createClockSynchronizer();
    clock.start();
    engine.environment.setTimeProvider(clock.getCurrentTime);
    const originalDispose = engine.dispose;
    engine.dispose = () => {
      clock.dispose();
      originalDispose();
    };

    const terrainParameters = await fetchTerrainParameters();
    await generateWorld(engine.scene, engine.camera.position, {
      terrainParameters,
      shadowGenerators: [
        engine.environment.sunShadow,
        engine.environment.moonShadow,
      ],
    });
  };

  bootstrap().catch((error) => {
    console.error('Error al inicializar el mundo de vóxeles:', error);
    const status = document.querySelector('#status');
    if (status instanceof HTMLElement) {
      status.innerHTML = `<p class="error">No se pudo cargar el mundo.</p>`;
    }
  });
});
