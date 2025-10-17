import { Router } from 'express'
import mapController from '../controllers/mapController.js'

const router = Router()

router.get('/', mapController.listMaps)
router.post('/', mapController.createMap)
router.get('/:mapId', mapController.getMap)
router.put('/:mapId', mapController.updateMap)
router.delete('/:mapId', mapController.deleteMap)

router.post('/:mapId/objects', mapController.createObject)
router.put('/:mapId/objects/:objectId', mapController.updateObject)
router.delete('/:mapId/objects/:objectId', mapController.deleteObject)

export default router
