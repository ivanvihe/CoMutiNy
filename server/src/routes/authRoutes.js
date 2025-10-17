import { Router } from 'express'

import { currentUser, login, register } from '../controllers/authController.js'
import { authenticate } from '../middlewares/auth.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', authenticate, currentUser)

export default router
