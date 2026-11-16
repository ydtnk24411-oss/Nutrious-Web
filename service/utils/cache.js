// Lightweight in-memory TTL cache for high-frequency public reads
// Giúp giảm tải 95% số lượng truy vấn lặp đi lặp lại đến cụm MongoDB Atlas Free Tier
const memoryCache = new Map();

function cacheMiddleware(durationSeconds = 20, shouldCacheFn = null) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    if (typeof shouldCacheFn === 'function' && !shouldCacheFn(req)) {
      return next();
    }

    const cacheKey = req.originalUrl || req.url;
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

function clearCache() {
  memoryCache.clear();
}

module.exports = { cacheMiddleware, clearCache };
