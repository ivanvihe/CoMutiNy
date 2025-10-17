import spriteAssetRepository from '../repositories/SpriteAssetRepository.js'

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

export const listSpriteAssets = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query)
    const result = await spriteAssetRepository.list({ limit, offset })
    const assets = (result?.rows ?? []).map((asset) => toPlain(asset))

    res.json({
      total: result?.count ?? assets.length,
      limit,
      offset,
      assets
    })
  } catch (error) {
    next(error)
  }
}

