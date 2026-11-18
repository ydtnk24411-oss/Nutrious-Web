const router = require('express').Router();
const Store = require('../models/Store');
const { protect, adminOnly, verifyStoreAccess } = require('../middleware/auth');

/**
 * GET /api/stores
 * Query params:
 *   - province: string (Lọc theo Tỉnh / Thành phố e.g. "Hồ Chí Minh")
 *   - activeOnly: boolean (Chỉ lấy các cửa hàng đang mở nhận đơn online)
 *   - lat & lng: number (Tìm cửa hàng gần nhất theo tọa độ)
 *   - maxDistance: number in meters (mặc định 15000 = 15km)
 */
router.get('/', async (req, res, next) => {
  try {
    const { province, activeOnly, lat, lng, maxDistance } = req.query;
    const filter = {};

    if (activeOnly === 'true' || activeOnly === true) {
      filter.isAcceptingOnlineOrders = true;
    }

    if (province) {
      filter.province = new RegExp(String(province).trim(), 'i');
    }

    // Nếu có tọa độ GPS, dùng $near của MongoDB để sắp xếp theo khoảng cách
    if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
      const latitude = Number(lat);
      const longitude = Number(lng);
      const dist = !isNaN(Number(maxDistance)) ? Number(maxDistance) : 50000; // max 50km

      filter.location = {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: dist,
        },
      };
    }

    const stores = await Store.find(filter).lean();
    res.json({
      success: true,
      count: stores.length,
      data: stores,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stores/:id
 * Lấy thông tin chi tiết một cửa hàng
 */
router.get('/:id', async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id).lean();
    if (!store) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy cửa hàng với mã '${req.params.id}'.`,
      });
    }

    res.json({ success: true, data: store });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/stores/:id
 * Cập nhật thông tin cửa hàng (Giờ mở cửa, trạng thái nhận đơn online, sức chứa)
 * Yêu cầu: Đăng nhập & có quyền trên cửa hàng này (verifyStoreAccess)
 */
router.put('/:id', protect, verifyStoreAccess('id'), async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy cửa hàng với mã '${req.params.id}'.`,
      });
    }

    const {
      name,
      address,
      phone,
      operatingHours,
      isAcceptingOnlineOrders,
      deliveryRadiusMeters,
      maxActiveOrders,
    } = req.body;

    if (name) store.name = String(name).trim();
    if (address) store.address = String(address).trim();
    if (phone) store.phone = String(phone).trim();
    if (operatingHours) {
      if (operatingHours.open) store.operatingHours.open = operatingHours.open;
      if (operatingHours.close) store.operatingHours.close = operatingHours.close;
    }
    if (typeof isAcceptingOnlineOrders === 'boolean') {
      store.isAcceptingOnlineOrders = isAcceptingOnlineOrders;
    }
    if (typeof deliveryRadiusMeters === 'number' && deliveryRadiusMeters > 0) {
      store.deliveryRadiusMeters = deliveryRadiusMeters;
    }
    if (typeof maxActiveOrders === 'number' && maxActiveOrders > 0) {
      store.maxActiveOrders = maxActiveOrders;
    }

    await store.save();
    res.json({
      success: true,
      message: 'Cập nhật thông tin chi nhánh thành công.',
      data: store,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
