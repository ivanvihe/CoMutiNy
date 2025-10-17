import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'

import { authCookieName } from '../services/authService.js'
import userRepository from '../repositories/UserRepository.js'
import sanitizeUser from '../utils/sanitizeUser.js'

const { JWT_SECRET = 'change-me' } = process.env

export const cookies = cookieParser()

export const authenticate = async (req, res, next) => {
  try {
    const tokenFromHeader = req.get('authorization')?.split(' ')[1]
    const token = req.cookies?.[authCookieName] ?? tokenFromHeader

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    let payload

    try {
      payload = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired authentication token' })
    }

    const userId = payload?.sub

    if (!userId) {
      return res.status(401).json({ message: 'Invalid session payload' })
    }

    const user = await userRepository.findByIdBasic(userId)

    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' })
    }

    req.authenticatedUser = user
    req.user = sanitizeUser(user)
    next()
  } catch (error) {
    next(error)
  }
}
