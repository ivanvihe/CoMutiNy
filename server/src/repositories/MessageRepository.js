import { Op, fn, col, where as sequelizeWhere } from 'sequelize'

import { Message, User, Avatar } from '../database/models/index.js'

class MessageRepository {
  async create (payload) {
    return Message.create(payload)
  }

  async findById (id) {
    return Message.findByPk(id, {
      include: [
        { model: User, as: 'user' },
        { model: Avatar, as: 'avatar' }
      ]
    })
  }

  async search ({ limit = 50, offset = 0, filters = {} } = {}) {
    const where = {}
    const userInclude = {
      model: User,
      as: 'user',
      attributes: ['id', 'username', 'email', 'role', 'isBanned', 'suspensionUntil', 'moderationReason'],
      required: false
    }

    if (filters.userId) {
      where.userId = filters.userId
    }

    if (filters.from || filters.to) {
      where.createdAt = {}

      if (filters.from) {
        where.createdAt[Op.gte] = filters.from
      }

      if (filters.to) {
        where.createdAt[Op.lte] = filters.to
      }
    }

    const now = new Date()

    if (filters.status === 'banned') {
      userInclude.where = { isBanned: true }
      userInclude.required = true
    } else if (filters.status === 'suspended') {
      userInclude.where = {
        isBanned: false,
        suspensionUntil: { [Op.gt]: now }
      }
      userInclude.required = true
    } else if (filters.status === 'active') {
      userInclude.where = {
        isBanned: false,
        [Op.or]: [
          { suspensionUntil: null },
          { suspensionUntil: { [Op.lte]: now } }
        ]
      }
      userInclude.required = true
    }

    const search = typeof filters.search === 'string' ? filters.search.trim() : ''

    if (search) {
      const normalized = search.toLowerCase()

      where[Op.or] = [
        { content: { [Op.iLike]: `%${normalized}%` } },
        sequelizeWhere(fn('LOWER', col('user.username')), { [Op.like]: `%${normalized}%` }),
        sequelizeWhere(fn('LOWER', col('user.email')), { [Op.like]: `%${normalized}%` })
      ]
    }

    return Message.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      where,
      distinct: true,
      include: [
        userInclude,
        { model: Avatar, as: 'avatar', attributes: ['id', 'name'] }
      ]
    })
  }

  async listRecent (options = {}) {
    const result = await this.search(options)

    return result.rows ?? []
  }

  async delete (id) {
    return Message.destroy({ where: { id } })
  }
}

const messageRepository = new MessageRepository()

export default messageRepository
