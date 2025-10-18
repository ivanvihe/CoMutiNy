export function bootstrapMultiplayer(statusSelector: string): void {
  const status = document.querySelector(statusSelector);
  if (!(status instanceof HTMLElement)) {
    throw new Error('No se encontró el contenedor de estado.');
  }

  status.innerHTML = `
    <p>
      Cliente Colyseus pendiente de implementar. Esta área mostrará el estado de la
      conexión.
    </p>
  `;
}
