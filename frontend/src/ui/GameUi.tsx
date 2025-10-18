import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type {
  ChatMessageEvent,
  ChatScope,
  ConnectionState,
  MultiplayerClient,
  MultiplayerSnapshotEvent,
} from '../multiplayer';
import { createDefaultBlockRegistry, type BlockDefinition } from '../voxel/blocks';
import {
  GameController,
  HOTBAR_FEEDBACK_EVENT,
  HOTBAR_SELECT_EVENT,
  HOTBAR_UPDATE_EVENT,
  type GameHotbarSlot,
  type HotbarFeedbackDetail,
} from '../game';
import './styles.css';

export type ThemeMode = 'light' | 'dark';

interface GameUiProps {
  multiplayer?: MultiplayerClient;
  game?: GameController;
}

interface QuickSlot {
  key: number;
  block: BlockDefinition | null;
  quantity: number | 'infinite' | null;
}

type ChatChannel = ChatScope;

type DisplayChatChannel = ChatChannel | 'system';

interface UiChatMessage {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  type: 'system' | 'player';
  channel: DisplayChatChannel;
}

interface LoginScreenProps {
  visible: boolean;
  playerName: string;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  status: ConnectionState;
  error?: string | null;
}

interface HudProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  connectionState: ConnectionState;
  connectedPlayers: number;
  quickSlots: QuickSlot[];
  selectedIndex: number;
  onSelectSlot: (index: number) => void;
  selectionLabel: string | null;
}

interface ChatPanelProps {
  visible: boolean;
  channel: ChatChannel;
  onChannelChange: (channel: ChatChannel) => void;
  messages: UiChatMessage[];
  onSend: (message: string, channel: ChatChannel) => void;
  drafts: Record<ChatChannel, string>;
  onDraftChange: (channel: ChatChannel, draft: string) => void;
  focusSignal: number;
  onClose: () => void;
}

const THEME_STORAGE_KEY = 'comutiny:ui-theme';

const HOTBAR_KEYS = Array.from({ length: 9 }, (_value, index) => index + 1);

const buildDefaultQuickSlots = (): QuickSlot[] => {
  const registry = createDefaultBlockRegistry();
  const definitions = registry.getAll().sort((a, b) => a.id - b.id);
  const slots: QuickSlot[] = [];
  for (let index = 0; index < HOTBAR_KEYS.length; index += 1) {
    const block = definitions[index] ?? null;
    slots.push({
      key: HOTBAR_KEYS[index],
      block,
      quantity: block ? 'infinite' : null,
    });
  }
  return slots;
};

const mapGameHotbarSlots = (slots?: GameHotbarSlot[]): QuickSlot[] => {
  if (!slots || slots.length === 0) {
    return buildDefaultQuickSlots();
  }
  return slots.map((slot, index) => ({
    key: slot.key ?? HOTBAR_KEYS[index] ?? index + 1,
    block: slot.block ?? null,
    quantity: slot.block ? slot.quantity ?? 'infinite' : null,
  }));
};

const resolveInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)');
  return prefersDark?.matches ? 'dark' : 'light';
};

