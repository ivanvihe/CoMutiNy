import { sequelize, GameMap, MapObject } from '../database/models/index.js'

class MapRepository {
  async list ({ limit = 20, offset = 0 } = {}) {
    return GameMap.findAndCountAll({
      limit,
      offset,
      distinct: true,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: MapObject,
          as: 'objects',
          separate: true,
          order: [['createdAt', 'ASC']]
        }
      ]
    })
  }

  async findById (id, { transaction } = {}) {
    const map = await GameMap.findByPk(id, {
      transaction,
      include: [
        {
          model: MapObject,
          as: 'objects'
        }
      ]
    })

    if (map?.objects?.length) {
      map.objects.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    }

    return map
  }

  async createMap (mapAttributes, objects = []) {
    return sequelize.transaction(async (transaction) => {
      const createdMap = await GameMap.create(mapAttributes, { transaction })

      if (objects.length > 0) {
        const payload = objects.map((object) => ({
          ...object,
          mapId: createdMap.id
        }))
        await MapObject.bulkCreate(payload, { transaction })
      }

      return this.findById(createdMap.id, { transaction })
    })
  }

  async updateMap (mapId, mapAttributes, { replaceObjects = null, objects = [] } = {}) {
    return sequelize.transaction(async (transaction) => {
      const map = await GameMap.findByPk(mapId, { transaction })

      if (!map) {
        return null
      }

      if (mapAttributes && Object.keys(mapAttributes).length > 0) {
        await map.update(mapAttributes, { transaction })
      }

      if (replaceObjects === true) {
        await MapObject.destroy({ where: { mapId }, transaction })
        if (objects.length > 0) {
          const payload = objects.map((object) => ({
            ...object,
            mapId
          }))
          await MapObject.bulkCreate(payload, { transaction })
        }
      }

      return this.findById(mapId, { transaction })
    })
  }

  async deleteMap (mapId) {
    return GameMap.destroy({ where: { id: mapId } })
  }

  async createObject (mapId, objectAttributes) {
    return sequelize.transaction(async (transaction) => {
      const map = await GameMap.findByPk(mapId, { transaction })

      if (!map) {
        return null
      }

      const created = await MapObject.create({
        ...objectAttributes,
        mapId
      }, { transaction })

      return MapObject.findByPk(created.id, { transaction })
    })
  }

  async updateObject (mapId, objectId, objectAttributes) {
    return sequelize.transaction(async (transaction) => {
      const mapObject = await MapObject.findOne({
        where: { id: objectId, mapId },
        transaction
      })

      if (!mapObject) {
        return null
      }

      await mapObject.update(objectAttributes, { transaction })

      return MapObject.findByPk(objectId, { transaction })
    })
  }

  async deleteObject (mapId, objectId) {
    return MapObject.destroy({ where: { id: objectId, mapId } })
  }
}

const mapRepository = new MapRepository()

export default mapRepository
