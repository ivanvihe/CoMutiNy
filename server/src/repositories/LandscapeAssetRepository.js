import { LandscapeAsset } from '../database/models/index.js'

class LandscapeAssetRepository {
  async create (payload) {
    return LandscapeAsset.create(payload)
  }

  async findById (id) {
    return LandscapeAsset.findByPk(id)
  }

  async list ({ limit = 50, offset = 0 } = {}) {
    return LandscapeAsset.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    })
  }

  async update (id, payload) {
    const [count, records] = await LandscapeAsset.update(payload, {
      where: { id },
      returning: true
    })

    return count > 0 ? records[0] : null
  }

  async delete (id) {
    return LandscapeAsset.destroy({ where: { id } })
  }
}

const landscapeAssetRepository = new LandscapeAssetRepository()

export default landscapeAssetRepository
