import fs from 'node:fs/promises'
import path from 'node:path'
import { Buffer } from 'node:buffer'

const DEFAULT_DIRECTORIES = [
  '/app/objects',
  path.resolve(process.cwd(), 'app', 'objects'),
  path.resolve(process.cwd(), 'objects')
]

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
  process.env.APP_OBJECT_DIRECTORIES ??
    process.env.APP_OBJECT_DIRECTORY ??
    process.env.OBJECTS_DIRECTORY
)

const STATE = {
  loaded: false,
  directory: null,
  definitions: new Map()
}

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(Math.max(value, min), max)
}

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const sanitizeString = (value, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed || fallback
}

const isPlainObject = (candidate) =>
  Boolean(candidate) && typeof candidate === 'object' && !Array.isArray(candidate)

const sanitizeSerializable = (value, depth = 0) => {
  if (depth > 10) {
    return undefined
  }

  if (value === null) {
    return null
  }

  const valueType = typeof value

  if (['string', 'number', 'boolean'].includes(valueType)) {
    return value
  }

  if (valueType === 'bigint') {
    return Number(value)
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeSerializable(entry, depth + 1))
      .filter((entry) => entry !== undefined)
  }

  if (valueType === 'object') {
    const result = {}
    for (const [key, entry] of Object.entries(value)) {
      const sanitized = sanitizeSerializable(entry, depth + 1)
      if (sanitized !== undefined) {
        result[key] = sanitized
      }
    }
    return result
  }

  return undefined
}

const sanitizeScale = (raw) => {
  if (raw === undefined || raw === null) {
    return { x: 1, y: 1 }
  }

  if (typeof raw === 'number') {
    const value = clamp(raw, 0.1, 6)
    return { x: value, y: value }
  }

  if (isPlainObject(raw)) {
    const x = clamp(toNumber(raw.x, 1), 0.1, 6)
    const y = clamp(toNumber(raw.y, 1), 0.1, 6)
    return { x, y }
  }

  return { x: 1, y: 1 }
}

const sanitizeAnchor = (raw) => {
  if (!isPlainObject(raw)) {
    return { x: 0.5, y: 1 }
  }

  const x = clamp(toNumber(raw.x, 0.5), 0, 1)
  const y = clamp(toNumber(raw.y, 1), 0, 1.5)
  return { x, y }
}

const sanitizeOffset = (raw) => {
  if (!isPlainObject(raw)) {
    return { x: 0, y: 0 }
  }

  const x = toNumber(raw.x, 0)
  const y = toNumber(raw.y, 0)
  return { x, y }
}

const createMockContext = (width, height) => {
  const noop = () => {}
  const gradientFactory = () => ({ addColorStop: noop })
  const patternFactory = () => ({ setTransform: noop })

  const base = {
    canvas: { width, height },
    measureText: () => ({ width: 0 }),
    createLinearGradient: gradientFactory,
    createRadialGradient: gradientFactory,
    createPattern: patternFactory,
    getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: noop
  }

  const methodNames = [
    'beginPath',
    'closePath',
    'moveTo',
    'lineTo',
    'arc',
    'arcTo',
    'ellipse',
    'rect',
    'roundRect',
    'bezierCurveTo',
    'quadraticCurveTo',
    'fill',
    'stroke',
    'fillRect',
    'strokeRect',
    'clearRect',
    'fillText',
    'strokeText',
    'translate',
    'scale',
    'rotate',
    'save',
    'restore',
    'transform',
    'setTransform',
    'resetTransform',
    'drawImage',
    'clip',
    'setLineDash',
    'getLineDash',
    'strokePath'
  ]

  for (const method of methodNames) {
    base[method] = noop
  }

  return new Proxy(base, {
    get (target, property) {
      if (property in target) {
        return target[property]
      }

      if (typeof property === 'symbol') {
        return target[property]
      }

      target[property] = noop
      return target[property]
    },
    set (target, property, value) {
      target[property] = value
      return true
    }
  })
}

const validateCanvasGenerator = async (generator, { width, height, tileSize }) => {
  if (typeof generator !== 'function') {
    return
  }

  const pixelWidth = Math.max(1, width) * Math.max(4, tileSize)
  const pixelHeight = Math.max(1, height) * Math.max(4, tileSize)
  const context = createMockContext(pixelWidth, pixelHeight)

  try {
    const result = generator(context, {
      width,
      height,
      tileSize,
      pixelWidth,
      pixelHeight
    })
    if (result && typeof result.then === 'function') {
      await result
    }
  } catch (error) {
    throw new Error(`Error al ejecutar la función de dibujo: ${error.message}`)
  }
}

