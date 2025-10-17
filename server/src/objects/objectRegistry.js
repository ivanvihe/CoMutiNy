import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_OBJECT_DIRECTORY = path.resolve(__dirname, '../../objects/definitions')

const parseDirectoryList = (value) => {
  if (!value) {
    return []
  }

  return `${value}`
    .split(',')
    .flatMap((entry) => entry.split(path.delimiter))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry))
}

const ENVIRONMENT_DIRECTORIES = parseDirectoryList(
  process.env.OBJECT_DEFINITION_DIRECTORIES ??
    process.env.OBJECT_DEFINITION_DIRECTORY ??
    process.env.OBJECT_DIRECTORY
)

const DEFAULT_DIRECTORIES = [
  DEFAULT_OBJECT_DIRECTORY,
  path.resolve(process.cwd(), 'server', 'objects', 'definitions'),
  path.resolve(process.cwd(), 'objects', 'definitions')
]

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

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(Math.max(value, min), max)
}

const sanitizeScale = (raw) => {
  if (raw === undefined || raw === null) {
    return { x: 1, y: 1 }
  }

  if (typeof raw === 'number') {
    const value = clamp(raw, 0.1, 6)
    return { x: value, y: value }
  }

  if (typeof raw === 'object') {
    const x = clamp(toNumber(raw.x, 1), 0.1, 6)
    const y = clamp(toNumber(raw.y, 1), 0.1, 6)
    return { x, y }
  }

  return { x: 1, y: 1 }
}

const sanitizeAnchor = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { x: 0.5, y: 1 }
  }
  const x = clamp(toNumber(raw.x, 0.5), 0, 1)
  const y = clamp(toNumber(raw.y, 1), 0, 1.5)
  return { x, y }
}

const sanitizeOffset = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { x: 0, y: 0 }
  }
  const x = toNumber(raw.x, 0)
  const y = toNumber(raw.y, 0)
  return { x, y }
}

const sanitizeAppearance = (raw, { fallbackSize } = {}) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }

  const generatorCandidate =
    sanitizeString(raw.generator) ||
    sanitizeString(raw.type) ||
    sanitizeString(raw.id) ||
    sanitizeString(raw.kind)

  if (!generatorCandidate) {
    return null
  }

  const width = Math.max(1, Math.trunc(toNumber(raw.width ?? raw.columns, fallbackSize?.width ?? 1)))
  const height = Math.max(1, Math.trunc(toNumber(raw.height ?? raw.rows, fallbackSize?.height ?? 1)))
  const tileSize = Math.max(4, Math.trunc(toNumber(raw.tileSize ?? raw.tile_size ?? raw.pixelSize, 16)))

  const options =
    raw.options && typeof raw.options === 'object' && !Array.isArray(raw.options)
      ? { ...raw.options }
      : {}

  const variant = sanitizeString(raw.variant)

  return {
    generator: generatorCandidate,
    width,
    height,
    tileSize,
    options,
    anchor: sanitizeAnchor(raw.anchor),
    offset: sanitizeOffset(raw.offset ?? raw.positionOffset),
    scale: sanitizeScale(raw.scale),
    ...(variant ? { variant } : {})
  }
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

  const appearance = sanitizeAppearance(definition.appearance ?? definition.sprite, {
    fallbackSize: { width: 1, height: 1 }
  })

  return {
    id,
    name,
    description,
    interaction,
    behaviour,
    metadata,
    appearance,
    source: filePath
  }
}

const dedupeDirectories = (directories) => {
  const seen = new Set()
  return directories.filter((directory) => {
    const key = directory.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const findReadableDirectory = async (directory) => {
  const candidates = dedupeDirectories([
    ...(directory ? [path.resolve(directory)] : []),
    ...ENVIRONMENT_DIRECTORIES,
    ...DEFAULT_DIRECTORIES
  ])

  for (const candidate of candidates) {
    try {
      const entries = await fs.readdir(candidate, { withFileTypes: true })
      return { directory: candidate, entries }
    } catch (error) {
      // Continue with other candidates
    }
  }

  return { directory: null, entries: [] }
}

const ensureDefinitionsLoaded = async ({ directory = null, force = false } = {}) => {
  if (STATE.loaded && !force && (!directory || STATE.directory === path.resolve(directory))) {
    return STATE
  }

  const { directory: resolvedDirectory, entries } = await findReadableDirectory(directory)

  if (!resolvedDirectory || entries.length === 0) {
    if (!STATE.loaded || force) {
      console.warn('[objects] No se encontraron definiciones de objetos disponibles')
      STATE.loaded = true
      STATE.directory = null
      STATE.definitions = new Map()
    }
    return STATE
  }

  const resolvedPath = path.resolve(resolvedDirectory)

  if (STATE.directory !== resolvedPath || force) {
    console.info(`[objects] Cargando definiciones desde ${resolvedPath}`)
  }

  const definitions = new Map()

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.obj')) {
      continue
    }

    const filePath = path.join(resolvedPath, entry.name)
    try {
      const definition = await loadObjectFile(filePath)
      definitions.set(definition.id, definition)
    } catch (error) {
      console.error(`[objects] Error al cargar ${entry.name}:`, error.message)
    }
  }

  STATE.loaded = true
  STATE.directory = resolvedPath
  STATE.definitions = definitions

  console.info(`[objects] Se cargaron ${definitions.size} definiciones de objetos`)

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

  const baseAppearance = sanitizeAppearance(definition?.appearance, { fallbackSize: size })
  const metadataAppearance = sanitizeAppearance(metadata.appearance, { fallbackSize: size })
  const explicitAppearance = sanitizeAppearance(objectDefinition.appearance, { fallbackSize: size })
  delete metadata.appearance

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

  const appearance = explicitAppearance ?? metadataAppearance ?? baseAppearance

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
    interaction,
    ...(appearance ? { appearance } : {})
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
