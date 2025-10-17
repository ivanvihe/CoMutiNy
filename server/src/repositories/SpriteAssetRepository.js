import { SpriteAsset } from '../database/models/index.js'

class SpriteAssetRepository {
  async create (payload) {
    return SpriteAsset.create(payload)
  }

  async findById (id) {
    return SpriteAsset.findByPk(id)
  }

  async findByCategory (category) {
    return SpriteAsset.findAll({ where: { category } })
  }

  async list ({ limit = 50, offset = 0 } = {}) {
    return SpriteAsset.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    })
  }

  async update (id, payload) {
    const [count, records] = await SpriteAsset.update(payload, {
      where: { id },
      returning: true
    })

    return count > 0 ? records[0] : null
  }

  async delete (id) {
    return SpriteAsset.destroy({ where: { id } })
  }
}

const spriteAssetRepository = new SpriteAssetRepository()

export default spriteAssetRepository
