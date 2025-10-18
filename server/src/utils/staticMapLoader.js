import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

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

const ENVIRONMENT_MAP_DIRECTORIES = parseDirectoryList(
  process.env.STATIC_MAP_DIRECTORIES ??
    process.env.STATIC_MAP_DIRECTORY ??
    process.env.MAP_DIRECTORY
)

const DEFAULT_MAP_DIRECTORIES = [
  path.resolve(moduleDir, '..', 'maps'),
  path.resolve(process.cwd(), 'server', 'maps'),
  path.resolve(process.cwd(), 'maps')
]
const MAP_FILE_EXTENSION = '.map'

const toCamelCase = (rawKey = '') =>
  rawKey
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+([a-z0-9])/g, (_, match) => match.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')

const SECTION_PATTERN = /^\[(?<name>[^\]]+)]$/
const OBJECT_PATTERN = new RegExp(
  String.raw`^(?:-\s*)?(?<solid>!)?(?<reference>[A-Za-z0-9_.-]+(?:#[A-Za-z0-9_.-]+)?)\s*(?:@|:)?\s*(?<x>\d+)(?:\s*(?:[x,]\s*|\s+)(?<y>\d+))(?:\s*\|\s*(?<label>.+))?$`
)

const normaliseSectionKey = (value = '') =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'meta'

const parseSections = (rawContents) => {
  const sections = new Map([
    ['meta', []]
  ])
  let current = 'meta'

  rawContents.split(/\r?\n/).forEach((rawLine) => {
    let line = rawLine.trim()
    if (!line) {
      return
    }

    if (line.startsWith('#') && !/^#\s*=/.test(line)) {
      return
    }

    const inlineComment = /\s+#(?![0-9A-Fa-f])/.exec(line)
    if (inlineComment) {
      line = line.slice(0, inlineComment.index).trim()
      if (!line) {
        return
      }
    }

    const sectionMatch = SECTION_PATTERN.exec(line)
    if (sectionMatch?.groups?.name) {
      current = normaliseSectionKey(sectionMatch.groups.name)
      if (!sections.has(current)) {
        sections.set(current, [])
      }
      return
    }

    if (!sections.has(current)) {
      sections.set(current, [])
    }
    sections.get(current).push(line)
  })

  return sections
}

const ensureUniqueId = (baseId, registry) => {
  if (!registry.has(baseId)) {
    registry.set(baseId, 1)
    return baseId
  }

  let suffix = registry.get(baseId)
  while (true) {
    suffix += 1
    const candidate = `${baseId}-${suffix}`
    if (!registry.has(candidate)) {
      registry.set(baseId, suffix)
      registry.set(candidate, 1)
      return candidate
    }
  }
}

const parseObjectLine = (line, { registry }) => {
  const match = OBJECT_PATTERN.exec(line)
  if (!match?.groups?.y) {
    throw new Error(`Entrada de objeto inválida: "${line}"`)
  }

  const reference = match.groups.reference
  const [objectId, rawInstance] = reference.split('#', 2)
  const baseInstance = (rawInstance || objectId || '').trim()

  if (!objectId) {
    throw new Error(`Objeto sin identificador en: "${line}"`)
  }

  const instanceId = ensureUniqueId(baseInstance || objectId, registry)
  const x = Number.parseInt(match.groups.x, 10)
  const y = Number.parseInt(match.groups.y, 10)
  const solid = Boolean(match.groups.solid)
  const label = match.groups.label ? match.groups.label.trim() : ''

  const metadata = { objectId }
  if (rawInstance) {
    metadata.originalInstanceId = rawInstance.trim()
  }
  metadata.instanceId = instanceId

  return {
    id: instanceId,
    name: label || instanceId,
    label: label || instanceId,
    solid,
    position: { x, y },
    size: { width: 1, height: 1 },
    metadata,
    objectId
  }
}

