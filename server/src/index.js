import http from 'http'
import path from 'node:path'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import { connectDatabase } from './config/database.js'
import assetRoutes from './routes/assetRoutes.js'
import mapRoutes from './routes/mapRoutes.js'
import objectRoutes from './routes/objectRoutes.js'
import sessionManager from './services/sessionManager.js'
import avatarRepository from './repositories/AvatarRepository.js'
import spriteGenerationService from './sprites/spriteGenerationService.js'
import spriteEvents, { SPRITE_EVENTS } from './sprites/events.js'
import createSocketServer from './network/socketServer.js'

dotenv.config()

const app = express()

const parseCorsOrigins = (value) => {
  if (!value) {
    return '*'
  }

  if (value.trim() === '*') {
    return '*'
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const corsOrigin = parseCorsOrigins(process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS ?? '*')

app.use(
  cors({
    origin: corsOrigin,
    credentials: corsOrigin !== '*'
  })
)

app.use(express.json())
app.use(
  '/static',
  express.static(path.resolve(process.cwd(), 'server', 'assets'), {
    fallthrough: true,
    maxAge: '1h'
  })
)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.use('/assets', assetRoutes)
app.use('/maps', mapRoutes)
app.use('/objects', objectRoutes)

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

const enrichJoinPayloadWithAvatar = async (payload = {}) => {
  const enriched = { ...(payload ?? {}) }

  const metadata = payload?.metadata && typeof payload.metadata === 'object'
    ? { ...payload.metadata }
    : {}

  if (payload?.avatar && typeof payload.avatar === 'object') {
    metadata.avatar = { ...payload.avatar }
  }

  const alias =
    typeof enriched.alias === 'string' && enriched.alias.trim()
      ? enriched.alias.trim()
      : typeof enriched.name === 'string' && enriched.name.trim()
        ? enriched.name.trim()
        : null

  if (alias) {
    enriched.name = alias
    metadata.alias = alias
  }

  const avatarId =
    (typeof enriched.avatarId === 'string' && enriched.avatarId.trim()) ||
    (typeof metadata.avatarId === 'string' && metadata.avatarId.trim()) ||
    null

  if (!avatarId) {
    if (Object.keys(metadata).length > 0) {
      enriched.metadata = metadata
    } else {
      delete enriched.metadata
    }

    delete enriched.avatarId

    return enriched
  }

  const avatar = await avatarRepository.findByIdWithSprite(avatarId)

  if (!avatar) {
    if (Object.keys(metadata).length > 0) {
      enriched.metadata = metadata
    }

    delete enriched.avatarId

    return enriched
  }

  const plain = typeof avatar.get === 'function' ? avatar.get({ plain: true }) : { ...avatar }

  const avatarAppearance = {
    hair: plain.layerHair ?? null,
    face: plain.layerFace ?? null,
    outfit: plain.layerOutfit ?? null,
    shoes: plain.layerShoes ?? null
  }

  const spriteAsset = plain.spriteAsset
    ? {
        id: plain.spriteAsset.id,
        name: plain.spriteAsset.name,
        category: plain.spriteAsset.category,
        imageUrl: plain.spriteAsset.imageUrl,
        metadata: plain.spriteAsset.metadata ?? null
      }
    : null

  const payloadAppearance = metadata.appearance && typeof metadata.appearance === 'object'
    ? metadata.appearance
    : {}

  const mergedAppearance = {
    hair: payloadAppearance.hair ?? avatarAppearance.hair,
    face: payloadAppearance.face ?? avatarAppearance.face,
    outfit: payloadAppearance.outfit ?? avatarAppearance.outfit,
    shoes: payloadAppearance.shoes ?? avatarAppearance.shoes
  }

  enriched.name = typeof enriched.name === 'string' && enriched.name.trim() ? enriched.name : plain.name

  enriched.metadata = {
    ...metadata,
    avatarId: plain.id,
    appearance: mergedAppearance,
    ...(spriteAsset
      ? {
          sprite: spriteAsset,
          spriteAssetId: spriteAsset.id
        }
      : {})
  }

  if (!spriteAsset && metadata.sprite) {
    enriched.metadata.sprite = metadata.sprite
  }

  delete enriched.avatarId

  return enriched
}

const PORT = Number(process.env.SERVER_PORT || 4000)

const start = async () => {
  try {
    await connectDatabase()
    await sessionManager.initialize()
    const atlas = await spriteGenerationService.getAtlasSnapshot()
    sessionManager.setSpriteAtlas(atlas)

    createSocketServer(server, {
      corsOrigin: process.env.CORS_ORIGIN || '*',
      enrichJoinPayload: enrichJoinPayloadWithAvatar
    })

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${PORT}`)
    })
  } catch (error) {
    process.exitCode = 1
  }
}

start()

spriteEvents.on(SPRITE_EVENTS.ATLAS_UPDATED, (atlas) => {
  sessionManager.setSpriteAtlas(atlas)
})
