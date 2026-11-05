const router = require('express').Router();
const ShippingConfig = require('../models/ShippingConfig');
const { protect, adminOnly } = require('../middleware/auth');
const {
  getOrCreateShippingConfig,
  calculateShipping,
} = require('../utils/shippingCalculator');

// GET /api/shipping/config — public (Khách hàng và Admin đều lấy được thông tin kho)
router.get('/config', async (req, res, next) => {
  try {
    const config = await getOrCreateShippingConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// PUT /api/shipping/config — admin only (Admin cập nhật vị trí kho & chính sách giá)
router.put('/config', protect, adminOnly, async (req, res, next) => {
  try {
    const { warehouse, distanceTiers, maxDeliveryRadiusKm, orderDiscounts, foodPreservationPolicy } = req.body;

    const config = await getOrCreateShippingConfig();

    if (warehouse) {
      if (warehouse.name) config.warehouse.name = String(warehouse.name).trim();
      if (warehouse.address) config.warehouse.address = String(warehouse.address).trim();
      if (typeof warehouse.lat === 'number') config.warehouse.lat = warehouse.lat;
      if (typeof warehouse.lng === 'number') config.warehouse.lng = warehouse.lng;
    }

    if (Array.isArray(distanceTiers)) {
      config.distanceTiers = distanceTiers;
    }

    if (typeof maxDeliveryRadiusKm === 'number' && maxDeliveryRadiusKm > 0) {
      config.maxDeliveryRadiusKm = maxDeliveryRadiusKm;
    }

    if (Array.isArray(orderDiscounts)) {
      config.orderDiscounts = orderDiscounts;
    }

    if (typeof foodPreservationPolicy === 'string') {
      config.foodPreservationPolicy = foodPreservationPolicy;
    }

    await config.save();
    res.json({ success: true, message: 'Cập nhật cấu hình vận chuyển thành công.', data: config });
  } catch (err) {
    next(err);
  }
});

// POST /api/shipping/calculate — public (Tính toán phí ship theo tọa độ thực tế & OSRM)
router.post('/calculate', async (req, res, next) => {
  try {
    const { lat, lng, subtotal = 0 } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Tọa độ giao hàng không hợp lệ (cần lat và lng kiểu số).',
      });
    }

    // Validate tọa độ trong phạm vi Việt Nam (Vĩ độ ~8.5° đến 23.5°, Kinh độ ~102° đến 110°)
    if (lat < 8 || lat > 24 || lng < 102 || lng > 111) {
      return res.status(400).json({
        success: false,
        message: 'Tọa độ nằm ngoài lãnh thổ Việt Nam. Vui lòng chọn vị trí giao hàng hợp lệ.',
      });
    }

    const result = await calculateShipping(lat, lng, Number(subtotal) || 0);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
