const sanitizeUser = (user) => {
  if (!user) {
    return null
  }

  const plain = typeof user?.get === 'function' ? user.get({ plain: true }) : { ...user }

  if (plain.passwordHash !== undefined) {
    delete plain.passwordHash
  }

  if (plain.password_hash !== undefined) {
    delete plain.password_hash
  }

  return plain
}

export default sanitizeUser
