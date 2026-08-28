const buckets = new Map()

function prune(now) {
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key)
  }
}

function rateLimit({ windowMs, max, name = 'global' }) {
  return function limitRequest(req, res, next) {
    const now = Date.now()
    if (buckets.size > 10_000) prune(now)

    const identity = req.ip || req.socket?.remoteAddress || 'unknown'
    const key = `${name}:${identity}`
    let bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }

    bucket.count += 1
    const remaining = Math.max(0, max - bucket.count)
    res.set('RateLimit-Limit', String(max))
    res.set('RateLimit-Remaining', String(remaining))
    res.set('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))

    if (bucket.count > max) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)))
      return res.status(429).json({ error: 'TOO_MANY_REQUESTS' })
    }

    return next()
  }
}

module.exports = rateLimit
