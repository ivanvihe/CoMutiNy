import crypto from 'node:crypto'

const DEFAULT_POSITION = Object.freeze({
  x: 0,
  y: 0,
  z: 0
})

const DEFAULT_ANIMATION = 'idle'
const MAX_CHAT_HISTORY = 50
const APPEARANCE_KEYS = Object.freeze(['hair', 'face', 'outfit', 'shoes'])
const VALID_DIRECTIONS = new Set(['up', 'down', 'left', 'right'])

const DEFAULT_SIZE = Object.freeze({
  width: 48,
  height: 48
})

const DEFAULT_SPAWN = Object.freeze({
  x: 24,
  y: 24,
  z: 0
})

const DEFAULT_THEME = Object.freeze({ borderColour: null })

const HELLO_WORLD = Object.freeze({
  id: 'hello_world',
  name: 'Hello world! Welcome to the CoMutiNy',
  description: '',
  size: DEFAULT_SIZE,
  spawn: DEFAULT_SPAWN,
  biome: 'Comunidad',
  blockedAreas: [],
  objects: [],
  portals: [],
  theme: DEFAULT_THEME,
  sourcePath: 'server/maps/init.map'
})

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

const sanitizePosition = (position, fallback = DEFAULT_POSITION) => {
  const base = fallback && typeof fallback === 'object'
    ? {
        x: toNumber(fallback.x, DEFAULT_POSITION.x),
        y: toNumber(fallback.y, DEFAULT_POSITION.y),
        z: toNumber(fallback.z, DEFAULT_POSITION.z)
      }
    : { ...DEFAULT_POSITION }

  if (!position || typeof position !== 'object') {
    return { ...base }
  }

  return {
    x: toNumber(position.x, base.x),
    y: toNumber(position.y, base.y),
    z: toNumber(position.z, base.z)
  }
}

const sanitizeAnimation = (animation) => {
  if (typeof animation !== 'string' || !animation.trim()) {
    return DEFAULT_ANIMATION
  }

  return animation.trim()
}

const sanitizeDirection = (direction, fallback = 'down') => {
  if (typeof direction !== 'string') {
    return fallback
  }

  const trimmed = direction.trim().toLowerCase()

  if (VALID_DIRECTIONS.has(trimmed)) {
    return trimmed
  }

  return fallback
}

const sanitizeSpriteId = (sprite) => {
  if (typeof sprite !== 'string') {
    return null
  }

  const trimmed = sprite.trim()

  if (!trimmed) {
    return null
  }

  return trimmed.slice(0, 100)
}

const sanitizeName = (name, fallback) => {
  if (typeof name !== 'string' || !name.trim()) {
    return fallback
  }

  return name.trim().slice(0, 100)
}

