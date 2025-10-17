import { randomUUID } from 'node:crypto'
import mapRepository from '../repositories/mapRepository.js'
import loadStaticMapDefinitions from '../utils/staticMapLoader.js'

const slugify = (value) => {
  if (!value) {
    return ''
  }

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

const parseInteger = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.trunc(number) : NaN
}

const ensureDimension = (value, { required = false } = {}) => {
  const parsed = parseInteger(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    if (required) {
      throw new Error('Las dimensiones deben ser números positivos.')
    }
    return null
  }
  return Math.max(1, parsed)
}

const ensureCoordinate = (value, { min = 0, max = Number.POSITIVE_INFINITY } = {}) => {
  const parsed = parseInteger(value)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return Math.min(Math.max(parsed, min), max)
}

const normalizePalette = (input) => {
  if (!input) {
    return []
  }

  if (Array.isArray(input)) {
    return input
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
  }

  if (typeof input === 'string') {
    return input
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean)
  }

  return []
}

const normalizeMetadata = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }

  return { ...input }
}

const normalizeBlockedAreas = (input, { width, height }) => {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((area) => {
      if (!area || typeof area !== 'object') {
        return null
      }
      const x = ensureCoordinate(area.x, { min: 0, max: Math.max(width - 1, 0) })
      const y = ensureCoordinate(area.y, { min: 0, max: Math.max(height - 1, 0) })
      const areaWidth = ensureDimension(area.width)
      const areaHeight = ensureDimension(area.height)

      if (x === null || y === null || areaWidth === null || areaHeight === null) {
        return null
      }

      return { x, y, width: areaWidth, height: areaHeight }
    })
    .filter(Boolean)
}

const normalizeAction = (action) => {
  if (!action || typeof action !== 'object') {
    return null
  }

  const type = typeof action.type === 'string' ? action.type.trim() : ''
  if (!type) {
    return null
  }

  const label = typeof action.label === 'string' ? action.label.trim() : ''
  const payload = action.payload !== undefined ? action.payload : null
  const id = typeof action.id === 'string' && action.id.trim() ? action.id.trim() : randomUUID()

  const normalized = { id, type }

  if (label) {
    normalized.label = label
  }

  if (payload !== null) {
    normalized.payload = payload
  }

  if (action.metadata && typeof action.metadata === 'object' && !Array.isArray(action.metadata)) {
    normalized.metadata = { ...action.metadata }
  }

  return normalized
}

const normalizeActions = (input) => {
  if (!Array.isArray(input)) {
    return []
  }

  return input.map((action) => normalizeAction(action)).filter(Boolean)
}

const normalizeObject = (object, { width, height }) => {
  if (!object || typeof object !== 'object') {
    throw new Error('Objeto de mapa inválido.')
  }

  const name = typeof object.name === 'string' ? object.name.trim() : ''
  if (!name) {
    throw new Error('Cada objeto debe tener un nombre.')
  }

  const type = typeof object.type === 'string' ? object.type.trim() : null
  const description = typeof object.description === 'string' ? object.description.trim() : null
  const solid = Boolean(object.solid)

  const maxX = Math.max(width - 1, 0)
  const maxY = Math.max(height - 1, 0)

  const positionInput = object.position && typeof object.position === 'object' ? object.position : {}
  const positionX = ensureCoordinate(positionInput.x, { min: 0, max: maxX })
  const positionY = ensureCoordinate(positionInput.y, { min: 0, max: maxY })

  const sizeInput = object.size && typeof object.size === 'object' ? object.size : {}
  const sizeWidth = ensureDimension(sizeInput.width, { required: true })
  const sizeHeight = ensureDimension(sizeInput.height, { required: true })

  const palette = normalizePalette(object.palette)
  const metadata = normalizeMetadata(object.metadata)
  const actions = normalizeActions(object.actions)

  if (positionX === null || positionY === null) {
    throw new Error('Las posiciones de los objetos deben ser números enteros dentro del mapa.')
  }

  return {
    name,
    type,
    description,
    solid,
    position: { x: positionX, y: positionY },
    size: { width: sizeWidth, height: sizeHeight },
    palette,
    actions,
    metadata
  }
}

