export function initializeEngine(containerSelector: string): void {
  const container = document.querySelector(containerSelector);
  if (!(container instanceof HTMLElement)) {
    throw new Error('No se encontró el contenedor del motor.');
  }

  container.innerHTML = `
    <p>
      Motor inicializado. Aquí se montará Babylon.js con soporte WebGPU en futuras
      iteraciones.
    </p>
  `;
}
