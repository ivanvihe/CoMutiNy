import { initializeEngine } from './engine';
import { bootstrapMultiplayer } from './multiplayer';
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

  registerUi(app);
  bootstrapMultiplayer('#status');

  const bootstrap = async () => {
    const engine = await initializeEngine('#world');
    const terrainParameters = await fetchTerrainParameters();
    await generateWorld(engine.scene, engine.camera.position, {
      terrainParameters,
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
