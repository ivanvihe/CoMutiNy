const DEFAULT_POSITION = Object.freeze({
  x: 0,
  y: 0,
  z: 0
})

const DEFAULT_ANIMATION = 'idle'
const MAX_CHAT_HISTORY = 50
const APPEARANCE_KEYS = Object.freeze(['hair', 'face', 'outfit', 'shoes'])

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

const sanitizeAppearance = (appearance) => {
  if (!appearance || typeof appearance !== 'object') {
    return {}
  }

  const sanitized = {}

  for (const key of APPEARANCE_KEYS) {
    if (appearance[key] === undefined) {
      continue
    }

    const value = appearance[key]

    if (typeof value === 'string') {
      const trimmed = value.trim()
      sanitized[key] = trimmed ? trimmed.slice(0, 100) : null
    } else if (value === null) {
      sanitized[key] = null
    }
  }

  return sanitized
}

const sanitizeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') {
    return {}
  }

  const sanitized = {}

  if (metadata.avatarId !== undefined) {
    if (typeof metadata.avatarId === 'string') {
      const trimmed = metadata.avatarId.trim()
      if (trimmed) {
        sanitized.avatarId = trimmed
      }
    }
  }

  const appearance = sanitizeAppearance(metadata.appearance)

  if (Object.keys(appearance).length > 0) {
    sanitized.appearance = appearance
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'appearance' || key === 'avatarId') {
      continue
    }

    sanitized[key] = value
  }

  return sanitized
}

