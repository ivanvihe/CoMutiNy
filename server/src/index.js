import http from 'http'
import express from 'express'
import { Server } from 'socket.io'
import dotenv from 'dotenv'

import { connectDatabase } from './config/database.js'
import authRoutes from './routes/authRoutes.js'
import avatarRoutes from './routes/avatarRoutes.js'
import { cookies } from './middlewares/auth.js'
import worldState from './services/worldState.js'

dotenv.config()

const app = express()

app.use(express.json())
app.use(cookies)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.use('/auth', authRoutes)
app.use('/avatars', avatarRoutes)

app.use((err, req, res, next) => {
  console.error(err)

  if (res.headersSent) {
    return next(err)
  }

  res.status(err?.status ?? 500).json({
    message: err?.message ?? 'Internal server error'
  })
})

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  }
})

const safeAck = (ack, payload) => {
  if (typeof ack === 'function') {
    ack(payload)
  }
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`)

  socket.emit('world:state', worldState.getSnapshot())

  socket.on('player:join', (payload, ack) => {
    try {
      const player = worldState.addPlayer(socket.id, payload)
      socket.data.playerId = player.id

      console.log(`Player joined: ${player.id} (${socket.id})`)

      safeAck(ack, { ok: true, state: worldState.getSnapshot(), player })
      socket.broadcast.emit('player:joined', player)
    } catch (error) {
      console.error('player:join failed', error)
      safeAck(ack, { ok: false, message: error.message })
    }
  })

  socket.on('player:update', (payload, ack) => {
    try {
      const player = worldState.updatePlayer(socket.id, payload)

      safeAck(ack, { ok: true, player })
      socket.broadcast.emit('player:updated', player)
    } catch (error) {
      console.error('player:update failed', error)
      safeAck(ack, { ok: false, message: error.message })
    }
  })

  socket.on('chat:message', (payload, ack) => {
    try {
      const message = worldState.addChatMessage({
        socketId: socket.id,
        playerId: payload?.playerId,
        author: payload?.author,
        content: payload?.content
      })

      io.emit('chat:message', message)
      safeAck(ack, { ok: true, message })
    } catch (error) {
      console.error('chat:message failed', error)
      safeAck(ack, { ok: false, message: error.message })
    }
  })

  socket.on('player:leave', (ack) => {
    const removed = worldState.removePlayer(socket.id)

    if (removed) {
      console.log(`Player left: ${removed.id} (${socket.id})`)
      socket.broadcast.emit('player:left', { id: removed.id })
    }

    safeAck(ack, { ok: true })
  })

  socket.on('disconnect', (reason) => {
    const removed = worldState.removePlayer(socket.id)

    if (removed) {
      console.log(`Player disconnected: ${removed.id} (${socket.id})`)
      socket.broadcast.emit('player:left', { id: removed.id })
    }

    console.log(`Socket disconnected: ${socket.id} (${reason})`)
  })
})

const PORT = Number(process.env.SERVER_PORT || 4000)

const start = async () => {
  try {
    await connectDatabase()
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`)
    })
  } catch (error) {
    process.exitCode = 1
  }
}

start()
