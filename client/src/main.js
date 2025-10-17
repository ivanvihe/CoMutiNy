import { io } from 'https://cdn.socket.io/4.8.1/socket.io.esm.min.js';
import { CanvasEngine, Sprite, Animation, AnimationFrame } from './engine/index.js';
import { createIdleAnimation, createWalkAnimation } from './demo/characterFactory.js';

const canvas = document.getElementById('game-canvas');
const overlay = document.getElementById('chat-overlay');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatSubmit = document.getElementById('chat-submit');

const engine = new CanvasEngine(canvas, { clearColor: '#1f2231' });

engine.addLayer('background', { zIndex: 0 });
engine.addLayer('characters', { zIndex: 1 });
engine.addLayer('foreground', { zIndex: 2 });

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const resolveSocketUrl = () => {
  if (typeof window.CO_MUTINY_SOCKET_URL === 'string') {
    return window.CO_MUTINY_SOCKET_URL;
  }

  const protocol = window.location.protocol.startsWith('https') ? 'https' : 'http';
  const defaultHost = window.location.hostname || 'localhost';
  const host = window.CO_MUTINY_SOCKET_HOST || defaultHost;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
  const port = window.CO_MUTINY_SOCKET_PORT || (isLocal ? '4000' : window.location.port);

  return `${protocol}://${host}${port ? `:${port}` : ''}`;
};

const socket = io(resolveSocketUrl(), { autoConnect: false });

const createBackgroundSprite = (width, height) => {
  const buffer = document.createElement('canvas');
  buffer.width = width;
  buffer.height = height;
  const ctx = buffer.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#25334d');
  gradient.addColorStop(1, '#1a1f2e');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let i = 0; i < 80; i += 1) {
    const size = 2 + Math.random() * 2;
    const x = Math.random() * width;
    const y = Math.random() * height * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const frame = new AnimationFrame({ image: buffer, dw: width, dh: height });
  const animation = new Animation({ name: 'static', frames: [frame], frameDuration: 1000, loop: false });

  return new Sprite({
    x: 0,
    y: 0,
    anchor: { x: 0, y: 0 },
    animations: { static: animation },
    defaultAnimation: 'static'
  });
};

const background = createBackgroundSprite(canvas.width, canvas.height);
engine.addSpriteToLayer('background', background);

const players = new Map();
let localPlayerEntry = null;
let chatHistoryLoaded = false;
let pendingSync = false;
let lastSentState = null;

