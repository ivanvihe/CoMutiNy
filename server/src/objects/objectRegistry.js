import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_OBJECT_DIRECTORY = path.resolve(__dirname, '../../objects/definitions')

const STATE = {
  loaded: false,
  directory: DEFAULT_OBJECT_DIRECTORY,
  definitions: new Map()
}

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const sanitizeString = (value, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback
  }
  const trimmed = value.trim()
  return trimmed || fallback
}

const sanitizeInteraction = (raw, { fallbackTitle, fallbackDescription }) => {
  const base = typeof raw === 'object' && raw
    ? { ...raw }
    : {}

  const type = sanitizeString(base.type, 'message')
  const title = sanitizeString(base.title, fallbackTitle)
  const description = sanitizeString(base.description, fallbackDescription)
  const message = sanitizeString(base.message ?? base.text, description)

  const payload = {
    type,
    title: title || fallbackTitle,
    description: description || fallbackDescription,
    message: message || undefined
  }

  if (base.icon && typeof base.icon === 'string') {
    payload.icon = base.icon.trim()
  }

  if (base.animation && typeof base.animation === 'string') {
    payload.animation = base.animation.trim()
  }

  if (base.metadata && typeof base.metadata === 'object' && !Array.isArray(base.metadata)) {
    payload.metadata = { ...base.metadata }
  }

  return payload
}

const sanitizeBehaviour = (raw, { fallbackTitle, fallbackDescription }) => {
  if (!raw || typeof raw !== 'object') {
    return {
      type: 'message',
      title: fallbackTitle,
      description: fallbackDescription,
      message: fallbackDescription,
      broadcast: false,
      metadata: {}
    }
  }

  const interaction = sanitizeInteraction(raw, { fallbackTitle, fallbackDescription })
  return {
    ...interaction,
    broadcast: Boolean(raw.broadcast),
    metadata:
      raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
        ? { ...raw.metadata }
        : {},
    effects: Array.isArray(raw.effects) ? [...raw.effects] : []
  }
}

const sanitizePosition = (raw, fallback = { x: 0, y: 0 }) => ({
  x: toNumber(raw?.x, fallback.x ?? 0),
  y: toNumber(raw?.y, fallback.y ?? 0)
})

const sanitizeSize = (raw, fallback = { width: 1, height: 1 }) => ({
  width: Math.max(1, Math.trunc(toNumber(raw?.width, fallback.width ?? 1))),
  height: Math.max(1, Math.trunc(toNumber(raw?.height, fallback.height ?? 1)))
})

const loadObjectFile = async (filePath) => {
  const contents = await fs.readFile(filePath, 'utf-8')
  const definition = JSON.parse(contents)

  const id = sanitizeString(definition.id)
  if (!id) {
    throw new Error(`El archivo ${path.basename(filePath)} no define un identificador válido`)
  }

  const name = sanitizeString(definition.name, id)
  const description = sanitizeString(definition.description)
  const interaction = sanitizeInteraction(definition.interaction ?? definition.behavior, {
    fallbackTitle: name,
    fallbackDescription: description
  })
  const behaviour = sanitizeBehaviour(definition.behavior ?? definition.behaviour ?? definition.interaction, {
    fallbackTitle: name,
    fallbackDescription: description || interaction.description
  })

  const metadata =
    definition.metadata && typeof definition.metadata === 'object' && !Array.isArray(definition.metadata)
      ? { ...definition.metadata }
      : {}

  return {
    id,
    name,
    description,
    interaction,
    behaviour,
    metadata,
    source: filePath
  }
}

const ensureDefinitionsLoaded = async ({ directory = DEFAULT_OBJECT_DIRECTORY, force = false } = {}) => {
  if (STATE.loaded && !force && STATE.directory === directory) {
    return STATE
  }

  const resolvedDirectory = path.resolve(directory)
  const entries = await fs.readdir(resolvedDirectory, { withFileTypes: true })
  const definitions = new Map()

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.obj')) {
      continue
    }

    const filePath = path.join(resolvedDirectory, entry.name)
    try {
      const definition = await loadObjectFile(filePath)
      definitions.set(definition.id, definition)
    } catch (error) {
      console.error(`[objects] Error al cargar ${entry.name}:`, error.message)
    }
  }

  STATE.loaded = true
  STATE.directory = resolvedDirectory
  STATE.definitions = definitions

  return STATE
}

