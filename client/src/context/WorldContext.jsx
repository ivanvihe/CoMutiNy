import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import LagCompensator from '../utils/lagCompensation.js';
import resolveServerUrl from '../utils/resolveServerUrl.js';
import { buildInteractionRequest, normaliseInteractionEvent } from '../game/interaction/index.js';
import {
  DEFAULT_APPEARANCE as STORED_DEFAULT_APPEARANCE,
  getUserPreferences as getStoredPreferences,
  updateUserPreferences as persistUserPreferences
} from '../state/userPreferences.js';
import {
  DEFAULT_CHARACTER_APPEARANCE,
  listAvailableAccentColors,
  listAvailableMeshes,
  listAvailableTextures,
  listAvailableVisorColors,
  normaliseCharacterAppearance
} from '../game/characters/customization.js';

const DEFAULT_APPEARANCE = normaliseCharacterAppearance({
  ...DEFAULT_CHARACTER_APPEARANCE,
  ...STORED_DEFAULT_APPEARANCE
});

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
  updateLocalPlayerState: () => {},
  interactWithObject: () => Promise.resolve({ ok: false }),
  lastObjectEvent: null,
  getSocket: () => null
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

const TEXTURE_IDS = listAvailableTextures().map((item) => item.id);
const MESH_IDS = listAvailableMeshes().map((item) => item.id);
const VISOR_COLORS = listAvailableVisorColors();
const ACCENT_COLORS = listAvailableAccentColors();

const pickRandom = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index];
};

const generateRandomAppearance = () =>
  normaliseCharacterAppearance({
    texture: pickRandom(TEXTURE_IDS) ?? DEFAULT_APPEARANCE.texture,
    mesh: pickRandom(MESH_IDS) ?? DEFAULT_APPEARANCE.mesh,
    visorColor: pickRandom(VISOR_COLORS) ?? DEFAULT_APPEARANCE.visorColor,
    accentColor: pickRandom(ACCENT_COLORS) ?? DEFAULT_APPEARANCE.accentColor
  });

const generateRandomAvatar = () => {
  const appearance = generateRandomAppearance();
  return {
    sprite: appearance.texture,
    texture: appearance.texture,
    mesh: appearance.mesh,
    visorColor: appearance.visorColor,
    accentColor: appearance.accentColor
  };
};

const generateClientPlayerId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `client-${crypto.randomUUID()}`;
  }

  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `client-${timestamp}${random}`;
};

const normaliseProfilePayload = (candidate) => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const alias = typeof candidate.alias === 'string' ? candidate.alias.trim() : '';
  if (!alias) {
    return null;
  }

  const avatar = candidate.avatar && typeof candidate.avatar === 'object' ? candidate.avatar : null;
  const mapId =
    typeof candidate.mapId === 'string' && candidate.mapId.trim() ? candidate.mapId.trim() : null;
  const playerId =
    typeof candidate.playerId === 'string' && candidate.playerId.trim()
      ? candidate.playerId.trim()
      : typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id.trim()
        : null;

  return {
    alias,
    ...(avatar ? { avatar } : {}),
    ...(mapId ? { mapId } : {}),
    ...(playerId ? { playerId } : {})
  };
};

