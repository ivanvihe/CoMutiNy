const DEFAULT_SEPARATOR = '-'

const sanitizeSegment = (segment) =>
  segment
    .normalize('NFD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase()

export const slugify = (value, { separator = DEFAULT_SEPARATOR, fallback = 'sprite' } = {}) => {
  if (typeof value !== 'string') {
    return fallback
  }

  const segments = value
    .split(/\s+/)
    .map((segment) => sanitizeSegment(segment))
    .filter(Boolean)

  if (!segments.length) {
    return fallback
  }

  return segments.join(separator)
}

export default slugify
