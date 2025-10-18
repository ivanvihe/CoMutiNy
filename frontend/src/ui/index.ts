import type { ChatMessageEvent, MultiplayerClient } from '../multiplayer';

export function registerUi(
  root: HTMLElement,
  multiplayer?: MultiplayerClient,
): void {
  const chat = document.createElement('section');
  chat.id = 'chat';
  chat.innerHTML = `
    <h2>Chat</h2>
    <div class="chat-log" aria-live="polite"></div>
    <form class="chat-form">
      <label>
        <span class="sr-only">Mensaje</span>
        <input type="text" name="message" autocomplete="off" placeholder="Escribe un mensaje" />
      </label>
      <button type="submit">Enviar</button>
    </form>
  `;

  const chatLog = chat.querySelector('.chat-log');
  const chatForm = chat.querySelector<HTMLFormElement>('.chat-form');
  const chatInput = chatForm?.querySelector<HTMLInputElement>('input[name="message"]');
  const chatButton = chatForm?.querySelector<HTMLButtonElement>('button');

  if (!(chatLog instanceof HTMLElement) || !chatForm || !chatInput || !chatButton) {
    throw new Error('No se pudo inicializar la interfaz de chat.');
  }

  chatInput.disabled = true;
  chatButton.disabled = true;

  const appendMessage = (message: ChatMessageEvent) => {
    const entry = document.createElement('p');
    entry.className = `chat-entry chat-entry--${message.type}`;
    const time = new Date(message.timestamp);
    const timeLabel = time.toLocaleTimeString();
    entry.innerHTML = `
      <time datetime="${time.toISOString()}">${timeLabel}</time>
      <span class="chat-author">${escapeHtml(message.authorName)}</span>:
      <span class="chat-message">${escapeHtml(message.message)}</span>
    `;
    chatLog.append(entry);
    chatLog.scrollTop = chatLog.scrollHeight;
  };

  const appendSystemMessage = (content: string) => {
    const now = Date.now();
    appendMessage({
      id: `${now}`,
      authorId: 'system',
      authorName: 'Sistema',
      message: content,
      timestamp: now,
      type: 'system',
    });
  };

  if (multiplayer) {
    appendSystemMessage('Conectando al servidor...');

    const handleChat = (event: Event) => {
      const detail = (event as CustomEvent<ChatMessageEvent>).detail;
      appendMessage(detail);
    };

    multiplayer.addEventListener('chat', handleChat);
    multiplayer.addEventListener('connected', () => {
      chatInput.disabled = false;
      chatButton.disabled = false;
      appendSystemMessage('Conectado al servidor.');
    });

    multiplayer.addEventListener('disconnected', () => {
      chatInput.disabled = true;
      chatButton.disabled = true;
      appendSystemMessage('Desconectado del servidor.');
    });

    multiplayer.addEventListener('connection-error', () => {
      appendSystemMessage('Error al conectar con el servidor.');
    });

    chatForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const message = chatInput.value.trim();
      if (message.length === 0) {
        return;
      }
      multiplayer.sendChatMessage(message);
      chatInput.value = '';
    });
  } else {
    appendSystemMessage('El módulo multijugador no está disponible.');
  }

  const inventory = document.createElement('section');
  inventory.id = 'inventory';
  inventory.innerHTML = `
    <h2>Inventario</h2>
    <p>Placeholder para la hotbar de bloques.</p>
  `;

  root.append(chat, inventory);
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