const parseObjects = (lines, { registry }) => {
  const objects = []

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      return
    }

    try {
      objects.push(parseObjectLine(line, { registry }))
    } catch (error) {
      throw new Error(`Error al procesar el objeto #${index + 1}: ${error.message}`)
    }
  })

  return objects
}

const parseBoolean = (value, defaultValue = false) => {
  if (value === null || value === undefined) {
    return defaultValue
  }

  const normalised = `${value}`.trim().toLowerCase()
  if (['true', '1', 'yes', 'y', 'on', 'solid'].includes(normalised)) {
    return true
  }
  if (['false', '0', 'no', 'n', 'off', 'transparent', 'none'].includes(normalised)) {
    return false
  }
  return defaultValue
}

const DEFAULT_TILE_TYPE = {
  id: 'floor',
  symbol: '.',
  name: 'Suelo',
  collides: false,
  transparent: true,
  color: '#8eb5ff',
  metadata: { default: true }
}

const TILE_DEFINITION_PATTERN = /^(.+?)\s*=\s*(.+)$/

const parseTileDefinitions = (lines = []) => {
  const tileTypes = new Map()
  const symbolMap = new Map()

  lines.forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line || !line.includes('=')) {
      return
    }

    if (line.startsWith('#') && !/^#\s*=/.test(line)) {
      return
    }

    const match = line.match(TILE_DEFINITION_PATTERN)

    if (!match) {
      throw new Error(`Definición de tile inválida: "${line}"`)
    }

    const symbol = match[1].trim()
    if (!symbol) {
      throw new Error(`Definición de tile sin símbolo: "${line}"`)
    }

    const remainder = match[2].trim()
    if (!remainder) {
      throw new Error(`Definición de tile sin contenido: "${line}"`)
    }

    const tokens = remainder
      .split(';')
      .map((token) => token.trim())
      .filter(Boolean)

    if (!tokens.length) {
      throw new Error(`Definición de tile incompleta: "${line}"`)
    }

    const [tileId, ...propertyTokens] = tokens
    if (!tileId) {
      throw new Error(`Tile sin identificador: "${line}"`)
    }

    const properties = new Map()
    propertyTokens.forEach((token) => {
      if (token.includes('=')) {
        const [key, value] = token.split('=', 2)
        properties.set(normaliseSectionKey(key), value.trim())
      } else {
        properties.set(normaliseSectionKey(token), 'true')
      }
    })

    const name = properties.get('name') ?? properties.get('label') ?? tileId
    const collides = parseBoolean(
      properties.get('collides') ?? properties.get('solid') ?? properties.get('collision'),
      false
    )
    const transparent = parseBoolean(properties.get('transparent'), true)
    const color = properties.get('color') ?? properties.get('colour') ?? null

    const metadata = {}
    properties.forEach((value, key) => {
      if (
        ![
          'name',
          'label',
          'collides',
          'solid',
          'collision',
          'transparent',
          'color',
          'colour'
        ].includes(key)
      ) {
        metadata[key] = value
      }
    })

    const definition = {
      id: tileId,
      symbol,
      name,
      collides,
      transparent,
      ...(color ? { color } : {}),
      metadata
    }

    if (symbolMap.has(symbol) && symbolMap.get(symbol) !== tileId) {
      throw new Error(
        `El símbolo "${symbol}" ya está asignado a "${symbolMap.get(symbol)}"`
      )
    }

    tileTypes.set(tileId, definition)
    symbolMap.set(symbol, tileId)
  })

  if (!tileTypes.size) {
    tileTypes.set(DEFAULT_TILE_TYPE.id, { ...DEFAULT_TILE_TYPE })
    symbolMap.set(DEFAULT_TILE_TYPE.symbol, DEFAULT_TILE_TYPE.id)
  }

  return { tileTypes, symbolMap }
}

const tokeniseLayerRow = (line) => {
  const tokens = line.split(/\s+/).filter(Boolean)
  if (tokens.length === 1 && tokens[0].length > 1) {
    return [...tokens[0]]
  }
  if (!tokens.length && line.trim()) {
    return [...line.trim()]
  }
  return tokens
}

