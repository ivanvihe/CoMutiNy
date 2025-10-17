import EventEmitter from 'node:events'

import worldState from './worldState.js'
import { getRedisClient, getRedisPubSub } from '../config/redis.js'

const SNAPSHOT_KEY = 'comutiny:world:snapshot'
const EVENT_CHANNEL = 'comutiny:world:events'

const EVENT_TYPES = Object.freeze({
  PLAYER_UPSERT: 'player:upsert',
  PLAYER_REMOVE: 'player:remove',
  CHAT_MESSAGE: 'chat:message',
  SPRITE_ATLAS: 'sprites:atlas'
})

class SessionManager extends EventEmitter {
  constructor (state) {
    super()
    this.worldState = state
    this.redis = null
    this.publisher = null
    this.subscriber = null
    this.initialized = false
    this.instanceId = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`
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
        this.subscriber.on('message', (channel, payload) => {
          if (channel !== EVENT_CHANNEL) {
            return
          }

          this._handleRemoteMessage(payload)
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

    this.initialized = true
  }

  getSnapshot () {
    return this.worldState.getSnapshot()
  }

  addPlayer (socketId, payload) {
    const player = this.worldState.addPlayer(socketId, payload)

    this.emit('player:joined', { player, socketId, origin: 'local' })
    this._publish(EVENT_TYPES.PLAYER_UPSERT, { player })
    this._persistSnapshot()

    return player
  }

  updatePlayer (socketId, payload) {
    const player = this.worldState.updatePlayer(socketId, payload)

    this.emit('player:updated', { player, socketId, origin: 'local' })
    this._publish(EVENT_TYPES.PLAYER_UPSERT, { player })
    this._persistSnapshot()

    return player
  }

  removePlayer (socketId, reason = 'client:disconnect') {
    const player = this.worldState.removePlayer(socketId)

    if (!player) {
      return null
    }

    this.emit('player:left', { player, socketId, origin: 'local', reason })
    this._publish(EVENT_TYPES.PLAYER_REMOVE, { playerId: player.id, reason })
    this._persistSnapshot()

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

    this.emit('player:left', { player: removed, socketId, origin: 'remote', reason })

    if (socketId) {
      this.emit('session:disconnect', { socketId, reason })
    }

    return removed
  }

  addChatMessage (payload) {
    const message = this.worldState.addChatMessage(payload)

    this.emit('chat:message', { message, origin: 'local' })
    this._publish(EVENT_TYPES.CHAT_MESSAGE, { message })
    this._persistSnapshot()

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
      this._persistSnapshot()
    }

    return snapshot
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

  _handleRemoteMessage (message) {
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
      default:
        break
    }
  }

  _persistSnapshot () {
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

export { EVENT_TYPES }
export default sessionManager