const sanitizeAppearance = async (raw, { fallbackSize } = {}) => {
  if (!isPlainObject(raw)) {
    return null
  }

  const generatorCandidate =
    raw.generator ??
    raw.draw ??
    raw.renderer ??
    raw.type ??
    raw.id ??
    raw.name ??
    raw.kind

  if (!generatorCandidate) {
    return null
  }

  const width = Math.max(1, Math.trunc(toNumber(raw.width ?? raw.columns, fallbackSize?.width ?? 1)))
  const height = Math.max(1, Math.trunc(toNumber(raw.height ?? raw.rows, fallbackSize?.height ?? 1)))
  const tileSize = Math.max(4, Math.trunc(toNumber(raw.tileSize ?? raw.tile_size ?? raw.pixelSize, 16)))
  const optionsCandidate = sanitizeSerializable(raw.options)
  const options = isPlainObject(optionsCandidate) ? optionsCandidate : {}

  let generatorType = 'reference'
  let generatorName = null
  let generatorSource = null

  if (typeof generatorCandidate === 'function') {
    await validateCanvasGenerator(generatorCandidate, { width, height, tileSize })
    generatorType = 'function'
    generatorName = sanitizeString(generatorCandidate.name, 'customGenerator')
    generatorSource = generatorCandidate.toString()
  } else {
    generatorName = sanitizeString(generatorCandidate)
  }

  if (!generatorName) {
    return null
  }

  const appearance = {
    generator: generatorName,
    width,
    height,
    tileSize,
    options,
    anchor: sanitizeAnchor(raw.anchor),
    offset: sanitizeOffset(raw.offset ?? raw.positionOffset),
    scale: sanitizeScale(raw.scale),
    generatorType
  }

  if (generatorSource) {
    appearance.generatorSource = generatorSource
  }

  if (raw.variant) {
    const variant = sanitizeString(raw.variant)
    if (variant) {
      appearance.variant = variant
    }
  }

  return appearance
}

const sanitizeDefinition = async (rawDefinition, { source }) => {
  if (!isPlainObject(rawDefinition)) {
    throw new Error('La definición debe exportar un objeto serializable')
  }

  const id = sanitizeString(rawDefinition.id)
  if (!id) {
    throw new Error('La definición no especifica un identificador válido')
  }

  const name = sanitizeString(rawDefinition.name, id)
  const description = sanitizeString(rawDefinition.description)

  const metadata = sanitizeSerializable(rawDefinition.metadata) ?? {}
  const appearance = await sanitizeAppearance(rawDefinition.appearance ?? rawDefinition.sprite, {
    fallbackSize: { width: 1, height: 1 }
  })

  if (!appearance) {
    throw new Error('La definición no declara una apariencia válida')
  }

  return {
    id,
    name,
    description,
    appearance,
    metadata: isPlainObject(metadata) ? metadata : {},
    source
  }
}

const readAsModule = async (contents) => {
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(contents, 'utf-8').toString('base64')}`
  const module = await import(moduleUrl)
  if (module?.default !== undefined) {
    return module.default
  }
  if (module?.definition !== undefined) {
    return module.definition
  }
  if (module?.object !== undefined) {
    return module.object
  }
  return module
}

const loadObjectDefinitionFile = async (filePath) => {
  const contents = await fs.readFile(filePath, 'utf-8')

  let rawDefinition
  try {
    rawDefinition = JSON.parse(contents)
  } catch (jsonError) {
    try {
      rawDefinition = await readAsModule(contents)
    } catch (moduleError) {
      throw new Error(`No se pudo interpretar el archivo: ${moduleError.message}`)
    }
  }

  if (typeof rawDefinition === 'function') {
    rawDefinition = rawDefinition()
  }

  if (rawDefinition && typeof rawDefinition.then === 'function') {
    rawDefinition = await rawDefinition
  }

  const definition = await sanitizeDefinition(rawDefinition, { source: filePath })
  return definition
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

export const ensureObjectDefinitionsLoaded = async ({ directory = null, force = false } = {}) => {
  if (STATE.loaded && !force) {
    const matchesDirectory = !directory || STATE.directory === path.resolve(directory)
    if (matchesDirectory) {
      return STATE
    }
  }

  const { directory: resolvedDirectory, entries } = await findReadableDirectory(directory)

  if (!resolvedDirectory || entries.length === 0) {
    if (!STATE.loaded || force) {
      STATE.loaded = true
      STATE.directory = resolvedDirectory
      STATE.definitions = new Map()
    }
    return STATE
  }

  const definitions = new Map()
  const resolvedPath = path.resolve(resolvedDirectory)

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.obj')) {
      continue
    }

    const filePath = path.join(resolvedPath, entry.name)
    try {
      const definition = await loadObjectDefinitionFile(filePath)
      definitions.set(definition.id, definition)
    } catch (error) {
      console.error(`[object-loader] Error al cargar ${entry.name}: ${error.message}`)
    }
  }

  STATE.loaded = true
  STATE.directory = resolvedPath
  STATE.definitions = definitions

  return STATE
}

export const listObjectDefinitions = async (options = {}) => {
  const state = await ensureObjectDefinitionsLoaded(options)
  return Array.from(state.definitions.values())
}

export const getObjectDefinition = async (objectId, options = {}) => {
  if (!objectId) {
    return null
  }

  const state = await ensureObjectDefinitionsLoaded(options)
  return state.definitions.get(objectId) ?? null
}

export const clearObjectDefinitionCache = () => {
  STATE.loaded = false
  STATE.directory = null
  STATE.definitions = new Map()
}

export default {
  ensureObjectDefinitionsLoaded,
  listObjectDefinitions,
  getObjectDefinition,
  clearObjectDefinitionCache
}
