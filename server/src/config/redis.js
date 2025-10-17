import Redis from 'ioredis'

const hasRedisConfig = () =>
  Boolean(
    (typeof process.env.REDIS_URL === 'string' && process.env.REDIS_URL.trim()) ||
      (typeof process.env.REDIS_HOST === 'string' && process.env.REDIS_HOST.trim())
  )

const buildRedisOptions = () => {
  if (typeof process.env.REDIS_URL === 'string' && process.env.REDIS_URL.trim()) {
    return process.env.REDIS_URL.trim()
  }

  const port = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10)
  const db = Number.parseInt(process.env.REDIS_DB ?? '0', 10)

  const options = {
    host: process.env.REDIS_HOST?.trim() || '127.0.0.1',
    port: Number.isFinite(port) ? port : 6379,
    lazyConnect: false
  }

  if (process.env.REDIS_PASSWORD) {
    options.password = process.env.REDIS_PASSWORD
  }

  if (Number.isFinite(db) && db >= 0) {
    options.db = db
  }

  return options
}

const attachErrorLogging = (client, label) => {
  if (!client) {
    return null
  }

  const prefix = `[redis:${label}]`

  client.on('error', (error) => {
    console.error(`${prefix}`, error)
  })

  return client
}

const createRedisClient = (label) => {
  if (!hasRedisConfig()) {
    return null
  }

  const client = new Redis(buildRedisOptions())

  return attachErrorLogging(client, label)
}

let sharedClient = null
let sharedPublisher = null
let sharedSubscriber = null

const getRedisClient = () => {
  if (sharedClient) {
    return sharedClient
  }

  sharedClient = createRedisClient('store')

  return sharedClient
}

const getRedisPubSub = () => {
  if (sharedPublisher && sharedSubscriber) {
    return { publisher: sharedPublisher, subscriber: sharedSubscriber }
  }

  const publisher = createRedisClient('pub')
  const subscriber = createRedisClient('sub')

  if (!publisher || !subscriber) {
    if (publisher) {
      publisher.disconnect()
    }

    if (subscriber) {
      subscriber.disconnect()
    }

    return null
  }

  sharedPublisher = publisher
  sharedSubscriber = subscriber

  return { publisher, subscriber }
}

const getAdapterClients = () => {
  if (!hasRedisConfig()) {
    return null
  }

  const pubClient = createRedisClient('socket-pub')
  const subClient = createRedisClient('socket-sub')

  if (!pubClient || !subClient) {
    if (pubClient) {
      pubClient.disconnect()
    }

    if (subClient) {
      subClient.disconnect()
    }

    return null
  }

  return { pubClient, subClient }
}

const isRedisEnabled = () => hasRedisConfig()

export { createRedisClient, getAdapterClients, getRedisClient, getRedisPubSub, isRedisEnabled }
