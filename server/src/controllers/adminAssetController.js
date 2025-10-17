import spriteAssetRepository from '../repositories/SpriteAssetRepository.js'
import landscapeAssetRepository from '../repositories/LandscapeAssetRepository.js'
import spriteGenerationService from '../sprites/spriteGenerationService.js'

const toPlain = (record) => {
  if (!record) {
    return null
  }

  return typeof record.get === 'function' ? record.get({ plain: true }) : { ...record }
}

const parsePagination = (query = {}) => {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100)
  const offset = Math.max(Number(query.offset) || 0, 0)

  return { limit, offset }
}

const parseMetadata = (value) => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (typeof value === 'object') {
    return value
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch (error) {
      throw new Error('metadata must be valid JSON')
    }
  }

  throw new Error('metadata must be an object or JSON string')
}

const buildListHandler = (repository) => async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query)
    const result = await repository.list({ limit, offset })
    const assets = (result?.rows ?? []).map((asset) => toPlain(asset))

    res.json({
      total: result.count ?? assets.length,
      limit,
      offset,
      assets
    })
  } catch (error) {
    next(error)
  }
}

const buildCreateHandler = (repository) => async (req, res, next) => {
  try {
    const { name, category, imageUrl, metadata } = req.body ?? {}

    if (!name || !category || !imageUrl) {
      return res.status(400).json({ message: 'name, category and imageUrl are required' })
    }

    let parsedMetadata = null

    if (metadata !== undefined) {
      parsedMetadata = parseMetadata(metadata)
    }

    const created = await repository.create({
      name: name.trim(),
      category: category.trim(),
      imageUrl: imageUrl.trim(),
      metadata: parsedMetadata
    })

    res.status(201).json({ asset: toPlain(created) })
  } catch (error) {
    if (error.message?.includes('metadata')) {
      return res.status(400).json({ message: error.message })
    }

    next(error)
  }
}

const buildUpdateHandler = (repository) => async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, category, imageUrl, metadata } = req.body ?? {}

    const payload = {}

    if (name !== undefined) {
      if (!name) {
        return res.status(400).json({ message: 'name cannot be empty' })
      }
      payload.name = name.trim()
    }

    if (category !== undefined) {
      if (!category) {
        return res.status(400).json({ message: 'category cannot be empty' })
      }
      payload.category = category.trim()
    }

    if (imageUrl !== undefined) {
      if (!imageUrl) {
        return res.status(400).json({ message: 'imageUrl cannot be empty' })
      }
      payload.imageUrl = imageUrl.trim()
    }

    if (metadata !== undefined) {
      payload.metadata = parseMetadata(metadata)
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'No updates provided' })
    }

    const updated = await repository.update(id, payload)

    if (!updated) {
      return res.status(404).json({ message: 'Asset not found' })
    }

    res.json({ asset: toPlain(updated) })
  } catch (error) {
    if (error.message?.includes('metadata')) {
      return res.status(400).json({ message: error.message })
    }

    next(error)
  }
}

const buildDeleteHandler = (repository) => async (req, res, next) => {
  try {
    const { id } = req.params
    const deleted = await repository.delete(id)

    if (!deleted) {
      return res.status(404).json({ message: 'Asset not found' })
    }

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

export const listSpriteAssets = buildListHandler(spriteAssetRepository)
export const createSpriteAsset = buildCreateHandler(spriteAssetRepository)
export const updateSpriteAsset = buildUpdateHandler(spriteAssetRepository)
export const deleteSpriteAsset = buildDeleteHandler(spriteAssetRepository)

export const listSpriteGenerators = (req, res) => {
  const generators = spriteGenerationService.listAvailableGenerators()
  res.json({ generators })
}

export const generateSpriteAsset = async (req, res, next) => {
  try {
    const { description, generator, width, height, palette, frames, name, category, metadata, stylePreset } = req.body ?? {}

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ message: 'description is required' })
    }

    const result = await spriteGenerationService.generateSprite({
      description,
      generator,
      width,
      height,
      palette,
      frames,
      name,
      category,
      metadata,
      stylePreset
    })

    res.status(201).json(result)
  } catch (error) {
    if (error?.message?.includes('description')) {
      return res.status(400).json({ message: error.message })
    }

    next(error)
  }
}

export const listLandscapeAssets = buildListHandler(landscapeAssetRepository)
export const createLandscapeAsset = buildCreateHandler(landscapeAssetRepository)
export const updateLandscapeAsset = buildUpdateHandler(landscapeAssetRepository)
export const deleteLandscapeAsset = buildDeleteHandler(landscapeAssetRepository)
