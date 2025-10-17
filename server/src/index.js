import http from 'http'
import express from 'express'
import { Server } from 'socket.io'
import dotenv from 'dotenv'

import { connectDatabase } from './config/database.js'
import authRoutes from './routes/authRoutes.js'
import avatarRoutes from './routes/avatarRoutes.js'
import { cookies } from './middlewares/auth.js'

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

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`)

  socket.on('disconnect', (reason) => {
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
