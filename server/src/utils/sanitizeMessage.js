import sanitizeUser from './sanitizeUser.js'

const sanitizeMessage = (message) => {
  if (!message) {
    return null
  }

  const plain = typeof message?.get === 'function' ? message.get({ plain: true }) : { ...message }

  if (plain.user) {
    plain.user = sanitizeUser(plain.user)
  }

  if (plain.avatar) {
    const avatar = typeof plain.avatar?.get === 'function'
      ? plain.avatar.get({ plain: true })
      : { ...plain.avatar }

    plain.avatar = {
      id: avatar.id,
      name: avatar.name ?? null
    }
  }

  return plain
}

export default sanitizeMessage