const resolveTileReference = (token, { tileTypes, symbolMap }) => {
  const trimmed = token.trim()
  if (!trimmed) {
    return null
  }

  const lowered = trimmed.toLowerCase()
  if (['none', 'empty', 'void', 'transparent'].includes(lowered)) {
    return null
  }

  if (symbolMap.has(trimmed)) {
    return symbolMap.get(trimmed)
  }

  if (tileTypes.has(trimmed)) {
    return trimmed
  }

  throw new Error(`Tile desconocido en capa: "${token}"`)
}

const parseKeyValueLines = (lines = []) => {
  const result = new Map()
  lines.forEach((line) => {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) {
      return
    }
    const key = normaliseSectionKey(line.slice(0, separatorIndex))
    if (!key) {
      return
    }
    const value = line.slice(separatorIndex + 1).trim()
    result.set(key, value)
  })
  return result
}

const parseLayerSections = (sections, { tileTypes, symbolMap }) => {
  const layers = []

  sections.forEach((lines, key) => {
    if (!key.startsWith('layer')) {
      return
    }

    const properties = parseKeyValueLines(lines.filter((line) => line.includes(':')))
    const rawRows = lines.filter((line) => !line.includes(':'))

    const rows = []
    rawRows.forEach((raw) => {
      const cleaned = raw.trim()
      if (!cleaned || cleaned.startsWith('#')) {
        return
      }
      const tokens = tokeniseLayerRow(cleaned)
      if (!tokens.length) {
        return
      }
      const resolvedRow = tokens.map((token) =>
        resolveTileReference(token, { tileTypes, symbolMap })
      )
      rows.push(resolvedRow)
    })

    if (!rows.length) {
      return
    }

    const width = Math.max(...rows.map((row) => row.length))
    rows.forEach((row) => {
      if (row.length !== width) {
        throw new Error(`Todas las filas de la capa "${key}" deben tener el mismo ancho`)
      }
    })

    let layerId
    if (key === 'layer') {
      layerId = properties.get('id') ?? properties.get('name') ?? 'layer'
    } else if (key.startsWith('layer_')) {
      layerId = properties.get('id') ?? key.slice('layer_'.length)
    } else {
      const fallbackId = key.replace(/^layer_?/, '') || key
      layerId = properties.get('id') ?? fallbackId
    }
    layerId = layerId || `layer_${layers.length + 1}`

    const name = properties.get('name') ?? properties.get('label') ?? layerId
    let order = Number.parseInt(properties.get('order') ?? `${layers.length}`, 10)
    if (!Number.isFinite(order)) {
      order = layers.length
    }
    const visible = parseBoolean(properties.get('visible'), true)

    layers.push({
      id: layerId,
      name,
      order,
      visible,
      tiles: rows.map((row) => row.map((tile) => tile ?? null))
    })
  })

  layers.sort((a, b) => {
    if (a.order === b.order) {
      return a.id.localeCompare(b.id)
    }
    return a.order - b.order
  })

  return layers
}

const parseObjectLayerSections = (sections, { registry }) => {
  const layers = []

  sections.forEach((lines, key) => {
    if (!key.startsWith('objects')) {
      return
    }

    const properties = parseKeyValueLines(lines.filter((line) => line.includes(':')))
    const rawEntries = lines.filter((line) => !line.includes(':'))

    const parsed = parseObjects(rawEntries, { registry })

    if (!parsed.length && !properties.size) {
      return
    }

    let layerId
    if (key === 'objects') {
      layerId = properties.get('id') ?? properties.get('name') ?? 'objects'
    } else if (key.startsWith('objects_')) {
      layerId = properties.get('id') ?? key.slice('objects_'.length)
    } else {
      const fallbackId = key.replace(/^objects_?/, '') || key
      layerId = properties.get('id') ?? fallbackId
    }
    layerId = layerId || `objects_${layers.length + 1}`

    const name = properties.get('name') ?? properties.get('label') ?? layerId
    let order = Number.parseInt(properties.get('order') ?? `${layers.length}`, 10)
    if (!Number.isFinite(order)) {
      order = layers.length
    }
    const visible = parseBoolean(properties.get('visible'), true)

    layers.push({
      id: layerId,
      name,
      order,
      visible,
      objects: parsed
    })
  })

  layers.sort((a, b) => {
    if (a.order === b.order) {
      return a.id.localeCompare(b.id)
    }
    return a.order - b.order
  })

  return layers
}