const getDefinition = (objectId) => {
  if (!objectId) {
    return null
  }
  return STATE.definitions.get(objectId) ?? null
}

const mergeObjectWithDefinition = (objectDefinition) => {
  const id = sanitizeString(objectDefinition?.id)
  if (!id) {
    return null
  }

  const position = sanitizePosition(objectDefinition.position)
  const size = sanitizeSize(objectDefinition.size)
  const solid = Boolean(objectDefinition.solid)
  const palette = Array.isArray(objectDefinition.palette) ? [...objectDefinition.palette] : []
  const metadata =
    objectDefinition.metadata && typeof objectDefinition.metadata === 'object' && !Array.isArray(objectDefinition.metadata)
      ? { ...objectDefinition.metadata }
      : {}

  const referencedId = sanitizeString(objectDefinition.objectId ?? metadata.objectId)
  const definition = referencedId ? getDefinition(referencedId) : null

  const name = sanitizeString(objectDefinition.name, definition?.name ?? id)
  const description = sanitizeString(objectDefinition.description, definition?.description ?? '')

  const interaction = sanitizeInteraction(objectDefinition.interaction ?? definition?.interaction, {
    fallbackTitle: name,
    fallbackDescription: description || definition?.description || ''
  })

  const behaviour = sanitizeBehaviour(
    objectDefinition.runtime?.behaviour ?? objectDefinition.behaviour ?? definition?.behaviour,
    {
      fallbackTitle: interaction.title ?? name,
      fallbackDescription: interaction.description ?? description
    }
  )

  const publicObject = {
    id,
    name,
    description,
    solid,
    position,
    size,
    palette,
    metadata: {
      ...definition?.metadata,
      ...metadata,
      ...(referencedId ? { objectId: referencedId } : {})
    },
    objectId: referencedId || definition?.id || null,
    interaction
  }

  const runtime = {
    definitionId: definition?.id || referencedId || null,
    behaviour,
    metadata: { ...definition?.metadata }
  }

  return { publicObject, runtime }
}

const attachObjectDefinitions = async (mapDefinition, options = {}) => {
  const state = await ensureDefinitionsLoaded(options)
  if (!mapDefinition || typeof mapDefinition !== 'object') {
    return { map: null, runtimeIndex: new Map(), state }
  }

  const objects = Array.isArray(mapDefinition.objects) ? mapDefinition.objects : []
  const enriched = []
  const runtimeIndex = new Map()

  for (const objectDefinition of objects) {
    const merged = mergeObjectWithDefinition(objectDefinition)
    if (!merged) {
      continue
    }

    const { publicObject, runtime } = merged
    enriched.push(publicObject)
    runtimeIndex.set(publicObject.id, { publicObject, runtime })
  }

  const map = {
    ...mapDefinition,
    objects: enriched
  }

  return { map, runtimeIndex, state }
}

const createInteractionResult = ({ objectRecord, player, action = 'interact', input = null }) => {
  if (!objectRecord) {
    return { ok: false, message: 'El objeto no está disponible.' }
  }

  const { publicObject, runtime } = objectRecord
  const behaviour = runtime?.behaviour

  if (!behaviour) {
    return { ok: false, message: 'El objeto no responde.' }
  }

  const alias = sanitizeString(player?.metadata?.alias ?? player?.alias ?? player?.name, 'Explorador')
  let message = sanitizeString(behaviour.message, behaviour.description)

  if (message.includes('{player}')) {
    message = message.replace('{player}', alias)
  }

  const event = {
    type: behaviour.type ?? 'message',
    title: behaviour.title ?? publicObject.name,
    description: behaviour.description ?? message,
    message,
    objectId: publicObject.id,
    objectName: publicObject.name,
    mapId: input?.mapId ?? null,
    action,
    metadata: {
      ...(behaviour.metadata ?? {}),
      ...(publicObject.metadata ?? {})
    }
  }

  return {
    ok: true,
    event,
    broadcast: Boolean(behaviour.broadcast),
    effects: Array.isArray(behaviour.effects) ? behaviour.effects : [],
    message
  }
}

export {
  attachObjectDefinitions,
  createInteractionResult,
  ensureDefinitionsLoaded,
  getDefinition
}
