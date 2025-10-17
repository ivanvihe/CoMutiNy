import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'

import sessionManager from '../services/sessionManager.js'
import { getAdapterClients } from '../config/redis.js'

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

    if (origin === 'local' && socketId) {
      const socket = io.sockets.sockets.get(socketId)
      socket?.broadcast.emit('player:joined', player)
    } else {
      io.emit('player:joined', player)
    }
  })

  sessionManager.on('player:updated', ({ player, origin, socketId }) => {
    if (!player?.id) {
      return
    }

    if (origin === 'local' && socketId) {
      const socket = io.sockets.sockets.get(socketId)
      socket?.broadcast.emit('player:updated', player)
    } else {
      io.emit('player:updated', player)
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

    socket.emit('world:state', sessionManager.getSnapshot())

    socket.on('player:join', async (payload, ack) => {
      try {
        const enriched = typeof enrichJoinPayload === 'function'
          ? await enrichJoinPayload(payload)
          : payload

        const player = sessionManager.addPlayer(socket.id, enriched)

        console.log(`Player joined: ${player.id} (${socket.id})`)

        safeAck(ack, { ok: true, state: sessionManager.getSnapshot(), player })
      } catch (error) {
        console.error('player:join failed', error)
        safeAck(ack, { ok: false, message: error.message })
      }
    })

    socket.on('player:update', (payload, ack) => {
      try {
        const player = sessionManager.updatePlayer(socket.id, payload)

        safeAck(ack, { ok: true, player })
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
