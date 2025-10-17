import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import LagCompensator from '../utils/lagCompensation.js';

const DEFAULT_APPEARANCE = {
  hair: 'Corto',
  face: 'Clásica',
  outfit: 'Aventurero',
  shoes: 'Botas'
};

const WorldContext = createContext({
  connected: false,
  connectionError: null,
  connectionStatus: 'idle',
  profile: null,
  joinStatus: 'idle',
  joinError: null,
  joinWorld: () => Promise.resolve(null),
  players: [],
  localPlayerId: null,
  spriteAtlas: null,
  chatMessages: [],
  sendChatMessage: () => Promise.resolve(null),
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => {},
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

const SPRITE_IDS = ['explorer', 'pilot', 'engineer', 'scientist'];
const SPRITE_COLORS = ['#ff7043', '#29b6f6', '#66bb6a', '#ab47bc', '#ffca28', '#8d6e63'];
const ACCENT_COLORS = ['#212121', '#f5f5f5', '#37474f', '#cfd8dc'];

const pickRandom = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index];
};

const generateRandomAvatar = () => ({
  sprite: pickRandom(SPRITE_IDS) ?? 'explorer',
  color: pickRandom(SPRITE_COLORS) ?? '#ff7043',
  accent: pickRandom(ACCENT_COLORS) ?? '#212121'
});

