import http from 'http'
import express from 'express'
import { Server } from 'socket.io'
import dotenv from 'dotenv'

import { connectDatabase } from './config/database.js'

dotenv.config()

const app = express()

app.use(express.json())
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
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
