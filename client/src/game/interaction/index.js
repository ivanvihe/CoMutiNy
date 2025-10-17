const sanitizeString = (value, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback
  }
  const trimmed = value.trim()
  return trimmed || fallback
}

export const normaliseInteractionEvent = (
  payload = {},
  { fallbackTitle = 'Interacción', fallbackDescription = '' } = {}
) => {
  if (!payload || typeof payload !== 'object') {
    return {
      type: 'message',
      title: fallbackTitle,
      description: fallbackDescription,
      message: fallbackDescription
    }
  }

  const type = sanitizeString(payload.type, 'message')
  const title = sanitizeString(payload.title, fallbackTitle)
  const description = sanitizeString(payload.description, fallbackDescription)
  const message = sanitizeString(payload.message, description)

  const event = {
    type,
    title,
    description,
    message
  }

  if (payload.icon) {
    event.icon = payload.icon
  }

  if (payload.animation) {
    event.animation = payload.animation
  }

  if (payload.metadata && typeof payload.metadata === 'object') {
    event.metadata = { ...payload.metadata }
  }

  if (payload.objectId) {
    event.objectId = payload.objectId
  }

  if (payload.objectName) {
    event.objectName = payload.objectName
  }

  if (payload.mapId) {
    event.mapId = payload.mapId
  }

  if (payload.actor && typeof payload.actor === 'object') {
    event.actor = { ...payload.actor }
  }

  event.timestamp = sanitizeString(payload.timestamp, new Date().toISOString())

  return event
}

export const createErrorEvent = (message, { title = 'Sin respuesta', description = '' } = {}) => ({
  type: 'error',
  title,
  description: description || message || 'No se pudo completar la interacción.',
  message: message || description || 'No se pudo completar la interacción.',
  timestamp: new Date().toISOString()
})

export const buildInteractionRequest = ({ objectId, mapId, action = 'interact' }) => ({
  objectId,
  mapId,
  action
})
