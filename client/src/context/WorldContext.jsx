import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import LagCompensator from '../utils/lagCompensation.js';
import { useAuth } from './AuthContext.jsx';

const WorldContext = createContext({
  connected: false,
  connectionError: null,
  connectionStatus: 'idle',
  players: [],
  localPlayerId: null,
  spriteAtlas: null,
  chatMessages: [],
  sendChatMessage: () => Promise.resolve(null),
  updateLocalPlayerState: () => {}
});

const sanitizePosition = (position) => {
  if (!position || typeof position !== 'object') {
    return { x: 0, y: 0, z: 0 };
  }

  const x = Number(position.x);
  const y = Number(position.y);
  const z = Number(position.z);

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0
  };
};

const mergeMetadata = (current = {}, incoming = {}) => {
  if (!incoming || typeof incoming !== 'object') {
    return current;
  }

  const merged = { ...current };

  for (const [key, value] of Object.entries(incoming)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = mergeMetadata(current[key], value);
    } else {
      merged[key] = value;
    }
  }

  return merged;
};

const DEFAULT_ANIMATION = 'idle';

const deriveServerUrl = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    window.__COMUTINY_SOCKET_URL__ ||
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:4000'
  );
};

export function WorldProvider({ children }) {
  const { user } = useAuth();
  const [connectionState, setConnectionState] = useState({ status: 'idle', error: null });
  const [players, setPlayers] = useState([]);
  const [localPlayerId, setLocalPlayerId] = useState(null);
  const [spriteAtlas, setSpriteAtlas] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);

  const socketRef = useRef(null);
  const localPlayerIdRef = useRef(null);
  const fallbackPlayerIdRef = useRef(null);
  const playersRef = useRef(new Map());
  const compensatorsRef = useRef(new Map());
  const chatRef = useRef([]);
  const localStateRef = useRef({
    position: { x: 0, y: 0, z: 0 },
    animation: DEFAULT_ANIMATION,
    metadata: {}
  });

  const ensureCompensator = useCallback((playerId) => {
    if (!playerId) {
      return null;
    }

    let compensator = compensatorsRef.current.get(playerId);
    if (!compensator) {
      compensator = new LagCompensator();
      compensatorsRef.current.set(playerId, compensator);
    }
    return compensator;
  }, []);

  const applyPlayerSnapshot = useCallback((player, timestamp = Date.now()) => {
    if (!player?.id) {
      return;
    }

    const existing = playersRef.current.get(player.id) ?? {};
    const position = sanitizePosition(player.position ?? existing.position);
    const metadata = mergeMetadata(existing.metadata, player.metadata);

    const enriched = {
      ...existing,
      ...player,
      position,
      metadata,
      animation: player.animation ?? existing.animation ?? DEFAULT_ANIMATION
    };

    playersRef.current.set(player.id, enriched);

    const compensator = ensureCompensator(player.id);
    compensator?.addSample(position, timestamp);
  }, [ensureCompensator]);

  const removePlayer = useCallback((playerId) => {
    if (!playerId) {
      return;
    }
    playersRef.current.delete(playerId);
    compensatorsRef.current.delete(playerId);
  }, []);

  const appendChatMessage = useCallback((message) => {
    if (!message?.id) {
      return;
    }

    chatRef.current = (() => {
      const existingIndex = chatRef.current.findIndex((entry) => entry.id === message.id);
      const payload = {
        id: message.id,
        playerId: message.playerId ?? null,
        author: message.author ?? 'Player',
        content: message.content ?? '',
        timestamp: message.timestamp ?? new Date().toISOString()
      };

      if (existingIndex >= 0) {
        const next = [...chatRef.current];
        next[existingIndex] = { ...next[existingIndex], ...payload };
        return next;
      }

      const next = [...chatRef.current, payload];

      if (next.length > 200) {
        return next.slice(next.length - 200);
      }

      return next;
    })();

    setChatMessages(chatRef.current);
  }, []);

  const applySnapshot = useCallback(
    (snapshot) => {
      if (!snapshot) {
        return;
      }

      const timestamp = Date.now();
      const activeIds = new Set();

      snapshot.players?.forEach((player) => {
        activeIds.add(player.id);
        applyPlayerSnapshot(player, timestamp);
      });

      if (snapshot.spriteAtlas) {
        setSpriteAtlas(snapshot.spriteAtlas);
      }

      if (Array.isArray(snapshot.chat)) {
        const nextChat = snapshot.chat
          .filter((entry) => entry?.id)
          .map((entry) => ({
            id: entry.id,
            playerId: entry.playerId ?? null,
            author: entry.author ?? 'Player',
            content: entry.content ?? '',
            timestamp: entry.timestamp ?? new Date().toISOString()
          }));

        chatRef.current = nextChat.slice(-200);
        setChatMessages(chatRef.current);
      }

      for (const existingId of playersRef.current.keys()) {
        if (!activeIds.has(existingId)) {
          removePlayer(existingId);
        }
      }
    },
    [applyPlayerSnapshot, removePlayer]
  );

  const refreshRenderablePlayers = useCallback(() => {
    const timestamp = Date.now();
    const nextPlayers = [];

    for (const [playerId, player] of playersRef.current.entries()) {
      const compensator = compensatorsRef.current.get(playerId);
      const renderPosition = compensator?.getInterpolatedPosition(timestamp) ?? player.position;
      nextPlayers.push({
        ...player,
        renderPosition
      });
    }

    setPlayers((previous) => {
      if (previous.length === nextPlayers.length) {
        const isSame = previous.every((currentPlayer, index) => {
          const nextPlayer = nextPlayers[index];
          if (!nextPlayer || currentPlayer.id !== nextPlayer.id) {
            return false;
          }
          const currentPos = currentPlayer.renderPosition ?? currentPlayer.position;
          const nextPos = nextPlayer.renderPosition ?? nextPlayer.position;
          const dx = Math.abs((currentPos?.x ?? 0) - (nextPos?.x ?? 0));
          const dy = Math.abs((currentPos?.y ?? 0) - (nextPos?.y ?? 0));
          const dz = Math.abs((currentPos?.z ?? 0) - (nextPos?.z ?? 0));
          return dx < 0.005 && dy < 0.005 && dz < 0.005;
        });

        if (isSame) {
          return previous;
        }
      }

      return nextPlayers;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let animationFrame = null;

    const tick = () => {
      refreshRenderablePlayers();
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [refreshRenderablePlayers]);

  const determinePlayerId = useCallback(
    () => {
      if (user?.id) {
        return String(user.id);
      }

      if (!fallbackPlayerIdRef.current) {
        fallbackPlayerIdRef.current = `guest-${Math.random().toString(36).slice(2, 10)}`;
      }

      return fallbackPlayerIdRef.current;
    },
    [user]
  );

  const sendJoinRequest = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      return;
    }

    const playerId = determinePlayerId();
    const previousId = localPlayerIdRef.current;

    if (previousId && previousId !== playerId) {
      playersRef.current.delete(previousId);
      compensatorsRef.current.delete(previousId);
    }

    localPlayerIdRef.current = playerId;
    setLocalPlayerId(playerId);

    const payload = {
      playerId,
      name: user?.username ?? `Guest ${playerId.slice(-4)}`,
      position: localStateRef.current.position,
      animation: localStateRef.current.animation,
      metadata: mergeMetadata(localStateRef.current.metadata, {
        mapId: localStateRef.current.metadata?.mapId
      })
    };

    socket.emit('player:join', payload, (ack) => {
      if (ack?.state) {
        applySnapshot(ack.state);
      }
      if (ack?.player) {
        applyPlayerSnapshot(ack.player);
      }
    });
  }, [applyPlayerSnapshot, applySnapshot, determinePlayerId, user]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const url = deriveServerUrl();

    if (!url) {
      return undefined;
    }

    setConnectionState({ status: 'connecting', error: null });

    const socket = io(url, {
      autoConnect: true,
      transports: ['websocket'],
      reconnectionAttempts: 5,
      timeout: 5000
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setConnectionState({ status: 'connected', error: null });
      sendJoinRequest();
    };

    const handleDisconnect = () => {
      setConnectionState({ status: 'disconnected', error: null });
    };

    const handleConnectError = (error) => {
      setConnectionState({ status: 'error', error });
    };

    const handleSessionTerminated = (payload) => {
      setConnectionState({ status: 'terminated', error: payload?.reason ?? 'Session terminated' });
      playersRef.current.clear();
      compensatorsRef.current.clear();
      chatRef.current = [];
      setPlayers([]);
      setChatMessages([]);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('world:state', applySnapshot);
    socket.on('sprites:atlasUpdated', setSpriteAtlas);
    socket.on('player:joined', (player) => applyPlayerSnapshot(player));
    socket.on('player:updated', (player) => applyPlayerSnapshot(player));
    socket.on('player:left', ({ id }) => removePlayer(id));
    socket.on('chat:message', appendChatMessage);
    socket.on('session:terminated', handleSessionTerminated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('world:state', applySnapshot);
      socket.off('sprites:atlasUpdated', setSpriteAtlas);
      socket.off('player:joined', applyPlayerSnapshot);
      socket.off('player:updated', applyPlayerSnapshot);
      socket.off('player:left', removePlayer);
      socket.off('chat:message', appendChatMessage);
      socket.off('session:terminated', handleSessionTerminated);
      socket.disconnect();
      socketRef.current = null;
      playersRef.current.clear();
      compensatorsRef.current.clear();
      localPlayerIdRef.current = null;
      setPlayers([]);
      setSpriteAtlas(null);
      chatRef.current = [];
      setChatMessages([]);
    };
  }, [appendChatMessage, applyPlayerSnapshot, applySnapshot, removePlayer, sendJoinRequest]);

  useEffect(() => {
    sendJoinRequest();
  }, [sendJoinRequest, user]);

  const updateLocalPlayerState = useCallback(
    (partial) => {
      const playerId = localPlayerId ?? determinePlayerId();
      localPlayerIdRef.current = playerId;
      setLocalPlayerId(playerId);

      const nextState = { ...localStateRef.current };

      if (partial.position) {
        nextState.position = sanitizePosition({ ...nextState.position, ...partial.position });
      }

      if (partial.animation) {
        nextState.animation = partial.animation;
      }

      if (partial.metadata) {
        nextState.metadata = mergeMetadata(nextState.metadata, partial.metadata);
      }

      localStateRef.current = nextState;

      const existing = playersRef.current.get(playerId) ?? { id: playerId };
      const updatedPlayer = {
        ...existing,
        name: user?.username ?? existing.name ?? `Guest ${playerId.slice(-4)}`,
        position: nextState.position,
        animation: nextState.animation,
        metadata: mergeMetadata(existing.metadata, nextState.metadata)
      };

      playersRef.current.set(playerId, updatedPlayer);
      ensureCompensator(playerId)?.addSample(nextState.position);

      const socket = socketRef.current;
      if (socket?.connected) {
        socket.emit('player:update', {
          position: nextState.position,
          animation: nextState.animation,
          metadata: nextState.metadata,
          name: updatedPlayer.name
        });
      }
    },
    [determinePlayerId, ensureCompensator, localPlayerId, user]
  );

  const sendChatMessage = useCallback(
    (content) => {
      const socket = socketRef.current;
      const playerId = localPlayerIdRef.current ?? determinePlayerId();
      const trimmed = typeof content === 'string' ? content.trim() : '';

      if (!socket?.connected || !trimmed) {
        return Promise.resolve(null);
      }

      return new Promise((resolve, reject) => {
        socket.emit(
          'chat:message',
          {
            content: trimmed,
            playerId,
            author: user?.username ?? undefined
          },
          (ack) => {
            if (ack?.ok && ack.message) {
              appendChatMessage(ack.message);
              resolve(ack.message);
            } else {
              reject(new Error(ack?.message ?? 'Failed to send chat message'));
            }
          }
        );
      });
    },
    [appendChatMessage, determinePlayerId, user]
  );

  const value = useMemo(
    () => ({
      connected: connectionState.status === 'connected',
      connectionError: connectionState.error,
      connectionStatus: connectionState.status,
      players,
      localPlayerId,
      spriteAtlas,
      chatMessages,
      sendChatMessage,
      updateLocalPlayerState
    }),
    [
      connectionState.error,
      connectionState.status,
      chatMessages,
      localPlayerId,
      players,
      spriteAtlas,
      sendChatMessage,
      updateLocalPlayerState
    ]
  );

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}

export const useWorld = () => {
  return useContext(WorldContext);
};
