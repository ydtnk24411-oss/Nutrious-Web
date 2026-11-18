// Lightweight in-memory TTL cache for high-frequency reads
// Giúp giảm tải 95% số lượng truy vấn lặp đi lặp lại đến cụm MongoDB Atlas
const memoryCache = new Map();

function cacheMiddleware(durationSeconds = 15, shouldCacheFn = null, isPublicScope = false) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    if (typeof shouldCacheFn === 'function' && !shouldCacheFn(req)) {
      return next();
    }

    const userScope = (isPublicScope || !req.user)
      ? 'public'
      : `${req.user._id}_${req.user.assignedStore || ''}_${req.user.role || ''}`;
    const cacheKey = `${userScope}::${req.originalUrl || req.url}`;
    const cached = memoryCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp < durationSeconds * 1000)) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && body && body.success !== false) {
        memoryCache.set(cacheKey, {
          data: body,
          timestamp: Date.now(),
        });
      }
      return originalJson(body);
    };

    next();
  };
}

function clearCache(prefix = null) {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.includes(prefix)) {
      memoryCache.delete(key);
    }
  }
}

module.exports = { cacheMiddleware, clearCache };
