import { Router } from 'express'

import { getMyAvatar, updateMyAvatar } from '../controllers/avatarController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.use(authenticate)
router.get('/me', getMyAvatar)
router.put('/me', updateMyAvatar)

export default router
