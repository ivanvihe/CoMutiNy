import jwt from 'jsonwebtoken'

const {
  JWT_SECRET = 'change-me',
  JWT_EXPIRES_IN = '7d',
  AUTH_COOKIE_NAME = 'auth_token'
} = process.env

const isProduction = process.env.NODE_ENV === 'production'

const durationToMs = (value) => {
  if (typeof value === 'number') {
    return value * 1000
  }

  if (!value || typeof value !== 'string') {
    return 0
  }

  const match = value.trim().match(/^(\d+)([smhd])?$/i)

  if (!match) {
    return 0
  }

  const amount = Number(match[1])
  const unit = (match[2] || 's').toLowerCase()

  const unitMap = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  }

  return amount * (unitMap[unit] ?? unitMap.s)
}

const cookieMaxAge = durationToMs(JWT_EXPIRES_IN) || 7 * 24 * 60 * 60 * 1000

export const authCookieName = AUTH_COOKIE_NAME

export const signSessionToken = (userId) => {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export const setAuthCookie = (res, token) => {
  res.cookie(authCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: cookieMaxAge,
    path: '/'
  })
}

export const clearAuthCookie = (res) => {
  res.clearCookie(authCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/'
  })
}
