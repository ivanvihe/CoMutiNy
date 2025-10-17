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
    const { role } = req.body ?? {}

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'role must be "user" or "admin"' })
    }

    if (req.user?.id === id) {
      return res.status(400).json({ message: 'You cannot modify your own role' })
    }

    const updated = await userRepository.update(id, { role })

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
