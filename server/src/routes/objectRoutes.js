import { Router } from 'express'
import objectController from '../controllers/objectController.js'

const router = Router()

router.get('/', objectController.listDefinitions)
router.get('/:objectId', objectController.getDefinition)

export default router