const generatePlayerId = (fallback) => {
  if (fallback) {
    return fallback
  }

  if (typeof crypto.randomUUID === 'function') {
    return `player-${crypto.randomUUID()}`
  }

  return `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
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

  if (metadata.alias !== undefined) {
    const alias = sanitizeName(metadata.alias, null)

    if (alias) {
      sanitized.alias = alias
    }
  }

  if (metadata.heading !== undefined) {
    sanitized.heading = sanitizeDirection(metadata.heading, sanitized.heading ?? 'down')
  }

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
    if (key === 'appearance' || key === 'avatarId' || key === 'mapId') {
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
  content: 'Bienvenida a la comunidad',
  timestamp: new Date().toISOString()
})

const sanitizeSize = (size, fallback = DEFAULT_SIZE) => {
  const fallbackWidth = Math.max(1, Math.trunc(toNumber(fallback?.width, DEFAULT_SIZE.width)))
  const fallbackHeight = Math.max(1, Math.trunc(toNumber(fallback?.height, DEFAULT_SIZE.height)))

  const width = Math.max(1, Math.trunc(toNumber(size?.width, fallbackWidth)))
  const height = Math.max(1, Math.trunc(toNumber(size?.height, fallbackHeight)))

  return { width, height }
}

const sanitizeSpawn = (spawn, size, fallback = DEFAULT_SPAWN) => {
  const base = {
    x: Math.trunc(toNumber(fallback?.x, DEFAULT_SPAWN.x)),
    y: Math.trunc(toNumber(fallback?.y, DEFAULT_SPAWN.y)),
    z: toNumber(fallback?.z, DEFAULT_SPAWN.z)
  }

  const raw = spawn && typeof spawn === 'object' ? spawn : {}
  const resolvedSize = sanitizeSize(size, DEFAULT_SIZE)

  const width = Math.max(1, resolvedSize.width)
  const height = Math.max(1, resolvedSize.height)

  const clamp = (value, min, max, fallbackValue) => {
    const numeric = Math.trunc(toNumber(value, fallbackValue))
    return Math.min(Math.max(numeric, min), max)
  }

  return {
    x: clamp(raw.x, 0, width - 1, base.x),
    y: clamp(raw.y, 0, height - 1, base.y),
    z: toNumber(raw.z, base.z)
  }
}

const cloneMapCollection = (collection) => {
  if (!Array.isArray(collection)) {
    return []
  }

  return collection.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry
    }

    return JSON.parse(JSON.stringify(entry))
  })
}

const cloneTheme = (theme, fallback = DEFAULT_THEME) => {
  if (!theme || typeof theme !== 'object') {
    return { ...fallback }
  }

  return { ...fallback, ...theme }
}

const cloneWorld = (world = HELLO_WORLD) => ({
  id: world.id,
  name: world.name,
  description: world.description,
  size: sanitizeSize(world.size, DEFAULT_SIZE),
  spawn: sanitizeSpawn(world.spawn, world.size ?? DEFAULT_SIZE, DEFAULT_SPAWN),
  biome: typeof world.biome === 'string' ? world.biome : HELLO_WORLD.biome,
  blockedAreas: cloneMapCollection(world.blockedAreas),
  objects: cloneMapCollection(world.objects),
  portals: cloneMapCollection(world.portals),
  theme: cloneTheme(world.theme, DEFAULT_THEME),
  sourcePath:
    typeof world.sourcePath === 'string' && world.sourcePath.trim()
      ? world.sourcePath.trim()
      : HELLO_WORLD.sourcePath ?? null
})

class WorldState {
  constructor () {
    this.world = cloneWorld(HELLO_WORLD)
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
    return cloneWorld(this.world)
  }

  setWorld (world) {
    if (!world || typeof world !== 'object') {
      return
    }

    const current = this.getWorld()
    const id = typeof world.id === 'string' && world.id.trim() ? world.id.trim() : current.id
    const name =
      typeof world.name === 'string' && world.name.trim()
        ? world.name.trim().slice(0, 100)
        : current.name
    const description =
      typeof world.description === 'string' && world.description.trim()
        ? world.description.trim().slice(0, 500)
        : current.description

    const size = sanitizeSize(world.size, current.size)
    const spawn = sanitizeSpawn(world.spawn, size, current.spawn)

    const biome = typeof world.biome === 'string' ? world.biome : current.biome
    const blockedAreas = cloneMapCollection(Array.isArray(world.blockedAreas) ? world.blockedAreas : current.blockedAreas)
    const objects = cloneMapCollection(Array.isArray(world.objects) ? world.objects : current.objects)
    const portals = cloneMapCollection(Array.isArray(world.portals) ? world.portals : current.portals)
    const theme = cloneTheme(world.theme, current.theme)
    const sourcePath =
      typeof world.sourcePath === 'string' && world.sourcePath.trim()
        ? world.sourcePath.trim()
        : current.sourcePath ?? null

    this.world = {
      id,
      name,
      description,
      size,
      spawn,
      biome,
      blockedAreas,
      objects,
      portals,
      theme,
      sourcePath
    }
  }

  getSpawnPosition () {
    return { ...this.world.spawn }
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
    const requestedId =
      typeof payload.playerId === 'string' && payload.playerId.trim()
        ? payload.playerId.trim()
        : null

    const playerId = generatePlayerId(requestedId ?? socketId)

    const aliasCandidate =
      typeof payload.alias === 'string' && payload.alias.trim()
        ? payload.alias.trim()
        : typeof payload.name === 'string' && payload.name.trim()
          ? payload.name.trim()
          : null

    if (!aliasCandidate) {
      throw new Error('Alias is required')
    }

    const alias = sanitizeName(aliasCandidate, aliasCandidate)
    const name = sanitizeName(payload.name, alias)
    const spawn = this.getSpawnPosition()
    const position = sanitizePosition(payload.position, spawn)
    const animation = sanitizeAnimation(payload.animation)

    const existingSocketId = this.playerToSocket.get(playerId)

    if (existingSocketId && existingSocketId !== socketId) {
      this.socketToPlayer.delete(existingSocketId)
      this.playerToSocket.delete(playerId)
    }

    let metadata = mergeMetadata({}, payload.metadata)
    metadata = mergeMetadata(metadata, {
      alias,
      ...(payload.avatar && typeof payload.avatar === 'object' ? { avatar: payload.avatar } : {})
    })

    const spriteId = sanitizeSpriteId(
      payload.sprite ?? payload.avatar?.sprite ?? metadata.avatar?.sprite
    )

    if (spriteId) {
      const avatar = metadata.avatar && typeof metadata.avatar === 'object' ? { ...metadata.avatar } : {}
      avatar.sprite = spriteId
      metadata.avatar = avatar
    }

    const direction = sanitizeDirection(
      payload.direction ?? metadata.heading ?? 'down',
      'down'
    )

    metadata.heading = direction

    const player = {
      id: playerId,
      name,
      position,
      animation,
      metadata,
      direction,
      alias,
      sprite: metadata.avatar?.sprite ?? null
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
      player.position = sanitizePosition(payload.position, player.position)
    }

    if (payload.animation) {
      player.animation = sanitizeAnimation(payload.animation)
    }

    let metadata = player.metadata

    if (payload.metadata && typeof payload.metadata === 'object') {
      metadata = mergeMetadata(metadata, payload.metadata)
    }

    if (payload.avatar && typeof payload.avatar === 'object') {
      metadata = mergeMetadata(metadata, { avatar: payload.avatar })
    }

    if (typeof payload.alias === 'string' && payload.alias.trim()) {
      const alias = sanitizeName(payload.alias, player.name)
      metadata = mergeMetadata(metadata, { alias })
      player.name = alias
    } else if (typeof payload.name === 'string') {
      player.name = sanitizeName(payload.name, player.name)
    }

    const spriteId = sanitizeSpriteId(
      payload.sprite ?? payload.avatar?.sprite ?? metadata.avatar?.sprite
    )

    if (spriteId) {
      const avatar = metadata.avatar && typeof metadata.avatar === 'object' ? { ...metadata.avatar } : {}
      avatar.sprite = spriteId
      metadata.avatar = avatar
    }

    const directionInput =
      payload.direction ?? payload.metadata?.heading ?? metadata.heading ?? player.direction
    const direction = sanitizeDirection(directionInput, player.direction ?? 'down')
    metadata.heading = direction

    const aliasFromMetadata =
      typeof metadata?.alias === 'string' && metadata.alias.trim()
        ? sanitizeName(metadata.alias, player.name)
        : null

    if (aliasFromMetadata) {
      metadata.alias = aliasFromMetadata
      player.name = aliasFromMetadata
    }

    player.metadata = metadata
    player.direction = direction
    player.alias = metadata.alias ?? player.name
    player.sprite = metadata.avatar?.sprite ?? player.sprite ?? null

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

    const aliasCandidate =
      typeof payload.metadata?.alias === 'string' && payload.metadata.alias.trim()
        ? payload.metadata.alias.trim()
        : typeof payload.name === 'string' && payload.name.trim()
          ? payload.name.trim()
          : `Usuario ${payload.id}`

    const alias = sanitizeName(aliasCandidate, aliasCandidate)
    const name = sanitizeName(payload.name, alias)
    const position = sanitizePosition(payload.position, this.getSpawnPosition())
    const animation = sanitizeAnimation(payload.animation)
    let metadata = mergeMetadata({}, payload.metadata)

    metadata = mergeMetadata(metadata, {
      alias,
      ...(payload.avatar && typeof payload.avatar === 'object' ? { avatar: payload.avatar } : {})
    })

    const spriteId = sanitizeSpriteId(
      payload.sprite ?? payload.avatar?.sprite ?? metadata.avatar?.sprite
    )

    if (spriteId) {
      const avatar = metadata.avatar && typeof metadata.avatar === 'object' ? { ...metadata.avatar } : {}
      avatar.sprite = spriteId
      metadata.avatar = avatar
    }

    const direction = sanitizeDirection(
      payload.direction ?? metadata.heading ?? 'down',
      'down'
    )

    metadata.heading = direction

    const player = {
      id: payload.id,
      name,
      position,
      animation,
      metadata,
      direction,
      alias,
      sprite: metadata.avatar?.sprite ?? null
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
