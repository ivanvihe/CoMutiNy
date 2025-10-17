import userRepository from '../repositories/UserRepository.js'
import sanitizeUser from '../utils/sanitizeUser.js'

const parsePagination = (query = {}) => {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
  const offset = Math.max(Number(query.offset) || 0, 0)

  return { limit, offset }
}

export const listUsers = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query)
    const result = await userRepository.list({ limit, offset })

    const users = (result?.rows ?? []).map((user) => sanitizeUser(user))

    res.json({
      total: result.count ?? users.length,
      limit,
      offset,
      users
    })
  } catch (error) {
    next(error)
  }
}

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params
    const body = req.body ?? {}
    const updates = {}

    if (body.role !== undefined) {
      if (!['user', 'admin'].includes(body.role)) {
        return res.status(400).json({ message: 'role must be "user" or "admin"' })
      }

      if (req.user?.id === id) {
        return res.status(400).json({ message: 'You cannot modify your own role' })
      }

      updates.role = body.role
    }

    const moderationFieldsProvided =
      body.isBanned !== undefined || body.suspensionUntil !== undefined || body.suspensionReason !== undefined

    if (moderationFieldsProvided && req.user?.id === id) {
      return res.status(400).json({ message: 'You cannot modify your own moderation status' })
    }

    if (body.isBanned !== undefined) {
      updates.isBanned = Boolean(body.isBanned)

      if (updates.isBanned) {
        updates.suspensionUntil = null
      }
    }

    if (body.suspensionUntil !== undefined) {
      if (body.suspensionUntil === null || body.suspensionUntil === '') {
        updates.suspensionUntil = null
      } else {
        const until = new Date(body.suspensionUntil)

        if (Number.isNaN(until.getTime())) {
          return res.status(400).json({ message: 'suspensionUntil must be a valid date' })
        }

        updates.suspensionUntil = until
        updates.isBanned = false
      }
    }

    if (body.suspensionReason !== undefined) {
      if (body.suspensionReason === null || body.suspensionReason === '') {
        updates.moderationReason = null
      } else if (typeof body.suspensionReason === 'string') {
        const trimmed = body.suspensionReason.trim()
        updates.moderationReason = trimmed ? trimmed.slice(0, 500) : null
      } else {
        return res.status(400).json({ message: 'suspensionReason must be a string' })
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No updates provided' })
    }

    const updated = await userRepository.update(id, updates)

    if (!updated) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({ user: sanitizeUser(updated) })
  } catch (error) {
    next(error)
  }
}

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params

    if (req.user?.id === id) {
      return res.status(400).json({ message: 'You cannot delete your own account' })
    }

    const deleted = await userRepository.delete(id)

    if (!deleted) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
