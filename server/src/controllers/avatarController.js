import avatarRepository from '../repositories/AvatarRepository.js'

const layerKeyMap = Object.freeze({
  hair: 'layerHair',
  face: 'layerFace',
  outfit: 'layerOutfit',
  shoes: 'layerShoes'
})

const extractLayerFields = (appearance) => {
  if (!appearance || typeof appearance !== 'object') {
    return {}
  }

  const layerFields = {}

  for (const [appearanceKey, modelKey] of Object.entries(layerKeyMap)) {
    if (appearance[appearanceKey] !== undefined) {
      layerFields[modelKey] = appearance[appearanceKey] ?? null
    }
  }

  return layerFields
}

const sanitizeAvatar = (avatar) => {
  if (!avatar) {
    return null
  }

  const plain = typeof avatar.get === 'function' ? avatar.get({ plain: true }) : { ...avatar }

  const appearance = Object.fromEntries(
    Object.entries(layerKeyMap).map(([appearanceKey, modelKey]) => [appearanceKey, plain[modelKey] ?? null])
  )

  return {
    ...plain,
    appearance
  }
}

export const getMyAvatar = async (req, res, next) => {
  try {
    const avatar = await avatarRepository.findPrimaryByUser(req.user.id)

    if (!avatar) {
      return res.json({ avatar: null })
    }

    res.json({ avatar: sanitizeAvatar(avatar) })
  } catch (error) {
    next(error)
  }
}

export const updateMyAvatar = async (req, res, next) => {
  try {
    const { name, description, spriteAssetId, appearance } = req.body ?? {}

    const providedFields = {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(spriteAssetId !== undefined ? { spriteAssetId } : {}),
      ...extractLayerFields(appearance)
    }

    if (Object.keys(providedFields).length === 0) {
      return res.status(400).json({ message: 'At least one field is required to update the avatar' })
    }

    let avatar = await avatarRepository.findPrimaryByUser(req.user.id)

    if (!avatar) {
      if (!name) {
        return res.status(400).json({ message: 'name is required when creating an avatar' })
      }

      avatar = await avatarRepository.create({
        userId: req.user.id,
        name,
        description: description ?? null,
        spriteAssetId: spriteAssetId ?? null,
        ...extractLayerFields(appearance)
      })

      const created = await avatarRepository.findById(avatar.id)
      return res.status(201).json({ avatar: sanitizeAvatar(created) })
    }

    await avatarRepository.update(avatar.id, providedFields)
    const updated = await avatarRepository.findById(avatar.id)

    res.json({ avatar: sanitizeAvatar(updated) })
  } catch (error) {
    next(error)
  }
}