const prepareMapPayload = (payload, { partial = false, currentMap = null } = {}) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Datos de mapa inválidos.')
  }

  const mapAttributes = {}
  const sanitized = {}

  if (!partial || payload.name !== undefined) {
    const name = typeof payload.name === 'string' ? payload.name.trim() : ''
    if (!name) {
      throw new Error('El nombre del mapa es obligatorio.')
    }
    mapAttributes.name = name
    sanitized.name = name
  }

  if (!partial || payload.slug !== undefined || mapAttributes.name) {
    const slugSource =
      (typeof payload.slug === 'string' && payload.slug.trim()) ||
      mapAttributes.name ||
      ''
    const slug = slugify(slugSource)
    if (!slug) {
      throw new Error('Proporciona un identificador válido para el mapa.')
    }
    mapAttributes.slug = slug
  }

  if (payload.biome !== undefined || !partial) {
    const biome = typeof payload.biome === 'string' ? payload.biome.trim() : ''
    mapAttributes.biome = biome || null
  }

  if (payload.description !== undefined || !partial) {
    const description = typeof payload.description === 'string' ? payload.description.trim() : ''
    mapAttributes.description = description || null
  }

  const sizeInput =
    (payload.size && typeof payload.size === 'object' ? payload.size : null) ||
    (payload.dimensions && typeof payload.dimensions === 'object' ? payload.dimensions : null) ||
    null

  if (!partial || (sizeInput && (sizeInput.width !== undefined || sizeInput.height !== undefined))) {
    const width = ensureDimension(sizeInput?.width, { required: !partial })
    const height = ensureDimension(sizeInput?.height, { required: !partial })

    if (width !== null) {
      mapAttributes.width = width
      sanitized.width = width
    }
    if (height !== null) {
      mapAttributes.height = height
      sanitized.height = height
    }
  }

  const spawnInput = payload.spawn && typeof payload.spawn === 'object' ? payload.spawn : {}
  if (!partial || spawnInput.x !== undefined || spawnInput.y !== undefined) {
    const width =
      sanitized.width ??
      mapAttributes.width ??
      currentMap?.width ??
      ensureDimension(payload.width, { required: false }) ??
      1
    const height =
      sanitized.height ??
      mapAttributes.height ??
      currentMap?.height ??
      ensureDimension(payload.height, { required: false }) ??
      1

    const rawX = spawnInput.x ?? (!partial ? 0 : null)
    const rawY = spawnInput.y ?? (!partial ? 0 : null)
    const spawnX = ensureCoordinate(rawX, { min: 0, max: Math.max(width - 1, 0) })
    const spawnY = ensureCoordinate(rawY, { min: 0, max: Math.max(height - 1, 0) })

    if (spawnX === null || spawnY === null) {
      throw new Error('La posición de aparición debe estar dentro de los límites del mapa.')
    }

    mapAttributes.spawnX = spawnX
    mapAttributes.spawnY = spawnY
    sanitized.width = sanitized.width ?? width
    sanitized.height = sanitized.height ?? height
  }

  if (!partial || payload.palette !== undefined) {
    mapAttributes.palette = normalizePalette(payload.palette)
  }

  if (!partial || payload.blockedAreas !== undefined) {
    const width =
      sanitized.width ??
      mapAttributes.width ??
      currentMap?.width ??
      ensureDimension(payload.width, { required: false }) ??
      1
    const height =
      sanitized.height ??
      mapAttributes.height ??
      currentMap?.height ??
      ensureDimension(payload.height, { required: false }) ??
      1
    mapAttributes.blockedAreas = normalizeBlockedAreas(payload.blockedAreas, { width, height })
  }

  if (payload.metadata !== undefined || !partial) {
    mapAttributes.metadata = normalizeMetadata(payload.metadata)
  }

  let objects = []
  if (Array.isArray(payload.objects)) {
    const width =
      sanitized.width ??
      mapAttributes.width ??
      currentMap?.width ??
      ensureDimension(payload.width, { required: false }) ??
      1
    const height =
      sanitized.height ??
      mapAttributes.height ??
      currentMap?.height ??
      ensureDimension(payload.height, { required: false }) ??
      1
    objects = payload.objects.map((object) => normalizeObject(object, { width, height }))
  }

  return { mapAttributes, objects }
}

