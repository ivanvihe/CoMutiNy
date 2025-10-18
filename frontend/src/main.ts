import { initializeEngine } from './engine';
import { bootstrapMultiplayer } from './multiplayer';
import { registerUi } from './ui';
import { generateWorld } from './voxel';

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

  initializeEngine('#world');
  generateWorld();
  bootstrapMultiplayer('#status');
  registerUi(app);
});
