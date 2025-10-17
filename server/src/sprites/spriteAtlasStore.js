import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT_DIR = process.cwd()
const SPRITES_DIR = path.resolve(ROOT_DIR, 'server', 'assets', 'sprites')
const MANIFEST_PATH = path.join(SPRITES_DIR, 'manifest.json')

const DEFAULT_MANIFEST = Object.freeze({
  version: 1,
  updatedAt: null,
  sprites: []
})

const clone = (value) => JSON.parse(JSON.stringify(value))

const sanitizeManifest = (manifest = {}) => {
  const version = Number.isFinite(manifest.version) ? Number(manifest.version) : DEFAULT_MANIFEST.version
  const updatedAt = typeof manifest.updatedAt === 'string' ? manifest.updatedAt : DEFAULT_MANIFEST.updatedAt
  const sprites = Array.isArray(manifest.sprites) ? manifest.sprites.map((sprite) => ({ ...sprite })) : []

  return {
    version,
    updatedAt,
    sprites
  }
}

export const ensureSpriteDirectory = async () => {
  await fs.mkdir(SPRITES_DIR, { recursive: true })
}

export const loadSpriteManifest = async () => {
  try {
    const contents = await fs.readFile(MANIFEST_PATH, 'utf8')
    const parsed = JSON.parse(contents)

    return sanitizeManifest(parsed)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      await ensureSpriteDirectory()
      await fs.writeFile(MANIFEST_PATH, JSON.stringify(DEFAULT_MANIFEST, null, 2), 'utf8')
      return clone(DEFAULT_MANIFEST)
    }

    throw error
  }
}

export const saveSpriteManifest = async (manifest) => {
  const sanitized = sanitizeManifest(manifest)
  const payload = {
    ...sanitized,
    version: (sanitized.version ?? DEFAULT_MANIFEST.version) + 1,
    updatedAt: new Date().toISOString()
  }

  await ensureSpriteDirectory()
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(payload, null, 2), 'utf8')

  return clone(payload)
}

export const buildAtlasSnapshot = (manifest) => {
  const sanitized = sanitizeManifest(manifest ?? DEFAULT_MANIFEST)
  const sprites = sanitized.sprites.map((sprite) => ({
    id: sprite.id,
    name: sprite.name,
    category: sprite.category,
    imageUrl: sprite.imageUrl,
    metadata: sprite.metadata ?? null,
    createdAt: sprite.createdAt ?? null,
    description: sprite.description ?? null,
    generator: sprite.generator ?? null,
    resources: sprite.resources ?? null
  }))

  const lookup = {}
  for (const sprite of sprites) {
    if (sprite?.id) {
      lookup[sprite.id] = sprite
    }
  }

  return {
    version: sanitized.version,
    updatedAt: sanitized.updatedAt,
    sprites,
    lookup
  }
}

export const appendSpriteToManifest = async (spriteEntry) => {
  if (!spriteEntry?.id) {
    throw new Error('spriteEntry.id is required')
  }

  const manifest = await loadSpriteManifest()
  const sprites = manifest.sprites.filter((sprite) => sprite.id !== spriteEntry.id)

  sprites.unshift({ ...spriteEntry })

  const updatedManifest = await saveSpriteManifest({
    ...manifest,
    sprites
  })

  return buildAtlasSnapshot(updatedManifest)
}
