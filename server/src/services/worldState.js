const DEFAULT_POSITION = Object.freeze({
  x: 0,
  y: 0,
  z: 0
})

const DEFAULT_ANIMATION = 'idle'
const MAX_CHAT_HISTORY = 50

const HELLO_WORLD = Object.freeze({
  id: 'hello-world',
  name: 'Hello World',
  description: 'Demo scene for initial multiplayer tests'
})

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

const sanitizePosition = (position = DEFAULT_POSITION) => {
  if (!position || typeof position !== 'object') {
    return { ...DEFAULT_POSITION }
  }

  return {
    x: toNumber(position.x, DEFAULT_POSITION.x),
    y: toNumber(position.y, DEFAULT_POSITION.y),
    z: toNumber(position.z, DEFAULT_POSITION.z)
  }
}

const sanitizeAnimation = (animation) => {
  if (typeof animation !== 'string' || !animation.trim()) {
    return DEFAULT_ANIMATION
  }

  return animation.trim()
}

const sanitizeName = (name, fallback) => {
  if (typeof name !== 'string' || !name.trim()) {
    return fallback
  }

  return name.trim().slice(0, 100)
}

const sanitizeMessageContent = (content) => {
  const text = typeof content === 'string' ? content : ''
  const trimmed = text.trim()

  if (!trimmed) {
    throw new Error('Message cannot be empty')
  }

  return trimmed.slice(0, 500)
}

const generateMessageId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

class WorldState {
  constructor () {
    this.world = HELLO_WORLD
    this.playersBySocket = new Map()
    this.chat = [
      {
        id: generateMessageId(),
        playerId: 'system',
        author: 'System',
        content: 'Hello World',
        timestamp: new Date().toISOString()
      }
    ]
  }

  getWorld () {
    return this.world
  }

  getSnapshot () {
    return {
      world: this.getWorld(),
      players: Array.from(this.playersBySocket.values()).map((player) => ({ ...player })),
      chat: [...this.chat]
    }
  }

  getPlayerBySocket (socketId) {
    return this.playersBySocket.get(socketId)
  }

  addPlayer (socketId, payload = {}) {
    const playerId = typeof payload.playerId === 'string' ? payload.playerId.trim() : ''

    if (!playerId) {
      throw new Error('playerId is required')
    }

    const fallbackName = `Player ${playerId}`
    const name = sanitizeName(payload.name, fallbackName)
    const position = sanitizePosition(payload.position)
    const animation = sanitizeAnimation(payload.animation)

    for (const [existingSocketId, existingPlayer] of this.playersBySocket.entries()) {
      if (existingPlayer.id === playerId && existingSocketId !== socketId) {
        this.playersBySocket.delete(existingSocketId)
      }
    }

    const player = {
      id: playerId,
      name,
      position,
      animation,
      metadata: typeof payload.metadata === 'object' && payload.metadata !== null ? { ...payload.metadata } : {}
    }

    this.playersBySocket.set(socketId, player)

    return { ...player }
  }

  updatePlayer (socketId, payload = {}) {
    const player = this.playersBySocket.get(socketId)

    if (!player) {
      throw new Error('Player not registered')
    }

    if (payload.position) {
      player.position = sanitizePosition(payload.position)
    }

    if (payload.animation) {
      player.animation = sanitizeAnimation(payload.animation)
    }

    if (typeof payload.name === 'string') {
      player.name = sanitizeName(payload.name, player.name)
    }

    if (payload.metadata && typeof payload.metadata === 'object') {
      player.metadata = { ...player.metadata, ...payload.metadata }
    }

    return { ...player }
  }

  removePlayer (socketId) {
    const player = this.playersBySocket.get(socketId)

    if (!player) {
      return null
    }

    this.playersBySocket.delete(socketId)

    return { ...player }
  }

  addChatMessage ({ socketId, playerId, author, content }) {
    const player = socketId ? this.playersBySocket.get(socketId) : null
    const resolvedPlayerId = typeof playerId === 'string' && playerId.trim() ? playerId.trim() : player?.id

    if (!resolvedPlayerId) {
      throw new Error('playerId is required for chat messages')
    }

    const resolvedAuthor = sanitizeName(author ?? player?.name, `Player ${resolvedPlayerId}`)
    const sanitizedContent = sanitizeMessageContent(content)

    const message = {
      id: generateMessageId(),
      playerId: resolvedPlayerId,
      author: resolvedAuthor,
      content: sanitizedContent,
      timestamp: new Date().toISOString()
    }

    this.chat.push(message)

    if (this.chat.length > MAX_CHAT_HISTORY) {
      this.chat.splice(0, this.chat.length - MAX_CHAT_HISTORY)
    }

    return { ...message }
  }
}

const worldState = new WorldState()

export { WorldState }
export default worldState
