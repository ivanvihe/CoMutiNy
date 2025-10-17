import messageRepository from '../repositories/MessageRepository.js'
import sanitizeMessage from '../utils/sanitizeMessage.js'

const parsePagination = (query = {}) => {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
  const offset = Math.max(Number(query.offset) || 0, 0)

  return { limit, offset }
}

const parseFilters = (query = {}) => {
  const filters = {}

  if (typeof query.search === 'string' && query.search.trim()) {
    filters.search = query.search.trim()
  }

  if (typeof query.userId === 'string' && query.userId.trim()) {
    filters.userId = query.userId.trim()
  }

  if (typeof query.status === 'string' && query.status.trim()) {
    const normalized = query.status.trim().toLowerCase()

    if (['active', 'banned', 'suspended'].includes(normalized)) {
      filters.status = normalized
    } else if (normalized !== 'all') {
      const error = new Error('Invalid status filter')
      error.statusCode = 400
      throw error
    }
  }

  if (query.from) {
    const from = new Date(query.from)

    if (Number.isNaN(from.getTime())) {
      const error = new Error('from must be a valid date')
      error.statusCode = 400
      throw error
    }

    filters.from = from
  }

  if (query.to) {
    const to = new Date(query.to)

    if (Number.isNaN(to.getTime())) {
      const error = new Error('to must be a valid date')
      error.statusCode = 400
      throw error
    }

    filters.to = to
  }

  if (filters.from && filters.to && filters.from > filters.to) {
    const error = new Error('from must be before to')
    error.statusCode = 400
    throw error
  }

  return filters
}

export const listMessages = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query)
    const filters = parseFilters(req.query)

    const result = await messageRepository.search({ limit, offset, filters })
    const messages = (result?.rows ?? []).map((message) => sanitizeMessage(message))

    res.json({
      total: result?.count ?? messages.length,
      limit,
      offset,
      filters,
      messages
    })
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message })
    }

    next(error)
  }
}