const mergeMetadata = (current, incoming) => {
  const base = current && typeof current === 'object' ? { ...current } : {}
  const sanitizedIncoming = sanitizeMetadata(incoming)

  if (sanitizedIncoming.avatarId !== undefined) {
    base.avatarId = sanitizedIncoming.avatarId
  }

  if (sanitizedIncoming.appearance) {
    const currentAppearance =
      base.appearance && typeof base.appearance === 'object' ? { ...base.appearance } : {}

    base.appearance = { ...currentAppearance, ...sanitizedIncoming.appearance }
  }

  for (const [key, value] of Object.entries(sanitizedIncoming)) {
    if (key === 'appearance' || key === 'avatarId') {
      continue
    }

    base[key] = value
  }

  return base
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

const createSystemMessage = () => ({
  id: generateMessageId(),
  playerId: 'system',
  author: 'System',
  content: 'Hello World',
  timestamp: new Date().toISOString()
})

class WorldState {
  constructor () {
    this.world = HELLO_WORLD
    this.playersById = new Map()
    this.socketToPlayer = new Map()
    this.playerToSocket = new Map()
    this.chat = [createSystemMessage()]
    this.spriteAtlas = {
      version: 1,
      updatedAt: null,
      sprites: [],
      lookup: {}
    }
  }

  getWorld () {
    return this.world
  }

  setWorld (world) {
    if (!world || typeof world !== 'object') {
      return
    }

    const id = typeof world.id === 'string' && world.id.trim() ? world.id.trim() : HELLO_WORLD.id
    const name =
      typeof world.name === 'string' && world.name.trim()
        ? world.name.trim().slice(0, 100)
        : HELLO_WORLD.name
    const description =
      typeof world.description === 'string' && world.description.trim()
        ? world.description.trim().slice(0, 500)
        : HELLO_WORLD.description

    this.world = {
      id,
      name,
      description
    }
  }

  getSpriteAtlas () {
    return JSON.parse(JSON.stringify(this.spriteAtlas))
  }

  setSpriteAtlas (atlas) {
    if (!atlas || typeof atlas !== 'object') {
      return
    }

    const parsedVersion = Number(atlas.version)
    const sprites = Array.isArray(atlas.sprites) ? atlas.sprites.map((sprite) => ({ ...sprite })) : []
    const lookup = {}

    for (const sprite of sprites) {
      if (sprite?.id) {
        lookup[sprite.id] = { ...sprite }
      }
    }

    this.spriteAtlas = {
      version: Number.isFinite(parsedVersion) ? parsedVersion : 1,
      updatedAt: typeof atlas.updatedAt === 'string' ? atlas.updatedAt : new Date().toISOString(),
      sprites,
      lookup
    }
  }

  getSnapshot () {
    return {
      world: this.getWorld(),
      players: Array.from(this.playersById.values()).map((player) => ({ ...player })),
      chat: [...this.chat],
      spriteAtlas: this.getSpriteAtlas()
    }
  }

  getPlayerBySocket (socketId) {
    const playerId = this.socketToPlayer.get(socketId)

    if (!playerId) {
      return null
    }

    const player = this.playersById.get(playerId)

    return player ? { ...player } : null
  }

  getPlayerById (playerId) {
    const player = this.playersById.get(playerId)

    return player ? { ...player } : null
  }

  getSocketIdForPlayer (playerId) {
    return this.playerToSocket.get(playerId) ?? null
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

    const existingSocketId = this.playerToSocket.get(playerId)

    if (existingSocketId && existingSocketId !== socketId) {
      this.socketToPlayer.delete(existingSocketId)
      this.playerToSocket.delete(playerId)
    }

    const metadata = mergeMetadata({}, payload.metadata)

    const player = {
      id: playerId,
      name,
      position,
      animation,
      metadata
    }

    this.playersById.set(playerId, player)
    this.socketToPlayer.set(socketId, playerId)
    this.playerToSocket.set(playerId, socketId)

    return { ...player }
  }

  updatePlayer (socketId, payload = {}) {
    const playerId = this.socketToPlayer.get(socketId)

    if (!playerId) {
      throw new Error('Player not registered')
    }

    const player = this.playersById.get(playerId)

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
      player.metadata = mergeMetadata(player.metadata, payload.metadata)
    }

    this.playersById.set(player.id, player)

    return { ...player }
  }

  removePlayer (socketId) {
    const playerId = this.socketToPlayer.get(socketId)

    if (!playerId) {
      return null
    }

    this.socketToPlayer.delete(socketId)

    const controllingSocketId = this.playerToSocket.get(playerId)

    if (controllingSocketId && controllingSocketId !== socketId) {
      return null
    }

    this.playerToSocket.delete(playerId)

    const player = this.playersById.get(playerId)

    if (!player) {
      return null
    }

    this.playersById.delete(playerId)

    return { ...player }
  }

  removePlayerById (playerId) {
    if (!playerId) {
      return null
    }

    const socketId = this.playerToSocket.get(playerId)

    if (socketId) {
      this.socketToPlayer.delete(socketId)
      this.playerToSocket.delete(playerId)
    }

    const player = this.playersById.get(playerId)

    if (!player) {
      return null
    }

    this.playersById.delete(playerId)

    return { ...player }
  }

  upsertPlayerSnapshot (payload = {}) {
    if (!payload?.id) {
      return null
    }

    const fallbackName = `Player ${payload.id}`
    const name = sanitizeName(payload.name, fallbackName)
    const position = sanitizePosition(payload.position)
    const animation = sanitizeAnimation(payload.animation)
    const metadata = mergeMetadata({}, payload.metadata)

    const player = {
      id: payload.id,
      name,
      position,
      animation,
      metadata
    }

    this.playersById.set(player.id, player)

    return { ...player }
  }

  addChatMessage ({ socketId, playerId, author, content }) {
    const player = socketId ? this.getPlayerBySocket(socketId) : null
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

  addChatMessageSnapshot (message = {}) {
    if (!message?.id) {
      return null
    }

    const sanitized = {
      id: message.id,
      playerId: message.playerId,
      author: sanitizeName(message.author, message.playerId ? `Player ${message.playerId}` : 'Player'),
      content: sanitizeMessageContent(message.content),
      timestamp: typeof message.timestamp === 'string' ? message.timestamp : new Date().toISOString()
    }

    this.chat.push(sanitized)

    if (this.chat.length > MAX_CHAT_HISTORY) {
      this.chat.splice(0, this.chat.length - MAX_CHAT_HISTORY)
    }

    return { ...sanitized }
  }

  hydrateSnapshot (snapshot = {}) {
    if (snapshot.world) {
      this.setWorld(snapshot.world)
    }

    this.playersById.clear()
    this.socketToPlayer.clear()
    this.playerToSocket.clear()

    if (Array.isArray(snapshot.players)) {
      for (const player of snapshot.players) {
        this.upsertPlayerSnapshot(player)
      }
    }

    this.chat = []

    if (Array.isArray(snapshot.chat)) {
      for (const message of snapshot.chat) {
        this.addChatMessageSnapshot(message)
      }
    }

    if (this.chat.length === 0) {
      this.chat.push(createSystemMessage())
    }

    if (snapshot.spriteAtlas) {
      this.setSpriteAtlas(snapshot.spriteAtlas)
    }
  }
}

const worldState = new WorldState()

export { WorldState }
export default worldState
