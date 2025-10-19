import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, UIEvent, JSX } from 'react';

import {
  emitChatSend,
  emitChatTyping,
  gameEvents,
  GameEvent,
  type ChatHistoryEvent,
  type ChatMessageEvent,
  type ChatScope,
  type ChatTypingStatusPayload,
} from '../../game/events';
import { loadSession } from '../../auth/session';
import './ChatOverlay.css';

type ActiveScope = Exclude<ChatScope, 'system'>;

const MESSAGE_LIMIT = 200;
const TYPING_TIMEOUT_MS = 2000;

export const ChatOverlay = (): JSX.Element => {
  const [scope, setScope] = useState<ActiveScope>('global');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessageEvent[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [typingVersion, setTypingVersion] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingScopeRef = useRef<ActiveScope>('global');
  const isTypingRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Map<string, ChatMessageEvent>>(new Map());
  const typingRef = useRef<{ global: Map<string, string>; proximity: Map<string, string> }>({
    global: new Map(),
    proximity: new Map(),
  });

  useEffect(() => {
    const envUserId = import.meta.env?.VITE_COLYSEUS_USER_ID as string | undefined;
    if (envUserId && envUserId.trim()) {
      userIdRef.current = envUserId.trim();
      return;
    }

    const session = loadSession();
    userIdRef.current = session?.user.id ?? null;
  }, []);

  const formatTime = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
    }
  }, []);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (isTypingRef.current) {
      emitChatTyping({ scope: typingScopeRef.current, typing: false });
      isTypingRef.current = false;
    }
  }, []);

  const scheduleTypingTimeout = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_TIMEOUT_MS);
  }, [stopTyping]);

  const applyMessages = useCallback((incoming: ChatMessageEvent[], mode: 'merge' | 'replace' = 'merge') => {
    const map = mode === 'replace' ? new Map<string, ChatMessageEvent>() : new Map(messagesRef.current);

    incoming.forEach((message) => {
      map.set(message.id, message);
    });

    const sorted = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
    const limited = sorted.slice(-MESSAGE_LIMIT);
    messagesRef.current = new Map(limited.map((message) => [message.id, message]));
    setMessages(limited);
    if (mode === 'replace') {
      setAutoScroll(true);
    }
  }, []);

  const handleTypingStatus = useCallback(
    (status: ChatTypingStatusPayload) => {
      if (!status) {
        return;
      }

      if (userIdRef.current && status.userId === userIdRef.current) {
        return;
      }

      const scopeKey: ActiveScope = status.scope === 'proximity' ? 'proximity' : 'global';
      const otherScope: ActiveScope = scopeKey === 'global' ? 'proximity' : 'global';
      const scopeMap = typingRef.current[scopeKey];
      const otherMap = typingRef.current[otherScope];

      if (status.typing) {
        scopeMap.set(status.userId, status.displayName);
        otherMap.delete(status.userId);
      } else {
        scopeMap.delete(status.userId);
        otherMap.delete(status.userId);
      }

      setTypingVersion((value) => value + 1);
    },
    [],
  );

  useEffect(() => {
    const handleHistory = (event: ChatHistoryEvent) => {
      applyMessages(event.messages, 'replace');
    };

    const handleMessage = (message: ChatMessageEvent) => {
      applyMessages([message]);
    };

    gameEvents.on(GameEvent.ChatHistory, handleHistory);
    gameEvents.on(GameEvent.ChatMessage, handleMessage);
    gameEvents.on(GameEvent.ChatTypingStatus, handleTypingStatus);

    return () => {
      gameEvents.off(GameEvent.ChatHistory, handleHistory);
      gameEvents.off(GameEvent.ChatMessage, handleMessage);
      gameEvents.off(GameEvent.ChatTypingStatus, handleTypingStatus);
    };
  }, [applyMessages, handleTypingStatus]);

  useEffect(() => {
    if (!autoScroll || !listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, autoScroll]);

  useEffect(() => () => {
    stopTyping();
  }, [stopTyping]);

  const handleDraftChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDraft(value);

    if (!value.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      emitChatTyping({ scope, typing: true });
      isTypingRef.current = true;
      typingScopeRef.current = scope;
    } else if (typingScopeRef.current !== scope) {
      emitChatTyping({ scope: typingScopeRef.current, typing: false });
      emitChatTyping({ scope, typing: true });
      typingScopeRef.current = scope;
    }

    scheduleTypingTimeout();
  };

  const handleScopeChange = (next: ActiveScope) => {
    if (scope === next) {
      return;
    }

    stopTyping();
    setScope(next);

    if (draft.trim()) {
      emitChatTyping({ scope: next, typing: true });
      isTypingRef.current = true;
      typingScopeRef.current = next;
      scheduleTypingTimeout();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const content = draft.trim();
    if (!content) {
      setDraft('');
      stopTyping();
      return;
    }

    emitChatSend({ content, scope, persist: scope === 'global' });
    setDraft('');
    stopTyping();
  };

  const handleHistoryScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
    setAutoScroll(isNearBottom);
  };

  const typingNames = useMemo(() => {
    const map = typingRef.current[scope];
    return Array.from(map.values());
  }, [scope, typingVersion]);

  return (
    <section className="chat-overlay" aria-label="Chat">
      <header className="chat-header">
        <nav className="chat-scope" aria-label="Ámbito del chat">
          <button
            type="button"
            className={scope === 'global' ? 'chat-scope__button chat-scope__button--active' : 'chat-scope__button'}
            onClick={() => handleScopeChange('global')}
            aria-pressed={scope === 'global'}
          >
            Global
          </button>
          <button
            type="button"
            className={scope === 'proximity' ? 'chat-scope__button chat-scope__button--active' : 'chat-scope__button'}
            onClick={() => handleScopeChange('proximity')}
            aria-pressed={scope === 'proximity'}
          >
            Proximidad
          </button>
        </nav>
      </header>
      <div
        className="chat-history"
        ref={listRef}
        role="log"
        aria-live="polite"
        onScroll={handleHistoryScroll}
      >
        {messages.map((message) => {
          const isSystem = message.scope === 'system' || !message.senderId;
          const isProximity = message.scope === 'proximity';
          const classes = ['chat-message'];

          if (isSystem) {
            classes.push('chat-message--system');
          } else if (isProximity) {
            classes.push('chat-message--proximity');
          } else {
            classes.push('chat-message--global');
          }

          return (
            <article key={message.id} className={classes.join(' ')}>
              <header className="chat-message__meta">
                <span className="chat-message__author">{message.senderName}</span>
                <span className="chat-message__time">{formatTime.format(new Date(message.timestamp))}</span>
                {isSystem ? (
                  <span className="chat-message__tag chat-message__tag--system">Sistema</span>
                ) : isProximity ? (
                  <span className="chat-message__tag chat-message__tag--proximity">Proximidad</span>
                ) : null}
              </header>
              <p className="chat-message__content">{message.content}</p>
            </article>
          );
        })}
      </div>
      <div className="chat-typing" aria-live="polite">
        {typingNames.length > 0 ? (
          <span>
            {typingNames.join(', ')} {typingNames.length === 1 ? 'está escribiendo…' : 'están escribiendo…'}
          </span>
        ) : (
          <span className="chat-typing__placeholder">&nbsp;</span>
        )}
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          onChange={handleDraftChange}
          placeholder={scope === 'global' ? 'Mensaje global…' : 'Mensaje cercano…'}
          maxLength={280}
          aria-label="Escribir mensaje"
        />
        <button type="submit" className="chat-submit">Enviar</button>
      </form>
    </section>
  );
};
