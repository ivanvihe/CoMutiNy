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
    if (!line || line.startsWith('#')) {
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

  const parts = value
    .split(/[x,]/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part))

  if (parts.length !== 2) {
    return null
  }

  return { x: parts[0], y: parts[1] }
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

  const size = parseDimensions(definition.dimensions ?? '')
  const spawn =
    parseCoordinate(definition.startingPoint ?? '') ??
    parseCoordinate(definition.spawnPoint ?? '') ??
    parseCoordinate(definition.spawn ?? '') ??
    (size
      ? { x: Math.floor(size.width / 2), y: Math.floor(size.height / 2) }
      : { x: 0, y: 0 })
  const doorPosition = parseCoordinate(definition.doorPosition ?? '')

  const fileName = filePath.split(path.sep).pop() ?? 'map'
  const rawId = typeof definition.id === 'string' ? definition.id.trim() : ''
  const id = rawId || fileName.replace(/\.map$/i, '')

  const title =
    (typeof definition.title === 'string' && definition.title.trim()) ||
    (typeof definition.name === 'string' && definition.name.trim()) ||
    id

  const registry = new Map()
  const objects = []

  if (doorPosition) {
    const doorId = ensureUniqueId(`${id}-door`, registry)
    objects.push({
      id: doorId,
      name: 'Acceso principal',
      label: 'Acceso principal',
      position: doorPosition,
      size: { width: 1, height: 1 },
      solid: false,
      metadata: { type: 'door', objectId: 'community_door', instanceId: doorId },
      objectId: 'community_door'
    })
  }

  const objectLines = sections.get('objects') ?? []
  const parsedObjects = parseObjects(objectLines, { registry })
  objects.push(...parsedObjects)

  const relativePath = path.relative(process.cwd(), filePath)

  return {
    id,
    name: title,
    biome: definition.biome ?? 'Comunidad',
    description: definition.description ?? '',
    size: size ?? { width: 0, height: 0 },
    spawn,
    blockedAreas: buildBlockedAreas(size),
    objects,
    portals: [],
    theme: { borderColour: definition.borderColour ?? null },
    sourcePath: relativePath
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
        console.info(
          `[maps] Parsed map "${definition.name}" (${definition.sourcePath}) ` +
            `with size ${definition.size.width}x${definition.size.height}`
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