const getOrCreatePlayerId = () => {
  const storageKey = 'comutiny-player-id';
  const stored = window.localStorage?.getItem(storageKey);

  if (stored) {
    return stored;
  }

  const generated = `player-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  window.localStorage?.setItem(storageKey, generated);
  return generated;
};

const getOrCreatePlayerName = (playerId) => {
  const storageKey = 'comutiny-player-name';
  const stored = window.localStorage?.getItem(storageKey);

  if (stored) {
    return stored;
  }

  const generated = `Jugador ${playerId.slice(-4)}`;
  window.localStorage?.setItem(storageKey, generated);
  return generated;
};

const localPlayerId = getOrCreatePlayerId();
const localPlayerName = getOrCreatePlayerName(localPlayerId);

const createCharacterSprite = ({ position, animation } = {}) => {
  const sprite = new Sprite({
    x: position?.x ?? canvas.width / 2,
    y: position?.y ?? canvas.height - 32,
    scale: 2,
    animations: {
      idle: createIdleAnimation(),
      walk: createWalkAnimation()
    },
    defaultAnimation: animation ?? 'idle'
  });

  const originalUpdate = sprite.update.bind(sprite);
  sprite.update = (delta) => {
    originalUpdate(delta);

    const halfWidth = 16 * sprite.scale;
    sprite.position.x = clamp(sprite.position.x, halfWidth, canvas.width - halfWidth);
    sprite.position.y = clamp(sprite.position.y, 0, canvas.height);
  };

  return sprite;
};

const addChatMessageToPanel = ({ id, author, content }) => {
  if (!chatMessages) return;

  const container = document.createElement('div');
  container.className = 'chat-message';
  container.dataset.messageId = id;

  const authorEl = document.createElement('span');
  authorEl.className = 'chat-author';
  authorEl.textContent = author;

  const contentEl = document.createElement('span');
  contentEl.className = 'chat-content';
  contentEl.textContent = content;

  container.append(authorEl, contentEl);
  chatMessages.append(container);

  while (chatMessages.children.length > 100) {
    chatMessages.removeChild(chatMessages.firstChild);
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
};

const renderChatHistory = (messages = []) => {
  if (!chatMessages) return;
  chatMessages.textContent = '';
  messages.forEach((message) => addChatMessageToPanel(message));
};

const createChatBubble = () => {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  overlay?.appendChild(bubble);
  return bubble;
};

const ensurePlayer = (player, { isLocal = false, syncPosition = true } = {}) => {
  if (!player || typeof player.id !== 'string') {
    return null;
  }

  let entry = players.get(player.id);

  if (!entry) {
    const sprite = createCharacterSprite({ position: player.position, animation: player.animation });
    engine.addSpriteToLayer('characters', sprite);
    const bubble = createChatBubble();

    entry = {
      sprite,
      bubble,
      bubbleTimer: null,
      name: player.name ?? player.id,
      isLocal,
      hasSpawned: false
    };

    players.set(player.id, entry);
  }

  entry.name = player.name ?? entry.name;
  entry.isLocal = entry.isLocal || isLocal;

  if (syncPosition && (!entry.isLocal || !entry.hasSpawned)) {
    const { position } = player;
    if (position) {
      entry.sprite.position.x = Number.isFinite(position.x) ? position.x : entry.sprite.position.x;
      entry.sprite.position.y = Number.isFinite(position.y) ? position.y : entry.sprite.position.y;
    }

    if (player.animation && entry.sprite.currentAnimationName !== player.animation) {
      entry.sprite.play(player.animation, { force: true });
    }
  }

  entry.hasSpawned = true;

  if (entry.isLocal) {
    localPlayerEntry = entry;
  }

  return entry;
};

const removePlayer = (playerId) => {
  const entry = players.get(playerId);
  if (!entry) return;

  engine.removeSpriteFromLayer('characters', entry.sprite);
  entry.sprite.setVelocity(0, 0);
  entry.bubble?.remove();
  if (entry.bubbleTimer) {
    clearTimeout(entry.bubbleTimer);
  }
  if (entry.isLocal) {
    localPlayerEntry = null;
  }
  players.delete(playerId);
};

const showChatBubble = (playerId, content) => {
  const entry = players.get(playerId);
  if (!entry || !entry.bubble) return;

  entry.bubble.textContent = content;
  entry.bubble.classList.add('visible');

  if (entry.bubbleTimer) {
    clearTimeout(entry.bubbleTimer);
  }

  entry.bubbleTimer = setTimeout(() => {
    entry.bubble?.classList.remove('visible');
  }, 4000);
};

const syncBubblePositions = () => {
  players.forEach(({ sprite, bubble }) => {
    if (!bubble) return;
    const xPercent = (sprite.position.x / canvas.width) * 100;
    const yPercent = (sprite.position.y / canvas.height) * 100;
    bubble.style.left = `${xPercent}%`;
    bubble.style.top = `${yPercent}%`;
  });

  window.requestAnimationFrame(syncBubblePositions);
};

window.requestAnimationFrame(syncBubblePositions);

const heroMovement = {
  direction: 0,
  speed: 85,
  pressed: new Set()
};

const queueStateSync = () => {
  pendingSync = true;
};

const applyMovement = () => {
  if (!localPlayerEntry) return;

  const { sprite } = localPlayerEntry;
  sprite.setVelocity(heroMovement.direction * heroMovement.speed, 0);
  const animation = heroMovement.direction === 0 ? 'idle' : 'walk';
  if (sprite.currentAnimationName !== animation) {
    sprite.play(animation, { force: true, reset: false });
  }

  queueStateSync();
};

const recomputeDirection = () => {
  let direction = 0;
  const hasLeft = heroMovement.pressed.has('left');
  const hasRight = heroMovement.pressed.has('right');

  if (hasLeft && !hasRight) {
    direction = -1;
  } else if (hasRight && !hasLeft) {
    direction = 1;
  }

  if (direction !== heroMovement.direction) {
    heroMovement.direction = direction;
    applyMovement();
  }
};

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    heroMovement.pressed.add('left');
    recomputeDirection();
  } else if (event.key === 'ArrowRight') {
    heroMovement.pressed.add('right');
    recomputeDirection();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft') {
    heroMovement.pressed.delete('left');
    recomputeDirection();
  } else if (event.key === 'ArrowRight') {
    heroMovement.pressed.delete('right');
    recomputeDirection();
  }
});

let lastSyncAt = performance.now();

const syncLocalPlayerState = () => {
  if (!localPlayerEntry || !socket.connected) {
    return;
  }

  const now = performance.now();
  if (!pendingSync && now - lastSyncAt < 100) {
    return;
  }

  const { sprite } = localPlayerEntry;
  const payload = {
    position: {
      x: Number(sprite.position.x.toFixed(2)),
      y: Number(sprite.position.y.toFixed(2)),
      z: 0
    },
    animation: sprite.currentAnimationName ?? 'idle',
    name: localPlayerEntry.name
  };

  const hasChanged = !lastSentState ||
    Math.abs(lastSentState.position.x - payload.position.x) > 0.5 ||
    Math.abs(lastSentState.position.y - payload.position.y) > 0.5 ||
    lastSentState.animation !== payload.animation ||
    pendingSync;

  if (!hasChanged) {
    return;
  }

  socket.emit('player:update', payload);
  lastSentState = {
    position: { ...payload.position },
    animation: payload.animation
  };
  pendingSync = false;
  lastSyncAt = now;
};

setInterval(syncLocalPlayerState, 120);

const handleWorldState = (state) => {
  if (!state) return;

  if (Array.isArray(state.players)) {
    state.players.forEach((player) => {
      const isLocal = player.id === localPlayerId;
      ensurePlayer(player, { isLocal, syncPosition: !isLocal ? true : !localPlayerEntry });
    });
  }

  if (!chatHistoryLoaded && Array.isArray(state.chat)) {
    renderChatHistory(state.chat);
    chatHistoryLoaded = true;
  }
};

socket.on('world:state', handleWorldState);

socket.on('player:joined', (player) => {
  ensurePlayer(player, { isLocal: player.id === localPlayerId });
});

socket.on('player:updated', (player) => {
  const isLocal = player.id === localPlayerId;
  ensurePlayer(player, { isLocal, syncPosition: !isLocal });
});

socket.on('player:left', ({ id }) => {
  removePlayer(id);
});

socket.on('chat:message', (message) => {
  if (!message) return;
  addChatMessageToPanel(message);
  showChatBubble(message.playerId, message.content);
});

socket.on('connect', () => {
  const spawnPosition = {
    x: canvas.width / 2,
    y: canvas.height - 32,
    z: 0
  };

  socket.emit('player:join', {
    playerId: localPlayerId,
    name: localPlayerName,
    position: spawnPosition,
    animation: 'idle'
  }, (response) => {
    if (!response?.ok) {
      console.error('No fue posible unirse al mundo:', response?.message);
      return;
    }

    handleWorldState(response.state);
    const entry = ensurePlayer(response.player ?? {
      id: localPlayerId,
      name: localPlayerName,
      position: spawnPosition,
      animation: 'idle'
    }, { isLocal: true, syncPosition: true });

    if (entry) {
      entry.name = localPlayerName;
      queueStateSync();
    }
  });
});

socket.on('disconnect', () => {
  if (localPlayerEntry) {
    localPlayerEntry.sprite.setVelocity(0, 0);
  }
});

const sendChatMessage = (content) => {
  if (!socket.connected || !localPlayerEntry) {
    return;
  }

  chatSubmit.disabled = true;
  socket.emit('chat:message', {
    playerId: localPlayerId,
    author: localPlayerEntry.name,
    content
  }, (response) => {
    chatSubmit.disabled = false;
    if (!response?.ok) {
      console.error('No fue posible enviar el mensaje:', response?.message);
      return;
    }
    chatInput.value = '';
  });
};

if (chatForm && chatInput) {
  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = chatInput.value.trim();
    if (!value) {
      return;
    }
    sendChatMessage(value);
  });
}

window.addEventListener('beforeunload', () => {
  if (socket.connected) {
    socket.emit('player:leave');
  }
});

socket.connect();
engine.start();
