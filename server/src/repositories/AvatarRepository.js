import { Avatar, SpriteAsset, Message } from '../database/models/index.js'

class AvatarRepository {
  async create (payload) {
    return Avatar.create(payload)
  }

  async findById (id) {
    return Avatar.findByPk(id, {
      include: [
        { model: SpriteAsset, as: 'spriteAsset' },
        { model: Message, as: 'messages' }
      ]
    })
  }

  async findByUser (userId) {
    return Avatar.findAll({
      where: { userId },
      include: [{ model: SpriteAsset, as: 'spriteAsset' }],
      order: [['createdAt', 'ASC']]
    })
  }

  async findPrimaryByUser (userId) {
    return Avatar.findOne({
      where: { userId },
      include: [{ model: SpriteAsset, as: 'spriteAsset' }],
      order: [['createdAt', 'ASC']]
    })
  }

  async update (id, payload) {
    const [count, records] = await Avatar.update(payload, {
      where: { id },
      returning: true
    })

    return count > 0 ? records[0] : null
  }

  async delete (id) {
    return Avatar.destroy({ where: { id } })
  }
}

const avatarRepository = new AvatarRepository()

export default avatarRepository
