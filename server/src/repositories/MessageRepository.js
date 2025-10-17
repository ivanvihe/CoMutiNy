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

  async listRecent ({ limit = 50, offset = 0 } = {}) {
    return Message.findAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user' },
        { model: Avatar, as: 'avatar' }
      ]
    })
  }

  async delete (id) {
    return Message.destroy({ where: { id } })
  }
}

const messageRepository = new MessageRepository()

export default messageRepository
