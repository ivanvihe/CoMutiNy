import bcrypt from 'bcryptjs'

import userRepository from '../repositories/UserRepository.js'
import { setAuthCookie, signSessionToken } from '../services/authService.js'
import sanitizeUser from '../utils/sanitizeUser.js'

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10)

export const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body ?? {}

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email and password are required' })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const trimmedUsername = username.trim()

    const [existingEmail, existingUsername] = await Promise.all([
      userRepository.findByEmail(normalizedEmail),
      userRepository.findByUsername(trimmedUsername)
    ])

    if (existingEmail) {
      return res.status(409).json({ message: 'Email is already registered' })
    }

    if (existingUsername) {
      return res.status(409).json({ message: 'Username is already taken' })
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    const user = await userRepository.create({
      username: trimmedUsername,
      email: normalizedEmail,
      passwordHash
    })

    const token = signSessionToken(user.id)
    setAuthCookie(res, token)

    res.status(201).json({ user: sanitizeUser(user) })
  } catch (error) {
    next(error)
  }
}

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {}

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const user = await userRepository.findByEmail(normalizedEmail)

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash)

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'Your account has been banned by the moderation team' })
    }

    const now = new Date()

    if (user.suspensionUntil && user.suspensionUntil > now) {
      return res.status(403).json({
        message: `Your account is suspended until ${user.suspensionUntil.toISOString()}`
      })
    }

    if (user.suspensionUntil && user.suspensionUntil <= now) {
      await userRepository.update(user.id, { suspensionUntil: null })
      user.suspensionUntil = null
    }

    const token = signSessionToken(user.id)
    setAuthCookie(res, token)

    res.json({ user: sanitizeUser(user) })
  } catch (error) {
    next(error)
  }
}

export const currentUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    res.json({ user: req.user })
  } catch (error) {
    next(error)
  }
}
