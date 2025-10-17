export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Administrator privileges required' })
  }

  return next()
}

export default requireAdmin
