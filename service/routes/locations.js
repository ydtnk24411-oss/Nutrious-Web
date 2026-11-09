const router = require('express').Router();

/**
 * Proxy + cache dữ liệu đơn vị hành chính Việt Nam (mô hình 2 cấp sau sáp nhập 2025:
 * 34 Tỉnh/Thành phố → Phường/Xã/Đặc khu) từ Provinces Open API.
 * Dùng proxy phía server để tránh lỗi CORS trên trình duyệt và giảm số lần gọi API ngoài.
 */
const PROVINCES_API = 'https://provinces.open-api.vn/api/v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ
const cache = new Map(); // key -> { expires, data }

async function fetchJsonCached(key, url) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`Provinces API responded ${resp.status}`);
    const data = await resp.json();
    cache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
    return data;
  } catch (err) {
    // Nếu API ngoài lỗi nhưng còn bản cache cũ thì vẫn trả bản cũ
    if (hit) return hit.data;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/locations/provinces — Danh sách 34 Tỉnh/Thành phố
router.get('/provinces', async (req, res, next) => {
  try {
    const raw = await fetchJsonCached('provinces', `${PROVINCES_API}/p/`);
    const data = (Array.isArray(raw) ? raw : []).map((p) => ({
      code: p.code,
      name: p.name,
      divisionType: p.division_type,
      codename: p.codename,
    }));
    res.json({ success: true, data });
  } catch (err) {
    err.status = 502;
    err.message = 'Không tải được danh sách Tỉnh/Thành phố. Vui lòng thử lại sau.';
    next(err);
  }
});

// GET /api/locations/provinces/:code/wards — Danh sách Phường/Xã của một Tỉnh/Thành
router.get('/provinces/:code/wards', async (req, res, next) => {
  try {
    const code = Number(req.params.code);
    if (!Number.isInteger(code) || code <= 0) {
      return res.status(400).json({ success: false, message: 'Mã Tỉnh/Thành phố không hợp lệ.' });
    }
    const raw = await fetchJsonCached(`wards:${code}`, `${PROVINCES_API}/p/${code}?depth=2`);
    const data = (Array.isArray(raw?.wards) ? raw.wards : []).map((w) => ({
      code: w.code,
      name: w.name,
      divisionType: w.division_type,
      codename: w.codename,
      provinceCode: w.province_code ?? code,
    }));
    res.json({ success: true, data });
  } catch (err) {
    err.status = 502;
    err.message = 'Không tải được danh sách Phường/Xã. Vui lòng thử lại sau.';
    next(err);
  }
});

module.exports = router;

