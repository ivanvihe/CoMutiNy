import { Router } from 'express'

import { getSpriteAtlas, listSpriteAssets } from '../controllers/publicAssetController.js'

const router = Router()

router.get('/sprites', listSpriteAssets)
router.get('/sprites/atlas', getSpriteAtlas)

export default router