const parseDimensions = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const [width, height] = value
    .split('x')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part) && part > 0)

  if (!width || !height) {
    return null
  }

  return { width, height }
}

const parseCoordinate = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const withSeparators = value
    .split(/[x,]/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part))

  if (withSeparators.length === 2) {
    return { x: withSeparators[0], y: withSeparators[1] }
  }

  const fallback = value
    .split(/\s+/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part))

  if (fallback.length === 2) {
    return { x: fallback[0], y: fallback[1] }
  }

  return null
}

const splitDoorEntries = (value = '') =>
  `${value}`
    .split(/[;,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)

const parseDoorEntry = (value) => {
  let coordinatePart = value
  let remainder = ''

  if (value.includes('->')) {
    const [rawCoordinate, rawRemainder = ''] = value.split('->', 2)
    coordinatePart = rawCoordinate
    remainder = rawRemainder
  } else if (value.includes(':')) {
    const [rawCoordinate, rawRemainder = ''] = value.split(':', 2)
    coordinatePart = rawCoordinate
    remainder = rawRemainder
  }

  const position = parseCoordinate(coordinatePart.trim())
  if (!position) {
    throw new Error(`Coordenada de puerta inválida: "${value}"`)
  }

  remainder = (remainder ?? '').trim()
  if (!remainder) {
    return { position, targetMap: null, targetPosition: null }
  }

  if (remainder.includes('@')) {
    const [mapPart = '', coordinateTarget = ''] = remainder.split('@', 2)
    const targetMap = mapPart.trim() || null
    const targetPosition = parseCoordinate(coordinateTarget.trim())
    if (coordinateTarget.trim() && !targetPosition) {
      throw new Error(`Coordenada destino inválida en puerta: "${value}"`)
    }
    return { position, targetMap, targetPosition }
  }

  return { position, targetMap: remainder || null, targetPosition: null }
}

const buildDoorDefinitions = (entries, { id, kind, registry }) => {
  const doors = []
  const objects = []

  entries.forEach((rawEntry, index) => {
    const { position, targetMap, targetPosition } = parseDoorEntry(rawEntry)
    const doorId = ensureUniqueId(`${id}-door-${kind}`, registry)
    doors.push({
      id: doorId,
      kind,
      position,
      ...(targetMap ? { targetMap } : {}),
      ...(targetPosition ? { targetPosition } : {}),
    })

    if (kind === 'out') {
      const metadata = {
        type: 'door',
        objectId: 'community_door',
        instanceId: doorId,
        doorKind: kind,
      }
      if (targetMap) {
        metadata.targetMap = targetMap
      }
      if (targetPosition) {
        metadata.targetPosition = targetPosition
      }

      const label = entries.length > 1 ? `Acceso ${index + 1}` : 'Acceso principal'

      objects.push({
        id: doorId,
        name: label,
        label,
        position,
        size: { width: 1, height: 1 },
        solid: false,
        metadata,
        objectId: 'community_door',
      })
    }
  })

  return { doors, objects }
}

const buildBlockedAreas = (size) => {
  const width = size?.width ?? 0
  const height = size?.height ?? 0

  if (!width || !height) {
    return []
  }

  return [
    { x: 0, y: 0, width, height: 1 },
    { x: 0, y: height - 1, width, height: 1 },
    { x: 0, y: 0, width: 1, height },
    { x: width - 1, y: 0, width: 1, height }
  ]
}

const normaliseMapDefinition = (filePath, rawContents) => {
  const sections = parseSections(rawContents)
  const definition = {}

  for (const line of sections.get('meta') ?? []) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) {
      continue
    }
    const key = line.slice(0, separatorIndex)
    const value = line.slice(separatorIndex + 1)
    if (!key) {
      continue
    }
    const normalisedKey = toCamelCase(key)
    definition[normalisedKey] = value.trim()
  }

  const { tileTypes, symbolMap } = parseTileDefinitions(sections.get('tiles') ?? [])
  let layers = parseLayerSections(sections, { tileTypes, symbolMap })

  let size = parseDimensions(definition.dimensions ?? '') ?? { width: 0, height: 0 }

  if (layers.length) {
    let layerWidth = 0
    let layerHeight = 0
    layers.forEach((layer) => {
      layerHeight = Math.max(layerHeight, layer.tiles.length)
      layer.tiles.forEach((row) => {
        layerWidth = Math.max(layerWidth, row.length)
      })
    })

    if (layerWidth && (size.width <= 0 || size.width !== layerWidth)) {
      size = { ...size, width: layerWidth }
    }
    if (layerHeight && (size.height <= 0 || size.height !== layerHeight)) {
      size = { ...size, height: layerHeight }
    }
  }

  if (!layers.length) {
    const fallbackWidth = size.width > 0 ? size.width : 1
    const fallbackHeight = size.height > 0 ? size.height : 1
    const defaultTileId = tileTypes.keys().next().value
    const fallbackTiles = Array.from({ length: fallbackHeight }, () =>
      Array.from({ length: fallbackWidth }, () => defaultTileId)
    )
    layers = [
      {
        id: 'ground',
        name: 'Ground',
        order: 0,
        visible: true,
        tiles: fallbackTiles
      }
    ]
    size = { width: fallbackWidth, height: fallbackHeight }
  }

  const spawn =
    parseCoordinate(definition.startingPoint ?? '') ??
    parseCoordinate(definition.spawnPoint ?? '') ??
    parseCoordinate(definition.spawn ?? '') ?? {
      x: size.width ? Math.floor(size.width / 2) : 0,
      y: size.height ? Math.floor(size.height / 2) : 0
    }
  const inboundDoorEntries = splitDoorEntries(definition.doorIn)
  const outboundDoorEntries = (() => {
    const explicit = splitDoorEntries(definition.doorOut)
    if (explicit.length) {
      return explicit
    }
    const legacy = parseCoordinate(definition.doorPosition ?? '')
    return legacy ? [`${legacy.x}x${legacy.y}`] : []
  })()

  const fileName = filePath.split(path.sep).pop() ?? 'map'
  const rawId = typeof definition.id === 'string' ? definition.id.trim() : ''
  const id = rawId || fileName.replace(/\.map$/i, '')

  const title =
    (typeof definition.title === 'string' && definition.title.trim()) ||
    (typeof definition.name === 'string' && definition.name.trim()) ||
    id

  const registry = new Map()
  const objects = []
  const doors = []

  if (outboundDoorEntries.length) {
    const { doors: parsed, objects: doorObjects } = buildDoorDefinitions(outboundDoorEntries, {
      id,
      kind: 'out',
      registry,
    })
    doors.push(...parsed)
    objects.push(...doorObjects)
  }

  if (inboundDoorEntries.length) {
    const { doors: parsed } = buildDoorDefinitions(inboundDoorEntries, {
      id,
      kind: 'in',
      registry,
    })
    doors.push(...parsed)
  }

  const parsedLayers = parseObjectLayerSections(sections, { registry })

  const objectLayers = parsedLayers.map((layer, index) => {
    const layerOrder = Number.isFinite(layer.order) ? layer.order : index
    const layerVisible = layer.visible !== false

    const decoratedObjects = layer.objects.map((object) => ({
      ...object,
      layerId: layer.id,
      layerOrder,
      layerVisible,
      layer: {
        id: layer.id,
        name: layer.name,
        order: layerOrder,
        visible: layerVisible
      }
    }))

    objects.push(...decoratedObjects)

    return {
      id: layer.id,
      name: layer.name,
      order: layerOrder,
      visible: layerVisible,
      objects: decoratedObjects
    }
  })

  const collidableLookup = new Map()
  layers.forEach((layer) => {
    layer.tiles.forEach((row, y) => {
      row.forEach((tileId, x) => {
        if (!tileId) {
          return
        }
        const tile = tileTypes.get(tileId)
        if (tile?.collides) {
          const key = `${x},${y}`
          if (!collidableLookup.has(key)) {
            collidableLookup.set(key, { x, y })
          }
        }
      })
    })
  })

  const collidableTiles = Array.from(collidableLookup.values()).sort((a, b) => {
    if (a.y === b.y) {
      return a.x - b.x
    }
    return a.y - b.y
  })

  const tileTypeMap = {}
  tileTypes.forEach((value, key) => {
    const payload = {
      id: value.id,
      symbol: value.symbol,
      name: value.name,
      collides: Boolean(value.collides),
      transparent: Boolean(value.transparent)
    }
    if (value.color) {
      payload.color = value.color
    }
    if (value.metadata && Object.keys(value.metadata).length) {
      payload.metadata = { ...value.metadata }
    }
    tileTypeMap[key] = payload
  })

  const relativePath = path.relative(process.cwd(), filePath)

  return {
    id,
    name: title,
    biome: definition.biome ?? 'Comunidad',
    description: definition.description ?? '',
    size,
    spawn,
    blockedAreas: buildBlockedAreas(size),
    objects,
    objectLayers,
    portals: [],
    doors,
    theme: { borderColour: definition.borderColour ?? null },
    sourcePath: relativePath,
    tileTypes: tileTypeMap,
    layers,
    collidableTiles
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
    ...ENVIRONMENT_MAP_DIRECTORIES,
    ...DEFAULT_MAP_DIRECTORIES
  ])

  for (const candidate of candidates) {
    try {
      const entries = await fs.readdir(candidate, { withFileTypes: true })
      return { directory: candidate, entries }
    } catch (error) {
      // Continue trying other candidates
    }
  }

  return { directory: null, entries: [] }
}

