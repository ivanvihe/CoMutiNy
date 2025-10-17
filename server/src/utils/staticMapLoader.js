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
    .replace(/[^a-z0-9]/g, '')

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

const normaliseMapDefinition = (filePath, rawContents) => {
  const definition = {}
  rawContents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const [key, ...rest] = line.split(':')
      if (!key || rest.length === 0) {
        return
      }
      const normalisedKey = toCamelCase(key)
      definition[normalisedKey] = rest.join(':').trim()
    })

  const size = parseDimensions(definition.dimensions ?? '')
  const spawn =
    parseCoordinate(definition.startingPoint ?? '') ??
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

  const width = size?.width ?? 0
  const height = size?.height ?? 0

  const blockedAreas = width && height
    ? [
        { x: 0, y: 0, width, height: 1 },
        { x: 0, y: height - 1, width, height: 1 },
        { x: 0, y: 0, width: 1, height },
        { x: width - 1, y: 0, width: 1, height }
      ]
    : []

  const objects = []
  if (doorPosition) {
    objects.push({
      id: `${id}-door`,
      name: 'Acceso principal',
      label: 'Acceso principal',
      position: doorPosition,
      size: { width: 1, height: 1 },
      solid: false,
      metadata: { type: 'door', objectId: 'community_door' }
    })
  }

  const relativePath = path.relative(process.cwd(), filePath)

  return {
    id,
    name: title,
    biome: definition.biome ?? 'Comunidad',
    description: definition.description ?? '',
    size: size ?? { width: 0, height: 0 },
    spawn,
    blockedAreas,
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