const serializeObject = (objectModel) => {
  if (!objectModel) {
    return null
  }

  const plain = typeof objectModel.get === 'function' ? objectModel.get({ plain: true }) : { ...objectModel }

  return {
    id: plain.id,
    name: plain.name,
    type: plain.type ?? null,
    description: plain.description ?? null,
    solid: Boolean(plain.solid),
    position: {
      x: plain.position?.x ?? 0,
      y: plain.position?.y ?? 0
    },
    size: {
      width: plain.size?.width ?? 1,
      height: plain.size?.height ?? 1
    },
    palette: Array.isArray(plain.palette) ? plain.palette : [],
    actions: Array.isArray(plain.actions) ? plain.actions : [],
    metadata: plain.metadata ?? null
  }
}

const serializeMap = (mapModel) => {
  if (!mapModel) {
    return null
  }

  const plain = typeof mapModel.get === 'function' ? mapModel.get({ plain: true }) : { ...mapModel }

  return {
    id: plain.id,
    slug: plain.slug,
    name: plain.name,
    biome: plain.biome ?? null,
    description: plain.description ?? null,
    size: {
      width: plain.width,
      height: plain.height
    },
    spawn: {
      x: plain.spawnX,
      y: plain.spawnY
    },
    palette: Array.isArray(plain.palette) ? plain.palette : [],
    blockedAreas: Array.isArray(plain.blockedAreas) ? plain.blockedAreas : [],
    metadata: plain.metadata ?? null,
    objects: Array.isArray(plain.objects) ? plain.objects.map((object) => serializeObject(object)) : []
  }
}

const mapService = {
  async listStaticMaps () {
    return await loadStaticMapDefinitions()
  },

  async listMaps ({ limit = 20, offset = 0 } = {}) {
    const { count, rows } = await mapRepository.list({ limit, offset })
    return {
      count,
      results: rows.map((map) => serializeMap(map))
    }
  },

  async getMap (mapId) {
    const map = await mapRepository.findById(mapId)
    if (!map) {
      return null
    }
    return serializeMap(map)
  },

  async createMap (payload) {
    const { mapAttributes, objects } = prepareMapPayload(payload, { partial: false })
    const created = await mapRepository.createMap(mapAttributes, objects)
    return serializeMap(created)
  },

  async updateMap (mapId, payload) {
    const current = await mapRepository.findById(mapId)
    if (!current) {
      return null
    }

    const { mapAttributes, objects } = prepareMapPayload(payload, {
      partial: true,
      currentMap: current
    })
    const replaceObjects = Array.isArray(payload.objects)
    const updated = await mapRepository.updateMap(mapId, mapAttributes, { replaceObjects, objects })
    if (!updated) {
      return null
    }
    return serializeMap(updated)
  },

  async deleteMap (mapId) {
    return mapRepository.deleteMap(mapId)
  },

  async createObject (mapId, payload) {
    const map = await mapRepository.findById(mapId)
    if (!map) {
      return null
    }

    const normalized = normalizeObject(payload, { width: map.width, height: map.height })
    const created = await mapRepository.createObject(mapId, normalized)
    return serializeObject(created)
  },

  async updateObject (mapId, objectId, payload) {
    const map = await mapRepository.findById(mapId)
    if (!map) {
      return null
    }

    const normalized = normalizeObject(payload, { width: map.width, height: map.height })
    const updated = await mapRepository.updateObject(mapId, objectId, normalized)
    if (!updated) {
      return null
    }
    return serializeObject(updated)
  },

  async deleteObject (mapId, objectId) {
    return mapRepository.deleteObject(mapId, objectId)
  }
}

export default mapService