const generateClientPlayerId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `client-${crypto.randomUUID()}`;
  }

  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `client-${timestamp}${random}`;
};

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
  const [connectionState, setConnectionState] = useState({ status: 'idle', error: null });
  const [players, setPlayers] = useState([]);
  const [localPlayerId, setLocalPlayerId] = useState(null);
  const [spriteAtlas, setSpriteAtlas] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [profile, setProfile] = useState(null);
  const [joinState, setJoinState] = useState({ status: 'idle', error: null });
  const [appearanceState, setAppearanceState] = useState(DEFAULT_APPEARANCE);

  const socketRef = useRef(null);
  const localPlayerIdRef = useRef(null);
  const profileRef = useRef(null);
  const joinStateRef = useRef({ status: 'idle', error: null });
  const playersRef = useRef(new Map());
  const compensatorsRef = useRef(new Map());
  const chatRef = useRef([]);
  const localStateRef = useRef({
    position: { x: 0, y: 0, z: 0 },
    animation: DEFAULT_ANIMATION,
    metadata: {}
  });

  const ensureLocalPlayerId = useCallback(() => {
    if (localPlayerIdRef.current) {
      return localPlayerIdRef.current;
    }

    const fallbackId = profileRef.current?.playerId ?? generateClientPlayerId();
    localPlayerIdRef.current = fallbackId;
    setLocalPlayerId(fallbackId);
    return fallbackId;
  }, []);

  useEffect(() => {
    joinStateRef.current = joinState;
  }, [joinState]);

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
    let metadata = mergeMetadata(existing.metadata, player.metadata);

    if (player.avatar && typeof player.avatar === 'object') {
      metadata = mergeMetadata(metadata, { avatar: player.avatar });
    }

    if (player.sprite) {
      metadata = mergeMetadata(metadata, { avatar: { sprite: player.sprite } });
    }

    const alias =
      typeof player.alias === 'string' && player.alias.trim()
        ? player.alias.trim()
        : metadata.alias ?? existing.metadata?.alias ?? existing.name ?? null;

    if (alias) {
      metadata = mergeMetadata(metadata, { alias });
    }

    const sprite =
      typeof player.sprite === 'string' && player.sprite.trim()
        ? player.sprite.trim()
        : metadata.avatar?.sprite ?? existing.sprite ?? null;

    const direction = (() => {
      if (typeof player.direction === 'string' && player.direction.trim()) {
        return player.direction.trim();
      }
      if (typeof metadata.heading === 'string' && metadata.heading.trim()) {
        return metadata.heading.trim();
      }
      if (typeof existing.direction === 'string' && existing.direction.trim()) {
        return existing.direction.trim();
      }
      if (typeof existing.metadata?.heading === 'string' && existing.metadata.heading.trim()) {
        return existing.metadata.heading.trim();
      }
      return 'down';
    })();

    metadata = mergeMetadata(metadata, { heading: direction });

    const animation = player.animation ?? existing.animation ?? DEFAULT_ANIMATION;
    const displayName = alias ?? player.name ?? existing.name ?? `Tripulante ${player.id.slice(-4)}`;

    const enriched = {
      ...existing,
      ...player,
      id: player.id,
      name: displayName,
      alias: alias ?? null,
      position,
      metadata,
      animation,
      direction,
      sprite
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
        author: message.author ?? 'Tripulante',
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
            author: entry.author ?? 'Tripulante',
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
          const sameDirection = currentPlayer.direction === nextPlayer.direction;
          const sameAnimation = currentPlayer.animation === nextPlayer.animation;
          return dx < 0.005 && dy < 0.005 && dz < 0.005 && sameDirection && sameAnimation;
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

  const joinWithProfile = useCallback(
    (profileData) => {
      const socket = socketRef.current;

      if (!socket?.connected) {
        return Promise.reject(new Error('No hay conexión activa con el servidor.'));
      }

      const alias = typeof profileData?.alias === 'string' ? profileData.alias.trim() : '';

      if (!alias) {
        return Promise.reject(new Error('El alias es obligatorio.'));
      }

      const avatar =
        profileData?.avatar && typeof profileData.avatar === 'object'
          ? profileData.avatar
          : null;

      const desiredId =
        typeof profileData?.playerId === 'string' && profileData.playerId.trim()
          ? profileData.playerId.trim()
          : ensureLocalPlayerId();

      const previousId = localPlayerIdRef.current;

      if (previousId && previousId !== desiredId) {
        playersRef.current.delete(previousId);
        compensatorsRef.current.delete(previousId);
      }

      localPlayerIdRef.current = desiredId;
      setLocalPlayerId(desiredId);

      const nextProfile = {
        alias,
        avatar,
        playerId: desiredId
      };

      profileRef.current = nextProfile;
      setProfile(nextProfile);

      const metadata = mergeMetadata(localStateRef.current.metadata, {
        alias,
        ...(avatar ? { avatar } : {})
      });

      const nextState = {
        ...localStateRef.current,
        metadata
      };

      localStateRef.current = nextState;

      return new Promise((resolve, reject) => {
        const direction =
          typeof nextState.metadata?.heading === 'string'
            ? nextState.metadata.heading
            : 'down';
        const sprite =
          typeof metadata?.avatar?.sprite === 'string'
            ? metadata.avatar.sprite
            : avatar?.sprite ?? null;

        socket.emit(
          'player:join',
          {
            playerId: desiredId,
            name: alias,
            alias,
            avatar,
            position: nextState.position,
            animation: nextState.animation,
            metadata,
            direction,
            sprite
          },
          (ack) => {
            if (!ack?.ok) {
              reject(new Error(ack?.message ?? 'No se pudo unir a la sesión.'));
              return;
            }

            if (ack.state) {
              applySnapshot(ack.state);
            }

            if (ack.player) {
              applyPlayerSnapshot(ack.player);
            }

            const joined = ack.player ?? {};
            const resolvedId = joined.id ?? desiredId;
            const resolvedAlias =
              joined?.metadata?.alias ?? joined?.name ?? alias;
            const resolvedAvatar =
              joined?.metadata?.avatar ?? avatar ?? null;

            if (resolvedId && resolvedId !== desiredId) {
              playersRef.current.delete(desiredId);
              compensatorsRef.current.delete(desiredId);
            }

            localPlayerIdRef.current = resolvedId;
            setLocalPlayerId(resolvedId);

            const mergedMetadata = mergeMetadata(metadata, {
              alias: resolvedAlias,
              ...(resolvedAvatar ? { avatar: resolvedAvatar } : {})
            });

            localStateRef.current = {
              ...localStateRef.current,
              metadata: mergedMetadata
            };

            const resolvedProfile = {
              alias: resolvedAlias,
              avatar: resolvedAvatar,
              playerId: resolvedId
            };

            profileRef.current = resolvedProfile;
            setProfile(resolvedProfile);

            resolve(joined);
          }
        );
      });
    },
    [applyPlayerSnapshot, applySnapshot, ensureLocalPlayerId]
  );

  const joinWorld = useCallback(
    (aliasInput) => {
      const trimmed = typeof aliasInput === 'string' ? aliasInput.trim() : '';

      if (!trimmed) {
        const error = new Error('Introduce un alias para unirte.');
        setJoinState({ status: 'error', error });
        return Promise.reject(error);
      }

      const previousProfile = profileRef.current;
      const shouldRegenerateAvatar = !previousProfile || previousProfile.alias !== trimmed;
      const avatar = shouldRegenerateAvatar
        ? generateRandomAvatar()
        : previousProfile?.avatar ?? generateRandomAvatar();
      const playerId = previousProfile?.playerId ?? ensureLocalPlayerId();

      const profileData = { alias: trimmed, avatar, playerId };
      profileRef.current = profileData;
      setProfile(profileData);
      setJoinState({ status: 'pending', error: null });

      const attemptJoin = () =>
        joinWithProfile(profileData)
          .then((player) => {
            setJoinState({ status: 'ready', error: null });
            return player;
          })
          .catch((error) => {
            setJoinState({ status: 'error', error });
            throw error;
          });

      const socket = socketRef.current;

      if (socket?.connected) {
        return attemptJoin();
      }

      if (!socket) {
        const error = new Error('No se pudo establecer conexión con el servidor.');
        setJoinState({ status: 'error', error });
        return Promise.reject(error);
      }

      if (socket.disconnected && typeof socket.connect === 'function') {
        socket.connect();
      }

      return new Promise((resolve, reject) => {
        const handleConnect = () => {
          cleanup();
          attemptJoin().then(resolve).catch(reject);
        };

        const handleError = (err) => {
          cleanup();
          const error =
            err instanceof Error ? err : new Error('No se pudo conectar con el servidor.');
          setJoinState({ status: 'error', error });
          reject(error);
        };

        const cleanup = () => {
          socket.off('connect', handleConnect);
          socket.off('connect_error', handleError);
        };

        socket.once('connect', handleConnect);
        socket.once('connect_error', handleError);
      });
    },
    [ensureLocalPlayerId, joinWithProfile]
  );

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

      if (profileRef.current) {
        if (joinStateRef.current.status !== 'pending') {
          setJoinState({ status: 'pending', error: null });
        }

        joinWithProfile(profileRef.current)
          .then(() => {
            setJoinState({ status: 'ready', error: null });
          })
          .catch((error) => {
            setJoinState({ status: 'error', error });
          });
      }
    };

    const handleDisconnect = () => {
      setConnectionState({ status: 'disconnected', error: null });

      setJoinState((previous) =>
        previous.status === 'ready' ? { status: 'disconnected', error: null } : previous
      );

      playersRef.current.clear();
      compensatorsRef.current.clear();
      setPlayers([]);
    };

    const handleConnectError = (error) => {
      setConnectionState({ status: 'error', error });

      if (joinStateRef.current.status === 'pending') {
        setJoinState({ status: 'error', error });
      }
    };

    const handleSessionTerminated = (payload) => {
      const reason = payload?.reason ?? 'Sesión terminada';

      setConnectionState({ status: 'terminated', error: reason });
      setJoinState({ status: 'terminated', error: new Error(reason) });
      playersRef.current.clear();
      compensatorsRef.current.clear();
      localPlayerIdRef.current = null;
      setLocalPlayerId(null);
      chatRef.current = [];
      setPlayers([]);
      setChatMessages([]);
    };

    const handlePlayerLeft = (payload) => {
      if (payload?.id) {
        removePlayer(payload.id);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('world:state', applySnapshot);
    socket.on('sprites:atlasUpdated', setSpriteAtlas);
    socket.on('player:joined', applyPlayerSnapshot);
    socket.on('player:updated', applyPlayerSnapshot);
    socket.on('player:left', handlePlayerLeft);
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
      socket.off('player:left', handlePlayerLeft);
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
  }, [appendChatMessage, applyPlayerSnapshot, applySnapshot, joinWithProfile, removePlayer]);

  const updateLocalPlayerState = useCallback(
    (partial) => {
      const baseId = localPlayerIdRef.current ?? localPlayerId;
      const playerId = baseId ?? ensureLocalPlayerId();

      if (!localPlayerIdRef.current) {
        localPlayerIdRef.current = playerId;
      }

      if (localPlayerId !== playerId) {
        setLocalPlayerId(playerId);
      }

      if (profileRef.current && profileRef.current.playerId !== playerId) {
        profileRef.current = { ...profileRef.current, playerId };
        setProfile(profileRef.current);
      }

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

      const alias = profileRef.current?.alias ?? nextState.metadata?.alias ?? null;
      const avatar = profileRef.current?.avatar ?? nextState.metadata?.avatar ?? null;

      let metadata = nextState.metadata;

      if (alias) {
        metadata = mergeMetadata(metadata, { alias });
      }

      if (avatar) {
        metadata = mergeMetadata(metadata, { avatar });
      }

      nextState.metadata = metadata;
      localStateRef.current = nextState;

      const existing = playersRef.current.get(playerId) ?? { id: playerId };
      const displayName = alias ?? existing.name ?? `Tripulante ${playerId.slice(-4)}`;
      const combinedMetadata = mergeMetadata(existing.metadata, metadata);

      const direction =
        typeof combinedMetadata.heading === 'string'
          ? combinedMetadata.heading
          : typeof partial.metadata?.heading === 'string'
            ? partial.metadata.heading
            : 'down';

      const sprite =
        typeof combinedMetadata.avatar?.sprite === 'string'
          ? combinedMetadata.avatar.sprite
          : profileRef.current?.avatar?.sprite ?? null;

      const updatedPlayer = {
        ...existing,
        id: playerId,
        name: displayName,
        position: nextState.position,
        animation: nextState.animation,
        metadata: combinedMetadata,
        direction,
        sprite
      };

      playersRef.current.set(playerId, updatedPlayer);
      ensureCompensator(playerId)?.addSample(nextState.position);

      const socket = socketRef.current;
      if (socket?.connected && joinStateRef.current.status === 'ready') {
        socket.emit('player:update', {
          position: nextState.position,
          animation: nextState.animation,
          metadata: combinedMetadata,
          name: displayName,
          alias: displayName,
          direction,
          sprite,
          avatar: combinedMetadata.avatar ?? null
        });
      }
    },
    [ensureCompensator, localPlayerId]
  );

  const sendChatMessage = useCallback(
    (content) => {
      const socket = socketRef.current;
      const playerId = localPlayerIdRef.current ?? localPlayerId ?? ensureLocalPlayerId();
      const trimmed = typeof content === 'string' ? content.trim() : '';

      if (!socket?.connected || !trimmed || joinStateRef.current.status !== 'ready') {
        return Promise.resolve(null);
      }

      const author = profileRef.current?.alias ?? undefined;

      return new Promise((resolve, reject) => {
        socket.emit(
          'chat:message',
          {
            content: trimmed,
            playerId,
            author
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
    [appendChatMessage, ensureLocalPlayerId, localPlayerId]
  );

  const setAppearance = useCallback((nextAppearance) => {
    setAppearanceState((previous) => {
      const resolved =
        typeof nextAppearance === 'function' ? nextAppearance(previous) : nextAppearance;

      if (!resolved || typeof resolved !== 'object') {
        return previous;
      }

      return { ...DEFAULT_APPEARANCE, ...previous, ...resolved };
    });
  }, []);

  useEffect(() => {
    if (!appearanceState) {
      return;
    }
    updateLocalPlayerState({ metadata: { appearance: appearanceState } });
  }, [appearanceState, updateLocalPlayerState]);

  const value = useMemo(
    () => ({
      connected: connectionState.status === 'connected',
      connectionError: connectionState.error,
      connectionStatus: connectionState.status,
      profile,
      joinStatus: joinState.status,
      joinError: joinState.error,
      joinWorld,
      players,
      localPlayerId,
      spriteAtlas,
      chatMessages,
      sendChatMessage,
      appearance: appearanceState,
      setAppearance,
      updateLocalPlayerState
    }),
    [
      connectionState.error,
      connectionState.status,
      profile,
      joinState.error,
      joinState.status,
      chatMessages,
      localPlayerId,
      players,
      spriteAtlas,
      sendChatMessage,
      appearanceState,
      setAppearance,
      updateLocalPlayerState,
      joinWorld
    ]
  );

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}

export const useWorld = () => {
  return useContext(WorldContext);
};
