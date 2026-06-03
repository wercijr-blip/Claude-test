const limits = new Map()
const MAX_MESSAGES = 5
const WINDOW_MS = 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [phone, entry] of limits.entries()) {
    if (now - entry.windowStart > WINDOW_MS) {
      limits.delete(phone)
    }
  }
}, 2 * 60 * 1000)

export function checkLimit(phone) {
  const now = Date.now()
  const entry = limits.get(phone)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    limits.set(phone, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= MAX_MESSAGES) return false

  entry.count++
  return true
}
