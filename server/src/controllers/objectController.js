import objectService from '../services/objectService.js'

const objectController = {
  async listDefinitions (req, res, next) {
    try {
      const definitions = await objectService.listDefinitions()
      res.json({ items: definitions, total: definitions.length })
    } catch (error) {
      next(error)
    }
  },

  async getDefinition (req, res, next) {
    try {
      const definition = await objectService.getDefinition(req.params.objectId)
      if (!definition) {
        res.status(404).json({ message: 'Objeto no encontrado.' })
        return
      }

      res.json(definition)
    } catch (error) {
      next(error)
    }
  }
}

export default objectController
