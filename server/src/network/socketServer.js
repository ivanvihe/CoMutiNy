import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'

import sessionManager from '../services/sessionManager.js'
import { getAdapterClients } from '../config/redis.js'

const directionFallback = (direction) => {
  if (typeof direction !== 'string') {
    return 'down'
  }

  const normalised = direction.trim().toLowerCase()
  switch (normalised) {
    case 'up':
    case 'down':
    case 'left':
    case 'right':
      return normalised
    default:
      return 'down'
  }
}

const sanitizePlayerMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') {
    return {}
  }

  const { mapId, ...rest } = metadata
  return { ...rest }
}

const serializePlayer = (player) => {
  if (!player || typeof player !== 'object') {
    return null
  }

  const metadata = sanitizePlayerMetadata(player.metadata)
  const alias = typeof player.alias === 'string' && player.alias.trim()
    ? player.alias.trim()
    : typeof metadata.alias === 'string' && metadata.alias.trim()
      ? metadata.alias.trim()
      : typeof player.name === 'string' && player.name.trim()
        ? player.name.trim()
        : null

  if (alias) {
    metadata.alias = alias
  }

  const avatar =
    metadata.avatar && typeof metadata.avatar === 'object'
      ? { ...metadata.avatar }
      : player.avatar && typeof player.avatar === 'object'
        ? { ...player.avatar }
        : null

  if (avatar) {
    metadata.avatar = { ...avatar }
  }

  const sprite =
    typeof player.sprite === 'string' && player.sprite.trim()
      ? player.sprite.trim()
      : typeof metadata.avatar?.sprite === 'string' && metadata.avatar.sprite.trim()
        ? metadata.avatar.sprite.trim()
        : null

  if (sprite) {
    metadata.avatar = { ...(metadata.avatar ?? {}), sprite }
  }

  const position = player.position && typeof player.position === 'object'
    ? {
        x: Number(player.position.x) || 0,
        y: Number(player.position.y) || 0,
        z: Number(player.position.z) || 0
      }
    : { x: 0, y: 0, z: 0 }

  return {
    id: player.id,
    name: player.name,
    alias: alias ?? player.name ?? null,
    position,
    animation: player.animation ?? 'idle',
    direction: directionFallback(player.direction ?? metadata.heading),
    metadata,
    avatar: metadata.avatar ?? null,
    sprite
  }
}

const serializeSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return { world: null, players: [], chat: [], spriteAtlas: null }
  }

  const players = Array.isArray(snapshot.players)
    ? snapshot.players
      .map((player) => serializePlayer(player))
      .filter(Boolean)
    : []

  return {
    world: snapshot.world ?? null,
    players,
    chat: Array.isArray(snapshot.chat) ? [...snapshot.chat] : [],
    spriteAtlas: snapshot.spriteAtlas ?? null
  }
}

const safeAck = (ack, payload) => {
  if (typeof ack === 'function') {
    ack(payload)
  }
}

const attachSessionListeners = (io) => {
  sessionManager.on('player:joined', ({ player, origin, socketId }) => {
    if (!player?.id) {
      return
    }

    const payload = serializePlayer(player)

    if (!payload) {
      return
    }

    if (origin === 'local' && socketId) {
      const socket = io.sockets.sockets.get(socketId)
      socket?.broadcast.emit('player:joined', payload)
    } else {
      io.emit('player:joined', payload)
    }
  })

  sessionManager.on('player:updated', ({ player, origin, socketId }) => {
    if (!player?.id) {
      return
    }

    const payload = serializePlayer(player)

    if (!payload) {
      return
    }

    if (origin === 'local' && socketId) {
      const socket = io.sockets.sockets.get(socketId)
      socket?.broadcast.emit('player:updated', payload)
    } else {
      io.emit('player:updated', payload)
    }
  })

  sessionManager.on('player:left', ({ player, origin, socketId }) => {
    if (!player?.id) {
      return
    }

    const payload = { id: player.id }

    if (origin === 'local' && socketId) {
      const socket = io.sockets.sockets.get(socketId)
      socket?.broadcast.emit('player:left', payload)
    } else {
      io.emit('player:left', payload)
    }
  })

  sessionManager.on('chat:message', ({ message }) => {
    if (!message?.id) {
      return
    }

    io.emit('chat:message', message)
  })

  sessionManager.on('sprites:atlasUpdated', ({ atlas }) => {
    if (!atlas) {
      return
    }

    io.emit('sprites:atlasUpdated', atlas)
  })

  sessionManager.on('session:disconnect', ({ socketId, reason }) => {
    if (!socketId) {
      return
    }

    const socket = io.sockets.sockets.get(socketId)

    if (socket) {
      socket.emit('session:terminated', { reason: reason ?? 'remote:disconnect' })
      socket.disconnect(true)
    }
  })
}

const createSocketServer = (httpServer, { corsOrigin, enrichJoinPayload }) => {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin || '*'
    }
  })

  const adapterClients = getAdapterClients()

  if (adapterClients?.pubClient && adapterClients?.subClient) {
    io.adapter(createAdapter(adapterClients.pubClient, adapterClients.subClient))
  }

  attachSessionListeners(io)

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`)

    socket.emit('world:state', serializeSnapshot(sessionManager.getSnapshot()))

    socket.on('player:join', async (payload, ack) => {
      try {
        const enriched = typeof enrichJoinPayload === 'function'
          ? await enrichJoinPayload(payload)
          : payload

        const player = sessionManager.addPlayer(socket.id, enriched)

        console.log(`Player joined: ${player.id} (${socket.id})`)

        safeAck(ack, {
          ok: true,
          state: serializeSnapshot(sessionManager.getSnapshot()),
          player: serializePlayer(player)
        })
      } catch (error) {
        console.error('player:join failed', error)
        safeAck(ack, { ok: false, message: error.message })
      }
    })

    socket.on('player:update', (payload, ack) => {
      try {
        const player = sessionManager.updatePlayer(socket.id, payload)

        safeAck(ack, { ok: true, player: serializePlayer(player) })
      } catch (error) {
        console.error('player:update failed', error)
        safeAck(ack, { ok: false, message: error.message })
      }
    })

    socket.on('chat:message', (payload, ack) => {
      try {
        const message = sessionManager.addChatMessage({
          ...payload,
          socketId: socket.id
        })

        safeAck(ack, { ok: true, message })
      } catch (error) {
        console.error('chat:message failed', error)
        safeAck(ack, { ok: false, message: error.message })
      }
    })

    socket.on('player:leave', (ack) => {
      try {
        const removed = sessionManager.removePlayer(socket.id, 'client:leave')

        if (removed) {
          console.log(`Player left: ${removed.id} (${socket.id})`)
        }

        safeAck(ack, { ok: true })
      } catch (error) {
        console.error('player:leave failed', error)
        safeAck(ack, { ok: false, message: error.message })
      }
    })

    socket.on('disconnect', (reason) => {
      const removed = sessionManager.removePlayer(socket.id, reason || 'client:disconnect')

      if (removed) {
        console.log(`Player disconnected: ${removed.id} (${socket.id})`)
      }

      console.log(`Socket disconnected: ${socket.id} (${reason})`)
    })
  })

  return io
}

export default createSocketServer
