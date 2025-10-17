import { Router } from 'express'

import { listUsers, updateUser, deleteUser } from '../controllers/adminUserController.js'
import {
  listSpriteAssets,
  createSpriteAsset,
  updateSpriteAsset,
  deleteSpriteAsset,
  listSpriteGenerators,
  generateSpriteAsset,
  listLandscapeAssets,
  createLandscapeAsset,
  updateLandscapeAsset,
  deleteLandscapeAsset
} from '../controllers/adminAssetController.js'
import { listMessages } from '../controllers/adminMessageController.js'
import { authenticate } from '../middlewares/auth.js'
import { requireAdmin } from '../middlewares/authorizeAdmin.js'

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/users', listUsers)
router.patch('/users/:id', updateUser)
router.delete('/users/:id', deleteUser)

router.get('/messages', listMessages)

router.get('/assets/sprites', listSpriteAssets)
router.post('/assets/sprites', createSpriteAsset)
router.patch('/assets/sprites/:id', updateSpriteAsset)
router.delete('/assets/sprites/:id', deleteSpriteAsset)
router.get('/assets/sprites/generators', listSpriteGenerators)
router.post('/assets/sprites/generate', generateSpriteAsset)

router.get('/assets/landscapes', listLandscapeAssets)
router.post('/assets/landscapes', createLandscapeAsset)
router.patch('/assets/landscapes/:id', updateLandscapeAsset)
router.delete('/assets/landscapes/:id', deleteLandscapeAsset)

export default router
