import { Router } from 'express'

import { listSpriteAssets } from '../controllers/publicAssetController.js'

const router = Router()

router.get('/sprites', listSpriteAssets)

export default router

