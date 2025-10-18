export function registerUi(root: HTMLElement): void {
  const chat = document.createElement('section');
  chat.id = 'chat';
  chat.innerHTML = `
    <h2>Chat</h2>
    <p>La interfaz colaborativa se implementará próximamente.</p>
  `;

  const inventory = document.createElement('section');
  inventory.id = 'inventory';
  inventory.innerHTML = `
    <h2>Inventario</h2>
    <p>Placeholder para la hotbar de bloques.</p>
  `;

  root.append(chat, inventory);
}