export const loadStaticMapDefinitions = async (directory) => {
  const { directory: resolvedDirectory, entries } = await findReadableDirectory(directory)

  if (!resolvedDirectory || entries.length === 0) {
    console.warn('[maps] No static map definitions found')
    return []
  }

  console.info(`[maps] Loading static maps from ${resolvedDirectory}`)

  const definitions = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(MAP_FILE_EXTENSION))
      .map(async (entry) => {
        const filePath = path.join(resolvedDirectory, entry.name)
        const rawContents = await fs.readFile(filePath, 'utf-8')
        const definition = normaliseMapDefinition(filePath, rawContents)
        const objectCount = Array.isArray(definition.objects) ? definition.objects.length : 0
        const layerCount = Array.isArray(definition.objectLayers) ? definition.objectLayers.length : 0
        console.info(
          `[maps] Parsed map "${definition.name}" (${definition.sourcePath}) ` +
            `with size ${definition.size.width}x${definition.size.height}, ` +
            `${objectCount} objects and ${layerCount} object layers`
        )
        return definition
      })
  )

  definitions.sort((a, b) => {
    const aIsInit = /(^|\/)init\.map$/i.test(a.sourcePath ?? '')
    const bIsInit = /(^|\/)init\.map$/i.test(b.sourcePath ?? '')
    if (aIsInit && !bIsInit) {
      return -1
    }
    if (bIsInit && !aIsInit) {
      return 1
    }
    return a.name.localeCompare(b.name)
  })

  return definitions
}

export default loadStaticMapDefinitions
