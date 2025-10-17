import avatarRepository from '../repositories/AvatarRepository.js'

const sanitizeAvatar = (avatar) => {
  if (!avatar) {
    return null
  }

  return typeof avatar.get === 'function' ? avatar.get({ plain: true }) : { ...avatar }
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
    const { name, description, spriteAssetId } = req.body ?? {}

    const providedFields = {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(spriteAssetId !== undefined ? { spriteAssetId } : {})
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
        spriteAssetId: spriteAssetId ?? null
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