export function WorldProvider({ children }) {
  const initialBootstrapProfile = (() => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const candidate = normaliseProfilePayload(window.__COMMUNITY_BOOTSTRAP_PROFILE__);
      if (!candidate) {
        return null;
      }

      return {
        ...candidate,
        playerId: candidate.playerId ?? generateClientPlayerId()
      };
    } catch (error) {
      console.warn('No se pudo inicializar el perfil precargado.', error);
      return null;
    }
  })();

  if (initialBootstrapProfile && typeof window !== 'undefined') {
    window.__COMMUNITY_PROFILE_READY__ = true;
  }

  const [connectionState, setConnectionState] = useState({ status: 'idle', error: null });
  const [players, setPlayers] = useState([]);
  const [localPlayerId, setLocalPlayerId] = useState(
    () => initialBootstrapProfile?.playerId ?? null
  );
  const [spriteAtlas, setSpriteAtlas] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [profile, setProfile] = useState(initialBootstrapProfile);
  const [joinState, setJoinState] = useState(() =>
    initialBootstrapProfile ? { status: 'ready', error: null } : { status: 'idle', error: null }
  );
  const [appearanceState, setAppearanceState] = useState(() => {
    const stored = getStoredPreferences();
    return normaliseCharacterAppearance({
      ...DEFAULT_APPEARANCE,
      ...(stored.appearance ?? {})
    });
  });
  const [lastObjectEvent, setLastObjectEvent] = useState(null);

  const socketRef = useRef(null);
  const localPlayerIdRef = useRef(initialBootstrapProfile?.playerId ?? null);
  const profileRef = useRef(initialBootstrapProfile);
  const joinStateRef = useRef(
    initialBootstrapProfile ? { status: 'ready', error: null } : { status: 'idle', error: null }
  );
  const playersRef = useRef(new Map());
  const compensatorsRef = useRef(new Map());
  const chatRef = useRef([]);
  const objectEventRef = useRef(null);
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

  useEffect(() => {
    if (profileRef.current?.alias) {
      return undefined;
    }

    let cancelled = false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

    const applyInitialProfile = (candidate) => {
      if (cancelled || profileRef.current?.alias) {
        return;
      }

      const normalised = normaliseProfilePayload(candidate);
      if (!normalised) {
        return;
      }

      const resolvedPlayerId =
        normalised.playerId ?? localPlayerIdRef.current ?? generateClientPlayerId();

      const nextProfile = {
        ...normalised,
        playerId: resolvedPlayerId
      };

      profileRef.current = nextProfile;
      setProfile(nextProfile);

      if (!localPlayerIdRef.current) {
        localPlayerIdRef.current = resolvedPlayerId;
        setLocalPlayerId(resolvedPlayerId);
      }

      setJoinState((previous) => {
        if (previous.status === 'idle') {
          return { status: 'ready', error: null };
        }
        return previous;
      });

      if (typeof window !== 'undefined') {
        window.__COMMUNITY_PROFILE_READY__ = true;
      }
    };

    if (typeof window !== 'undefined') {
      const bootstrapProfile = window.__COMMUNITY_BOOTSTRAP_PROFILE__;
      if (bootstrapProfile && typeof bootstrapProfile === 'object') {
        applyInitialProfile(bootstrapProfile);
      }
    }

    if (profileRef.current?.alias || typeof fetch !== 'function') {
      return () => {
        cancelled = true;
        if (controller) {
          controller.abort();
        }
      };
    }

    const loadProfile = async () => {
      try {
        const response = await fetch('/auth/me', { signal: controller?.signal });
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        applyInitialProfile(payload?.user ?? payload ?? null);
      } catch (error) {
        console.warn('No se pudo obtener la sesión del usuario actual.', error);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
      if (controller) {
        controller.abort();
      }
    };
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
    const displayName = alias ?? player.name ?? existing.name ?? `Usuario ${player.id.slice(-4)}`;

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

    const now = Date.now();
    const timestampValue =
      typeof message.timestamp === 'string' || message.timestamp instanceof Date
        ? new Date(message.timestamp).getTime()
        : Number.isFinite(message.timestamp)
          ? Number(message.timestamp)
          : null;
    const resolvedTimestamp = Number.isFinite(timestampValue) ? timestampValue : now;

    chatRef.current = (() => {
      const existingIndex = chatRef.current.findIndex((entry) => entry.id === message.id);
      const existing = existingIndex >= 0 ? chatRef.current[existingIndex] : null;
      const payload = {
        id: message.id,
        playerId: message.playerId ?? null,
        author: message.author ?? 'Usuario',
        content: message.content ?? '',
        timestamp: message.timestamp ?? new Date().toISOString(),
        receivedAt: existing?.receivedAt ?? now,
        occurredAt: resolvedTimestamp
      };

      if (existingIndex >= 0) {
        const next = [...chatRef.current];
        const previous = next[existingIndex];
        next[existingIndex] = {
          ...previous,
          ...payload,
          receivedAt: payload.receivedAt ?? previous.receivedAt ?? now
        };
        return next;
      }

      const next = [...chatRef.current, { ...payload, receivedAt: now }];

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
            author: entry.author ?? 'Usuario',
            content: entry.content ?? '',
            timestamp: entry.timestamp ?? new Date().toISOString(),
            receivedAt: Date.now() - 4000,
            occurredAt:
              typeof entry.timestamp === 'string' || entry.timestamp instanceof Date
                ? new Date(entry.timestamp).getTime()
                : Number.isFinite(entry.timestamp)
                  ? Number(entry.timestamp)
                  : null
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
      const mapId =
        typeof profileData?.mapId === 'string' && profileData.mapId.trim()
          ? profileData.mapId.trim()
          : null;

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
        playerId: desiredId,
        ...(mapId ? { mapId } : {})
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
            sprite,
            ...(mapId ? { mapId } : {})
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

            const resolvedWorldId = ack.state?.world?.id ?? mapId ?? null;

            const resolvedProfile = {
              alias: resolvedAlias,
              avatar: resolvedAvatar,
              playerId: resolvedId,
              ...(resolvedWorldId ? { mapId: resolvedWorldId } : {})
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
    (input) => {
      const aliasSource =
        typeof input === 'string'
          ? input
          : typeof input?.alias === 'string'
            ? input.alias
            : '';
      const trimmed = typeof aliasSource === 'string' ? aliasSource.trim() : '';
      const requestedMapId =
        typeof input === 'object' && input !== null && typeof input.mapId === 'string'
          ? input.mapId.trim()
          : '';
      const mapId = requestedMapId || profileRef.current?.mapId || null;

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

      const profileData = {
        alias: trimmed,
        avatar,
        playerId,
        ...(mapId ? { mapId } : {})
      };
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

    const url = resolveServerUrl();

    if (!url) {
      return undefined;
    }

    if (window.__COMMUNITY_DISABLE_SOCKET__) {
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
    const handleObjectEvent = (payload) => {
      if (!payload) {
        return;
      }

      const event = normaliseInteractionEvent(payload);
      objectEventRef.current = event;
      setLastObjectEvent(event);
    };

    socket.on('session:terminated', handleSessionTerminated);
    socket.on('object:event', handleObjectEvent);

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
      socket.off('object:event', handleObjectEvent);
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
      const displayName = alias ?? existing.name ?? `Usuario ${playerId.slice(-4)}`;
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

  const interactWithObject = useCallback(
    (payload = {}) => {
      const socket = socketRef.current;
      if (!socket || socket.disconnected) {
        return Promise.reject(new Error('No hay conexión activa con el servidor.'));
      }

      const request = buildInteractionRequest({
        objectId: payload.objectId,
        mapId: payload.mapId ?? profileRef.current?.mapId,
        action: payload.action
      });

      if (!request.objectId) {
        return Promise.reject(new Error('No se encontró el objeto solicitado.'));
      }

      return new Promise((resolve, reject) => {
        socket.emit('object:interact', request, (ack) => {
          if (!ack?.ok) {
            reject(new Error(ack?.message ?? 'No se pudo interactuar con el objeto.'));
            return;
          }

          const event = ack.event ? normaliseInteractionEvent(ack.event) : null;
          if (event) {
            objectEventRef.current = event;
            setLastObjectEvent(event);
          }

          resolve({
            ...ack,
            event,
            message: ack.message ?? null,
            effects: Array.isArray(ack.effects) ? ack.effects : []
          });
        });
      });
    },
    []
  );

  const setAppearance = useCallback((nextAppearance) => {
    setAppearanceState((previous) => {
      const resolved =
        typeof nextAppearance === 'function' ? nextAppearance(previous) : nextAppearance;

      if (!resolved || typeof resolved !== 'object') {
        return previous;
      }

      return normaliseCharacterAppearance({
        ...DEFAULT_APPEARANCE,
        ...previous,
        ...resolved
      });
    });
  }, []);

  useEffect(() => {
    if (!appearanceState) {
      return;
    }
    updateLocalPlayerState({ metadata: { appearance: appearanceState } });
  }, [appearanceState, updateLocalPlayerState]);

  useEffect(() => {
    if (!appearanceState) {
      return;
    }
    persistUserPreferences({ appearance: appearanceState });
  }, [appearanceState]);

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
      updateLocalPlayerState,
      interactWithObject,
      lastObjectEvent,
      getSocket: () => socketRef.current
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
      joinWorld,
      interactWithObject,
      lastObjectEvent
    ]
  );

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}

export const useWorld = () => {
  return useContext(WorldContext);
};
