import EventEmitter from 'node:events'

import worldState from './worldState.js'
import { getRedisClient, getRedisPubSub } from '../config/redis.js'
import loadStaticMapDefinitions from '../utils/staticMapLoader.js'
import { attachObjectDefinitions, createInteractionResult, ensureDefinitionsLoaded } from '../objects/objectRegistry.js'
import { registerWorldEventHandlers } from '../world/events/index.js'

const SNAPSHOT_KEY = 'comutiny:world:snapshot'
const EVENT_CHANNEL = 'comutiny:world:events'

const EVENT_TYPES = Object.freeze({
  PLAYER_UPSERT: 'player:upsert',
  PLAYER_REMOVE: 'player:remove',
  CHAT_MESSAGE: 'chat:message',
  SPRITE_ATLAS: 'sprites:atlas',
  WORLD_SET: 'world:set',
  OBJECT_EVENT: 'object:event'
})

class SessionManager extends EventEmitter {
  constructor (state, options = {}) {
    super()
    this.worldState = state
    this.redis = null
    this.publisher = null
    this.subscriber = null
    this.initialized = false
    this.instanceId = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`
    this.updateDebounceMs = Math.max(10, Number(options.updateDebounceMs ?? 50))
    this.snapshotDebounceMs = Math.max(10, Number(options.snapshotDebounceMs ?? 100))
    this.pendingUpdateBroadcasts = new Map()
    this.updateTimer = null
    this.snapshotTimer = null
    this.staticMaps = []
  }

  async initialize () {
    if (this.initialized) {
      return
    }

    this.redis = getRedisClient()
    const pubsub = getRedisPubSub()

    if (pubsub) {
      this.publisher = pubsub.publisher
      this.subscriber = pubsub.subscriber

      try {
        await this.subscriber.subscribe(EVENT_CHANNEL)
        this.subscriber.on('message', async (channel, payload) => {
          if (channel !== EVENT_CHANNEL) {
            return
          }

          try {
            await this._handleRemoteMessage(payload)
          } catch (error) {
            console.error('[session] Failed to process remote event', error)
          }
        })
      } catch (error) {
        console.error('[session] Failed to subscribe to redis channel', error)
      }
    }

    if (this.redis) {
      try {
        const raw = await this.redis.get(SNAPSHOT_KEY)

        if (raw) {
          const snapshot = JSON.parse(raw)
          this.worldState.hydrateSnapshot(snapshot)
          this.emit('snapshot:loaded', { snapshot })
        }
      } catch (error) {
        console.error('[session] Failed to hydrate snapshot', error)
      }
    }

    try {
      await ensureDefinitionsLoaded()
    } catch (error) {
      console.error('[objects] Failed to precache object definitions', error)
    }

    await this._rehydrateWorldObjects()

    await this._ensureDefaultWorld()

    this.initialized = true
  }

  async _refreshStaticMaps () {
    try {
      const maps = await loadStaticMapDefinitions()
      this.staticMaps = Array.isArray(maps) ? maps : []
    } catch (error) {
      console.error('[maps] Failed to refresh static maps', error)
      this.staticMaps = []
    }

    return this.staticMaps
  }

  async _resolveStaticMap (mapIdentifier) {
    const identifier = typeof mapIdentifier === 'string' ? mapIdentifier.trim() : ''

    if (!identifier) {
      return null
    }

    if (!this.staticMaps.length) {
      await this._refreshStaticMaps()
    }

    const lowerIdentifier = identifier.toLowerCase()

    let match = this.staticMaps.find((map) => {
      if (!map) {
        return false
      }

      if (typeof map.id === 'string' && map.id.trim().toLowerCase() === lowerIdentifier) {
        return true
      }

      if (typeof map.sourcePath === 'string' && map.sourcePath.trim().toLowerCase() === lowerIdentifier) {
        return true
      }

      return false
    })

    if (match) {
      return match
    }

    await this._refreshStaticMaps()

    match = this.staticMaps.find((map) => {
      if (!map) {
        return false
      }

      if (typeof map.id === 'string' && map.id.trim().toLowerCase() === lowerIdentifier) {
        return true
      }

      if (typeof map.sourcePath === 'string' && map.sourcePath.trim().toLowerCase() === lowerIdentifier) {
        return true
      }

      return false
    })

    return match ?? null
  }

  async _applyWorldDefinition (mapDefinition, { origin = 'system', socketId = null, persist = true, publish = true } = {}) {
    if (!mapDefinition || typeof mapDefinition !== 'object') {
      return false
    }

    const current = this.worldState.getWorld()
    const spawn = {
      x: mapDefinition.spawn?.x ?? current.spawn?.x ?? 0,
      y: mapDefinition.spawn?.y ?? current.spawn?.y ?? 0,
      z: mapDefinition.spawn?.z ?? current.spawn?.z ?? 0
    }

    const isSameWorld =
      current?.sourcePath === mapDefinition.sourcePath &&
      current?.id === mapDefinition.id &&
      current?.size?.width === mapDefinition.size?.width &&
      current?.size?.height === mapDefinition.size?.height &&
      current?.spawn?.x === spawn.x &&
      current?.spawn?.y === spawn.y &&
      current?.spawn?.z === spawn.z

    if (isSameWorld) {
      return false
    }

    const payload = { ...mapDefinition, spawn }
    const { map: enrichedMap, runtimeIndex } = await attachObjectDefinitions(payload)
    const target = enrichedMap ?? payload

    this.worldState.setWorld(target, { runtimeIndex })
    const world = this.worldState.getWorld()

    console.info(
      `[session] World set to ${world.name} (${world.sourcePath ?? 'unknown'}) with size ` +
        `${world.size?.width ?? 0}x${world.size?.height ?? 0}`
    )

    if (publish) {
      this._publish(EVENT_TYPES.WORLD_SET, { world: target })
    }

    this.emit('world:changed', { world, origin, socketId })

    if (persist) {
      this._scheduleSnapshotPersist()
    }

    return true
  }

  async selectWorldByMapId (mapId, { origin = 'system', socketId = null } = {}) {
    if (!mapId) {
      return false
    }

    const mapDefinition = await this._resolveStaticMap(mapId)

    if (!mapDefinition) {
      throw new Error('El mapa seleccionado no está disponible.')
    }

    return await this._applyWorldDefinition(mapDefinition, { origin, socketId })
  }

  getSnapshot () {
    return this.worldState.getSnapshot()
  }

  async addPlayer (socketId, payload = {}) {
    const mapId = typeof payload?.mapId === 'string' ? payload.mapId.trim() : null
    let sanitizedPayload = payload

    if (mapId) {
      await this.selectWorldByMapId(mapId, { origin: 'local', socketId })
      sanitizedPayload = { ...payload }
      delete sanitizedPayload.mapId
    }

    const player = this.worldState.addPlayer(socketId, sanitizedPayload)

    this.emit('player:joined', { player, socketId, origin: 'local' })
    this._publish(EVENT_TYPES.PLAYER_UPSERT, { player })
    this._scheduleSnapshotPersist()

    return player
  }

  updatePlayer (socketId, payload) {
    const player = this.worldState.updatePlayer(socketId, payload)

    this._queuePlayerUpdateBroadcast(player, socketId)

    return player
  }

  async interactWithObject (socketId, payload = {}) {
    const objectId = typeof payload.objectId === 'string' ? payload.objectId.trim() : ''
    if (!objectId) {
      throw new Error('Debes indicar el objeto con el que deseas interactuar.')
    }

    const player = this.worldState.getPlayerBySocket(socketId)
    if (!player) {
      throw new Error('Jugador no registrado.')
    }

    const world = this.worldState.getWorld()
    const mapId = typeof payload.mapId === 'string' ? payload.mapId.trim() : ''

    if (mapId && mapId !== world.id) {
      throw new Error('El objeto no pertenece al mapa actual.')
    }

    const publicObject = this.worldState.getObjectById(objectId)
    const runtime = this.worldState.getObjectRuntime(objectId)

    if (!publicObject) {
      throw new Error('No hay ningún objeto interactuable en esa posición.')
    }

    const objectRecord = { publicObject, runtime }
    const result = createInteractionResult({
      objectRecord,
      player,
      action: typeof payload.action === 'string' ? payload.action.trim() || 'interact' : 'interact',
      input: { mapId: world.id, ...(payload.input ?? {}) }
    })

    if (!result.ok) {
      throw new Error(result.message ?? 'La interacción no produjo respuesta.')
    }

    const alias =
      typeof player.metadata?.alias === 'string' && player.metadata.alias.trim()
        ? player.metadata.alias.trim()
        : typeof player.alias === 'string' && player.alias.trim()
          ? player.alias.trim()
          : player.name ?? player.id

    const event = {
      ...result.event,
      mapId: world.id,
      objectId,
      actor: {
        id: player.id,
        alias,
        name: player.name
      },
      timestamp: new Date().toISOString()
    }

    const response = {
      ok: true,
      event,
      message: result.message ?? null,
      effects: Array.isArray(result.effects) ? result.effects : []
    }

    const broadcast = Boolean(result.broadcast)

    this.emit('object:event', { event, origin: 'local', socketId, broadcast })

    if (broadcast) {
      this._publish(EVENT_TYPES.OBJECT_EVENT, { event })
    }

    return response
  }

  removePlayer (socketId, reason = 'client:disconnect') {
    const player = this.worldState.removePlayer(socketId)

    if (!player) {
      return null
    }

    this.pendingUpdateBroadcasts.delete(player.id)
    this.emit('player:left', { player, socketId, origin: 'local', reason })
    this._publish(EVENT_TYPES.PLAYER_REMOVE, { playerId: player.id, reason })
    this._scheduleSnapshotPersist()

    return player
  }

  removePlayerById (playerId, reason = 'remote:sync') {
    if (!playerId) {
      return null
    }

    const socketId = this.worldState.getSocketIdForPlayer(playerId)
    const removed = this.worldState.removePlayerById(playerId)

    if (!removed) {
      return null
    }

    this.pendingUpdateBroadcasts.delete(playerId)
    this.emit('player:left', { player: removed, socketId, origin: 'remote', reason })

    if (socketId) {
      this.emit('session:disconnect', { socketId, reason })
    }

    this._scheduleSnapshotPersist()
    return removed
  }

  addChatMessage (payload) {
    const message = this.worldState.addChatMessage(payload)

    this.emit('chat:message', { message, origin: 'local' })
    this._publish(EVENT_TYPES.CHAT_MESSAGE, { message })
    this._scheduleSnapshotPersist()

    return message
  }

  addChatMessageSnapshot (payload) {
    const message = this.worldState.addChatMessageSnapshot(payload)

    if (message) {
      this.emit('chat:message', { message, origin: 'remote' })
    }

    return message
  }

  setSpriteAtlas (atlas, origin = 'local') {
    if (!atlas || typeof atlas !== 'object') {
      return this.worldState.getSpriteAtlas()
    }

    this.worldState.setSpriteAtlas(atlas)
    const snapshot = this.worldState.getSpriteAtlas()

    this.emit('sprites:atlasUpdated', { atlas: snapshot, origin })

    if (origin === 'local') {
      this._publish(EVENT_TYPES.SPRITE_ATLAS, { atlas: snapshot })
      this._scheduleSnapshotPersist()
    }

    return snapshot
  }

  async _ensureDefaultWorld () {
    try {
      const maps = await this._refreshStaticMaps()

      if (!Array.isArray(maps) || maps.length === 0) {
        console.warn('[session] No static maps available to initialize the world')
        return
      }

      const initMap =
        maps.find((map) => /(^|\/)init\.map$/i.test(map.sourcePath ?? '')) ?? maps[0]

      if (!initMap) {
        console.warn('[session] Could not locate init.map definition')
        return
      }

      const changed = await this._applyWorldDefinition(initMap, {
        origin: 'system:init',
        socketId: null,
        publish: false
      })

      if (!changed) {
        console.info('[session] init.map already loaded as the active world')
      }
    } catch (error) {
      console.error('[session] Failed to ensure default world map', error)
    }
  }

  async _rehydrateWorldObjects () {
    const currentWorld = this.worldState.getWorld()

    if (!currentWorld || typeof currentWorld !== 'object') {
      return
    }

    try {
      const { map: enrichedMap, runtimeIndex } = await attachObjectDefinitions(currentWorld)
      if (enrichedMap) {
        this.worldState.setWorld(enrichedMap, { runtimeIndex })
      }
    } catch (error) {
      console.error('[objects] Failed to rebuild world object registry', error)
    }
  }

  _queuePlayerUpdateBroadcast (player, socketId) {
    if (!player?.id) {
      return
    }

    this.pendingUpdateBroadcasts.set(player.id, { player, socketId })

    if (this.updateTimer) {
      return
    }

    this.updateTimer = setTimeout(() => {
      this.updateTimer = null
      this._flushQueuedPlayerUpdates()
    }, this.updateDebounceMs)
  }

  _flushQueuedPlayerUpdates () {
    if (this.pendingUpdateBroadcasts.size === 0) {
      return
    }

    const entries = Array.from(this.pendingUpdateBroadcasts.values())
    this.pendingUpdateBroadcasts.clear()

    for (const entry of entries) {
      const { player, socketId } = entry

      if (!player?.id) {
        continue
      }

      this.emit('player:updated', { player, socketId, origin: 'local' })
      this._publish(EVENT_TYPES.PLAYER_UPSERT, { player })
    }

    this._scheduleSnapshotPersist()
  }

  _publish (type, payload) {
    if (!this.publisher) {
      return
    }

    const event = JSON.stringify({
      type,
      payload,
      source: this.instanceId,
      timestamp: Date.now()
    })

    this.publisher.publish(EVENT_CHANNEL, event).catch((error) => {
      console.error('[session] Failed to publish event', error)
    })
  }

  async _handleRemoteMessage (message) {
    let event

    try {
      event = JSON.parse(message)
    } catch (error) {
      console.error('[session] Failed to parse remote event', error)
      return
    }

    if (!event || event.source === this.instanceId) {
      return
    }

    const { type, payload } = event

    switch (type) {
      case EVENT_TYPES.PLAYER_UPSERT: {
        if (!payload?.player?.id) {
          return
        }

        const existed = Boolean(this.worldState.getPlayerById(payload.player.id))
        const player = this.worldState.upsertPlayerSnapshot(payload.player)
        this.emit(existed ? 'player:updated' : 'player:joined', {
          player,
          socketId: null,
          origin: 'remote'
        })
        this._scheduleSnapshotPersist()
        break
      }
      case EVENT_TYPES.PLAYER_REMOVE: {
        if (!payload?.playerId) {
          return
        }

        this.removePlayerById(payload.playerId, payload?.reason ?? 'remote:sync')
        break
      }
      case EVENT_TYPES.CHAT_MESSAGE: {
        if (!payload?.message) {
          return
        }

        this.addChatMessageSnapshot(payload.message)
        break
      }
      case EVENT_TYPES.SPRITE_ATLAS: {
        if (!payload?.atlas) {
          return
        }

        this.setSpriteAtlas(payload.atlas, 'remote')
        break
      }
      case EVENT_TYPES.WORLD_SET: {
        if (!payload?.world) {
          return
        }

        const { map: enrichedMap, runtimeIndex } = await attachObjectDefinitions(payload.world)
        const target = enrichedMap ?? payload.world
        this.worldState.setWorld(target, { runtimeIndex })
        const world = this.worldState.getWorld()
        this.emit('world:changed', { world, origin: 'remote', socketId: null })
        this._scheduleSnapshotPersist()
        break
      }
      case EVENT_TYPES.OBJECT_EVENT: {
        if (!payload?.event) {
          return
        }

        this.emit('object:event', { event: payload.event, origin: 'remote', socketId: null, broadcast: true })
        break
      }
      default:
        break
    }
  }

  _scheduleSnapshotPersist () {
    if (!this.redis) {
      return
    }

    if (this.snapshotTimer) {
      return
    }

    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null
      this._persistSnapshotNow()
    }, this.snapshotDebounceMs)
  }

  _persistSnapshotNow () {
    if (!this.redis) {
      return
    }

    const snapshot = this.worldState.getSnapshot()

    this.redis.set(SNAPSHOT_KEY, JSON.stringify(snapshot)).catch((error) => {
      console.error('[session] Failed to persist snapshot', error)
    })
  }
}

const sessionManager = new SessionManager(worldState)

registerWorldEventHandlers(sessionManager)

export { EVENT_TYPES, SessionManager }
export default sessionManager
