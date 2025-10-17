import mapService from '../services/mapService.js'

const parsePagination = (query) => {
  const limit = Math.max(1, Math.min(Number(query.limit) || 20, 100))
  const offset = Math.max(0, Number(query.offset) || 0)
  return { limit, offset }
}

const mapController = {
  async listMaps (req, res, next) {
    try {
      const pagination = parsePagination(req.query ?? {})
      const result = await mapService.listMaps(pagination)
      res.json(result)
    } catch (error) {
      next(error)
    }
  },

  async getMap (req, res, next) {
    try {
      const map = await mapService.getMap(req.params.mapId)
      if (!map) {
        res.status(404).json({ message: 'Mapa no encontrado.' })
        return
      }
      res.json(map)
    } catch (error) {
      next(error)
    }
  },

  async createMap (req, res, next) {
    try {
      const created = await mapService.createMap(req.body)
      res.status(201).json(created)
    } catch (error) {
      next(error)
    }
  },

  async updateMap (req, res, next) {
    try {
      const updated = await mapService.updateMap(req.params.mapId, req.body)
      if (!updated) {
        res.status(404).json({ message: 'Mapa no encontrado.' })
        return
      }
      res.json(updated)
    } catch (error) {
      next(error)
    }
  },

  async deleteMap (req, res, next) {
    try {
      const deleted = await mapService.deleteMap(req.params.mapId)
      if (!deleted) {
        res.status(404).json({ message: 'Mapa no encontrado.' })
        return
      }
      res.status(204).send()
    } catch (error) {
      next(error)
    }
  },

  async createObject (req, res, next) {
    try {
      const created = await mapService.createObject(req.params.mapId, req.body)
      if (!created) {
        res.status(404).json({ message: 'Mapa no encontrado.' })
        return
      }
      res.status(201).json(created)
    } catch (error) {
      next(error)
    }
  },

  async updateObject (req, res, next) {
    try {
      const updated = await mapService.updateObject(req.params.mapId, req.params.objectId, req.body)
      if (!updated) {
        res.status(404).json({ message: 'Objeto o mapa no encontrado.' })
        return
      }
      res.json(updated)
    } catch (error) {
      next(error)
    }
  },

  async deleteObject (req, res, next) {
    try {
      const deleted = await mapService.deleteObject(req.params.mapId, req.params.objectId)
      if (!deleted) {
        res.status(404).json({ message: 'Objeto o mapa no encontrado.' })
        return
      }
      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
}

export default mapController
