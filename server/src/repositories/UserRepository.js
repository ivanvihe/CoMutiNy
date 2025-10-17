import { User, Avatar, Message } from '../database/models/index.js'

class UserRepository {
  async create (payload) {
    return User.create(payload)
  }

  async findById (id) {
    return User.findByPk(id, {
      include: [
        { model: Avatar, as: 'avatars', include: [{ model: Message, as: 'messages' }] },
        { model: Message, as: 'messages' }
      ]
    })
  }

  async findByEmail (email) {
    return User.findOne({ where: { email } })
  }

  async findByUsername (username) {
    return User.findOne({ where: { username } })
  }

  async findByIdBasic (id) {
    return User.findByPk(id)
  }

  async list ({ limit = 20, offset = 0 } = {}) {
    return User.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true,
      include: [{ model: Avatar, as: 'avatars' }]
    })
  }

  async update (id, payload) {
    const [count, records] = await User.update(payload, {
      where: { id },
      returning: true
    })

    return count > 0 ? records[0] : null
  }

  async delete (id) {
    return User.destroy({ where: { id } })
  }
}

const userRepository = new UserRepository()

export default userRepository