const formatTime = (value: number): string => {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const resolveConnectionLabel = (state: ConnectionState): string => {
  switch (state) {
    case 'conectado':
      return 'Conectado';
    case 'conectando':
      return 'Conectando…';
    case 'error':
      return 'Error';
    default:
      return 'Desconectado';
  }
};

export function GameUi({ multiplayer, game }: GameUiProps): JSX.Element {
  const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialTheme());
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    multiplayer?.getConnectionState() ?? 'desconectado',
  );
  const [connectedPlayers, setConnectedPlayers] = useState(0);
  const [playerName, setPlayerName] = useState(() => multiplayer?.getDisplayName() ?? '');
  const [loginVisible, setLoginVisible] = useState(
    multiplayer ? multiplayer.getConnectionState() !== 'conectado' : false,
  );
  const [loginError, setLoginError] = useState<string | null>(null);
  const [quickSlots, setQuickSlots] = useState<QuickSlot[]>(() =>
    mapGameHotbarSlots(game?.getHotbarSlots()),
  );
  const [selectedSlot, setSelectedSlot] = useState(() =>
    game?.getSelectedHotbarIndex() ?? 0,
  );
  const [selectionLabel, setSelectionLabel] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<UiChatMessage[]>([]);
  const [chatDrafts, setChatDrafts] = useState<Record<ChatChannel, string>>({
    global: '',
    proximity: '',
  });
  const [chatChannel, setChatChannel] = useState<ChatChannel>('global');
  const [chatVisibility, setChatVisibility] = useState<'hidden' | ChatChannel>('hidden');
  const [chatFocusSignal, setChatFocusSignal] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!multiplayer) {
      return;
    }

    setPlayerName(multiplayer.getDisplayName());

    const handleChat = (event: Event) => {
      const detail = (event as CustomEvent<ChatMessageEvent>).detail;
      setChatMessages((prev) => {
        const channel: DisplayChatChannel =
          detail.type === 'system' ? 'system' : detail.scope ?? 'global';
        const next: UiChatMessage = {
          id: detail.id,
          author: detail.authorName,
          content: detail.message,
          timestamp: detail.timestamp,
          type: detail.type,
          channel,
        };
        const limit = 200;
        const trimmed = prev.length >= limit ? prev.slice(prev.length - limit + 1) : prev;
        return [...trimmed, next];
      });
    };

    const handleSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<MultiplayerSnapshotEvent>).detail;
      setConnectedPlayers(detail.players.size);
    };

    const handleConnected = () => {
      setConnectionState('conectado');
      setLoginVisible(false);
      setLoginError(null);
    };

    const handleDisconnected = () => {
      setConnectionState('desconectado');
      setLoginVisible(true);
      setConnectedPlayers(0);
    };

    const handleError = (event: Event) => {
      const error = (event as CustomEvent<unknown>).detail;
      console.error('Conexión multijugador fallida', error);
      setConnectionState('error');
      setLoginVisible(true);
      setLoginError('No se pudo conectar con el servidor. Inténtalo nuevamente.');
      setConnectedPlayers(0);
    };

    const handleStateChange = (event: Event) => {
      const detail = (event as CustomEvent<ConnectionState>).detail;
      setConnectionState(detail);
    };

    multiplayer.addEventListener('chat', handleChat);
    multiplayer.addEventListener('snapshot', handleSnapshot);
    multiplayer.addEventListener('connected', handleConnected);
    multiplayer.addEventListener('disconnected', handleDisconnected);
    multiplayer.addEventListener('connection-error', handleError);
    multiplayer.addEventListener('connectionstatechange', handleStateChange);

    return () => {
      multiplayer.removeEventListener('chat', handleChat);
      multiplayer.removeEventListener('snapshot', handleSnapshot);
      multiplayer.removeEventListener('connected', handleConnected);
      multiplayer.removeEventListener('disconnected', handleDisconnected);
      multiplayer.removeEventListener('connection-error', handleError);
      multiplayer.removeEventListener('connectionstatechange', handleStateChange);
    };
  }, [multiplayer]);

  const updateSelectionLabel = useCallback(
    (index: number, slots: QuickSlot[] = quickSlots) => {
      const slot = slots[index];
      if (!slot) {
        return;
      }
      const label = slot.block ? `${slot.block.displayName}` : 'Espacio vacío';
      const quantitySuffix =
        typeof slot.quantity === 'number'
          ? ` · ${slot.quantity} disponibles`
          : '';
      setSelectionLabel(`${slot.key} · ${label}${quantitySuffix}`);
    },
    [quickSlots],
  );

  useEffect(() => {
    if (!selectionLabel) {
      return;
    }
    const timeout = window.setTimeout(() => setSelectionLabel(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [selectionLabel]);

  const handleSelectSlot = useCallback(
    (index: number) => {
      setSelectedSlot(index);
      updateSelectionLabel(index);
      game?.selectHotbarIndex(index);
    },
    [game, updateSelectionLabel],
  );

  const openChat = useCallback(
    (channel: ChatChannel) => {
      setChatChannel(channel);
      setChatVisibility(channel);
      setChatFocusSignal((value) => value + 1);
    },
    [],
  );

  const closeChat = useCallback(() => {
    setChatVisibility('hidden');
  }, []);

  useEffect(() => {
    if (loginVisible) {
      closeChat();
    }
  }, [closeChat, loginVisible]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const isTyping =
        activeElement && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName);

      if (event.key === 'Escape' && chatVisibility !== 'hidden') {
        event.preventDefault();
        closeChat();
        return;
      }

      if (loginVisible) {
        return;
      }

      if (!isTyping) {
        if (/^[1-9]$/.test(event.key)) {
          const index = Number(event.key) - 1;
          if (index >= 0 && index < quickSlots.length) {
            event.preventDefault();
            handleSelectSlot(index);
          }
          return;
        }

        if (event.key === 't' || event.key === 'T') {
          event.preventDefault();
          openChat('proximity');
          return;
        }

        if (event.key === 'Enter' && chatVisibility === 'hidden') {
          event.preventDefault();
          openChat('global');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    chatVisibility,
    closeChat,
    game,
    handleSelectSlot,
    loginVisible,
    openChat,
    quickSlots.length,
  ]);

  useEffect(() => {
    if (!game) {
      const defaults = buildDefaultQuickSlots();
      setQuickSlots(defaults);
      setSelectedSlot((current) => {
        const next = Math.min(current, defaults.length - 1);
        updateSelectionLabel(next, defaults);
        return next;
      });
      return;
    }

    const applySlots = (slots: GameHotbarSlot[]) => {
      const mapped = mapGameHotbarSlots(slots);
      setQuickSlots(mapped);
      const index = game.getSelectedHotbarIndex();
      setSelectedSlot(index);
      updateSelectionLabel(index, mapped);
    };

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<GameHotbarSlot[]>).detail;
      applySlots(detail);
    };
    const handleSelect = (event: Event) => {
      const index = (event as CustomEvent<number>).detail;
      setSelectedSlot(index);
      updateSelectionLabel(index);
    };
    const handleFeedback = (event: Event) => {
      const detail = (event as CustomEvent<HotbarFeedbackDetail>).detail;
      const message =
        detail.reason === 'empty'
          ? 'Sin bloques disponibles'
          : 'No se puede colocar aquí';
      setSelectionLabel(`${detail.slotKey} · ${message}`);
    };

    applySlots(game.getHotbarSlots());

    game.addEventListener(HOTBAR_UPDATE_EVENT, handleUpdate as EventListener);
    game.addEventListener(HOTBAR_SELECT_EVENT, handleSelect as EventListener);
    game.addEventListener(HOTBAR_FEEDBACK_EVENT, handleFeedback as EventListener);

    return () => {
      game.removeEventListener(HOTBAR_UPDATE_EVENT, handleUpdate as EventListener);
      game.removeEventListener(HOTBAR_SELECT_EVENT, handleSelect as EventListener);
      game.removeEventListener(HOTBAR_FEEDBACK_EVENT, handleFeedback as EventListener);
    };
  }, [game, updateSelectionLabel]);

  useEffect(() => {
    if (!game) {
      return;
    }
    const blocked = loginVisible || chatVisibility !== 'hidden';
    game.setInputEnabled(!blocked);
  }, [chatVisibility, game, loginVisible]);

  const handleLoginSubmit = useCallback(async () => {
    if (!multiplayer) {
      setLoginVisible(false);
      return;
    }

    const name = playerName.trim();
    if (name.length === 0) {
      setLoginError('Introduce un nombre visible.');
      return;
    }

    setLoginError(null);

    try {
      await multiplayer.connect({ displayName: name });
    } catch (error) {
      console.error('No se pudo iniciar sesión', error);
      setLoginError('No fue posible conectarse. Revisa tu conexión e intenta de nuevo.');
    }
  }, [multiplayer, playerName]);

  const handleSendMessage = useCallback(
    (message: string, channel: ChatChannel) => {
      if (!multiplayer) {
        return;
      }
      multiplayer.sendChatMessage(message, { scope: channel });
      setChatDrafts((drafts) => ({ ...drafts, [channel]: '' }));
    },
    [multiplayer],
  );

  const handleDraftChange = useCallback((channel: ChatChannel, draft: string) => {
    setChatDrafts((drafts) => ({ ...drafts, [channel]: draft }));
  }, []);

  const visibleMessages = useMemo(() => {
    return chatMessages.filter((entry) => {
      if (entry.channel === 'system') {
        return true;
      }
      return entry.channel === chatChannel;
    });
  }, [chatChannel, chatMessages]);

  const lastMessage = chatMessages[chatMessages.length - 1];

  return (
    <div className="game-ui" data-theme={theme}>
      <Hud
        theme={theme}
        onToggleTheme={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
        connectionState={connectionState}
        connectedPlayers={connectedPlayers}
        quickSlots={quickSlots}
        selectedIndex={selectedSlot}
        onSelectSlot={handleSelectSlot}
        selectionLabel={selectionLabel}
      />

      <ChatPanel
        visible={chatVisibility !== 'hidden'}
        channel={chatChannel}
        onChannelChange={(channel) => {
          setChatChannel(channel);
          setChatVisibility(channel);
          setChatFocusSignal((value) => value + 1);
        }}
        messages={visibleMessages}
        onSend={handleSendMessage}
        drafts={chatDrafts}
        onDraftChange={handleDraftChange}
        focusSignal={chatFocusSignal}
        onClose={closeChat}
      />

      {chatVisibility === 'hidden' && lastMessage ? (
        <div className="chat-peek" aria-live="polite">
          <span className="chat-peek__author">{lastMessage.author}</span>
          <span className="chat-peek__content">{lastMessage.content}</span>
        </div>
      ) : null}

      <LoginScreen
        visible={loginVisible}
        playerName={playerName}
        onNameChange={setPlayerName}
        onSubmit={handleLoginSubmit}
        status={connectionState}
        error={loginError}
      />
    </div>
  );
}

function LoginScreen({
  visible,
  playerName,
  onNameChange,
  onSubmit,
  status,
  error,
}: LoginScreenProps): JSX.Element | null {
  const formRef = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (visible) {
      window.requestAnimationFrame(() => {
        const input = formRef.current?.querySelector<HTMLInputElement>('input');
        input?.focus();
        input?.select();
      });
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  const isBusy = status === 'conectando';

  return (
    <div className="login-screen" role="dialog" aria-modal="true">
      <div className="login-screen__card">
        <h1 className="login-screen__title">CoMutiNy</h1>
        <p className="login-screen__subtitle">
          Inicia sesión para unirte a la tripulación y comenzar tu aventura voxel.
        </p>
        <form
          ref={formRef}
          className="login-screen__form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="login-screen__label">
            Nombre visible
            <input
              type="text"
              name="displayName"
              autoComplete="nickname"
              placeholder="Tu apodo"
              maxLength={32}
              value={playerName}
              onChange={(event) => onNameChange(event.target.value)}
              disabled={isBusy}
              required
            />
          </label>
          {error ? <p className="login-screen__error">{error}</p> : null}
          <button type="submit" className="login-screen__submit" disabled={isBusy}>
            {isBusy ? 'Conectando…' : 'Entrar al mundo'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Hud({
  theme,
  onToggleTheme,
  connectionState,
  connectedPlayers,
  quickSlots,
  selectedIndex,
  onSelectSlot,
  selectionLabel,
}: HudProps): JSX.Element {
  return (
    <div className="hud" aria-live="polite">
      <div className="hud__top">
        <div className="hud__status" data-state={connectionState}>
          <span className="hud__status-dot" aria-hidden="true" />
          <span className="hud__status-text">
            {resolveConnectionLabel(connectionState)} · {connectedPlayers} en línea
          </span>
        </div>
        <button
          type="button"
          className="hud__theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
      </div>
      <div className="hud__center">
        {selectionLabel ? (
          <div className="hud__selection" key={selectionLabel}>
            {selectionLabel}
          </div>
        ) : null}
      </div>
      <QuickBar
        quickSlots={quickSlots}
        selectedIndex={selectedIndex}
        onSelectSlot={onSelectSlot}
      />
    </div>
  );
}

function QuickBar({
  quickSlots,
  selectedIndex,
  onSelectSlot,
}: {
  quickSlots: QuickSlot[];
  selectedIndex: number;
  onSelectSlot: (index: number) => void;
}): JSX.Element {
  return (
    <div className="quickbar" role="toolbar" aria-label="Barra rápida">
      {quickSlots.map((slot, index) => (
        <button
          type="button"
          key={slot.key}
          className="quickbar__slot"
          data-selected={index === selectedIndex}
          data-empty={
            typeof slot.quantity === 'number' && slot.quantity <= 0 ? 'true' : 'false'
          }
          onClick={() => onSelectSlot(index)}
        >
          <span className="quickbar__key">{slot.key}</span>
          <span className="quickbar__label">{slot.block?.displayName ?? 'Vacío'}</span>
          {slot.quantity !== null ? (
            <span
              className="quickbar__quantity"
              data-empty={
                typeof slot.quantity === 'number' && slot.quantity <= 0 ? 'true' : 'false'
              }
            >
              {slot.quantity === 'infinite' ? '∞' : slot.quantity}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function ChatPanel({
  visible,
  channel,
  onChannelChange,
  messages,
  onSend,
  drafts,
  onDraftChange,
  focusSignal,
  onClose,
}: ChatPanelProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const log = logRef.current;
    if (log) {
      log.scrollTop = log.scrollHeight;
    }
  }, [messages, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const input = inputRef.current;
    if (input) {
      window.requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    }
  }, [focusSignal, visible]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const draft = drafts[channel];
      if (draft.trim().length === 0) {
        return;
      }
      onSend(draft, channel);
    },
    [channel, drafts, onSend],
  );

  return (
    <section className="chat-panel" data-visible={visible} aria-label="Chat">
      <header className="chat-panel__header">
        <div className="chat-panel__tabs" role="tablist" aria-label="Canales de chat">
          {(['global', 'proximity'] as ChatChannel[]).map((option) => (
            <button
              type="button"
              role="tab"
              key={option}
              data-active={channel === option}
              onClick={() => onChannelChange(option)}
            >
              {option === 'global' ? 'Global' : 'Proximidad'}
            </button>
          ))}
        </div>
        <button type="button" className="chat-panel__close" onClick={onClose} aria-label="Cerrar chat">
          ×
        </button>
      </header>
      <div className="chat-panel__log" ref={logRef}>
        {messages.length === 0 ? (
          <p className="chat-panel__empty">Aún no hay mensajes.</p>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={`chat-panel__message chat-panel__message--${message.type}`}>
              <header>
                <span className="chat-panel__author">{message.author}</span>
                <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
              </header>
              <p>{message.content}</p>
            </article>
          ))
        )}
      </div>
      <form className="chat-panel__form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="chat-message">
          Mensaje de chat
        </label>
        <input
          ref={inputRef}
          id="chat-message"
          type="text"
          autoComplete="off"
          placeholder={channel === 'global' ? 'Habla con todos…' : 'Habla con quienes están cerca…'}
          value={drafts[channel]}
          onChange={(event) => onDraftChange(channel, event.target.value)}
        />
        <button type="submit">Enviar</button>
      </form>
    </section>
  );
}
