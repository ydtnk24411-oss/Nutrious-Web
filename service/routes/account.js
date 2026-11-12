const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const MAX_VIEWED_PRODUCTS = 24;

// GET /api/account/me - Get current user profile
router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// PUT /api/account/me - Update profile
router.put('/me', protect, async (req, res, next) => {
  try {
    // Không cho phép đổi số điện thoại trực tiếp mà không qua xác minh OTP
    if (req.body.phone !== undefined) {
      const currentUser = await User.findById(req.user.id);
      if (currentUser && currentUser.phone && req.body.phone !== currentUser.phone) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng sử dụng tính năng Đổi số điện thoại trong Cài đặt tài khoản để xác minh OTP.',
        });
      }
    }

    // Only update fields that were actually sent in the request body
    const allowedFields = ['name', 'avatar', 'firstName', 'lastName', 'title', 'phone', 'addresses'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Update profile error:', err);
    next(err);
  }
});

// PUT /api/account/me/password - Change password
router.put('/me/password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
  } catch (err) { next(err); }
});

// GET /api/account/addresses - Get user addresses
router.get('/addresses', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('addresses');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    res.json({ success: true, data: user.addresses || [] });
  } catch (err) { next(err); }
});

// Chuẩn hóa các trường địa chỉ có cấu trúc + tọa độ ghim từ request body
function pickStructuredAddress(body) {
  const toNum = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
  const lat = toNum(body.lat);
  const lng = toNum(body.lng);
  const validCoords = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return {
    province: String(body.province || '').trim(),
    provinceCode: toNum(body.provinceCode),
    ward: String(body.ward || '').trim(),
    wardCode: toNum(body.wardCode),
    street: String(body.street || '').trim(),
    lat: validCoords ? lat : null,
    lng: validCoords ? lng : null,
  };
}

// POST /api/account/addresses - Add new address
router.post('/addresses', protect, async (req, res, next) => {
  try {
    const { label, fullName, phone, address, city, isDefault } = req.body;
    if (!fullName || !phone || !address || !city) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ người nhận, số điện thoại và địa chỉ.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    // Địa chỉ đầu tiên luôn là mặc định
    const makeDefault = Boolean(isDefault) || user.addresses.length === 0;
    // Nếu set làm default, bỏ default của các địa chỉ khác
    if (makeDefault) {
      user.addresses = user.addresses.map(addr => ({ ...addr.toObject(), isDefault: false }));
    }
    user.addresses.push({ label, fullName, phone, address, city, isDefault: makeDefault, ...pickStructuredAddress(req.body) });
    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (err) { next(err); }
});

// PUT /api/account/addresses/:id - Update address
router.put('/addresses/:id', protect, async (req, res, next) => {
  try {
    const { label, fullName, phone, address, city, isDefault } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === req.params.id);
    if (addressIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ.' });
    }
    if (isDefault) {
      user.addresses = user.addresses.map(addr => ({ ...addr.toObject(), isDefault: false }));
    }
    const prev = user.addresses[addressIndex].toObject();
    const structured = pickStructuredAddress({ ...prev, ...req.body });
    user.addresses[addressIndex] = {
      ...prev,
      label: label ?? prev.label,
      fullName: fullName ?? prev.fullName,
      phone: phone ?? prev.phone,
      address: address ?? prev.address,
      city: city ?? prev.city,
      isDefault: isDefault ?? prev.isDefault,
      ...structured,
    };
    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (err) { next(err); }
});

// DELETE /api/account/addresses/:id - Delete address
router.delete('/addresses/:id', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    user.addresses = user.addresses.filter(addr => addr._id.toString() !== req.params.id);
    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (err) { next(err); }
});

// PUT /api/account/addresses/:id/default - Set default address
router.put('/addresses/:id/default', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === req.params.id);
    if (addressIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ.' });
    }
    user.addresses = user.addresses.map(addr => ({ ...addr.toObject(), isDefault: addr._id.toString() === req.params.id }));
    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (err) { next(err); }
});

// GET /api/account/viewed-products - Lấy lịch sử sản phẩm đã xem của tài khoản hiện tại
router.get('/viewed-products', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+viewedProducts').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const rawList = Array.isArray(user.viewedProducts) ? user.viewedProducts : [];
    if (rawList.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Kiểm tra sản phẩm còn hoạt động để đảm bảo liên kết chi tiết không bị lỗi
    const productIds = rawList
      .map((v) => v.product)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));
    const activeDocs = await Product.find({
      _id: { $in: productIds },
      isActive: { $ne: false },
      isCombo: { $ne: true },
    })
      .select('_id slug')
      .lean();
    const activeSlugMap = new Map(activeDocs.map((p) => [String(p._id), p.slug]));

    const sorted = rawList
      .filter((v) => activeSlugMap.has(String(v.product)))
      .map((v) => ({
        productId: String(v.product),
        slug: activeSlugMap.get(String(v.product)) || v.slug,
        name: v.name,
        image: v.image || '',
        price: v.price,
        priceNumber: v.priceNumber,
        weight: v.weight || '',
        unit: v.unit || '',
        categoryVi: v.categoryVi || '',
        viewedAt: v.viewedAt,
      }))
      .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime());

    res.json({ success: true, data: sorted });
  } catch (err) { next(err); }
});

// POST /api/account/viewed-products - Ghi nhận sản phẩm vừa xem (không trùng lặp, cập nhật viewedAt mới nhất)
router.post('/viewed-products', protect, async (req, res, next) => {
  try {
    const { productId, slug, name, image, price, priceNumber } = req.body || {};
    let prod = null;
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      prod = await Product.findOne({ _id: productId, isActive: { $ne: false } }).lean();
    }
    if (!prod && slug) {
      const cleanSlug = String(slug).replace(/^\/product-page\//, '').trim();
      prod = await Product.findOne({ slug: cleanSlug, isActive: { $ne: false } }).lean();
    }
    if (!prod) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }
    if (prod.isCombo) {
      return res.json({ success: true, data: [] });
    }

    const user = await User.findById(req.user.id).select('+viewedProducts');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const recordedPriceNumber =
      typeof priceNumber === 'number' && priceNumber >= 0 ? priceNumber : (prod.priceNumber || 0);
    const recordedPrice =
      price && String(price).trim()
        ? String(price).trim()
        : (prod.price || `${recordedPriceNumber.toLocaleString('vi-VN')}đ`);

    const now = new Date();
    const entry = {
      product: prod._id,
      slug: prod.slug,
      name: (name && String(name).trim()) || prod.name,
      image: (image !== undefined ? String(image) : prod.image) || '',
      price: recordedPrice,
      priceNumber: recordedPriceNumber,
      weight: prod.weight || '',
      unit: prod.unit || '',
      categoryVi: prod.categoryVi || '',
      viewedAt: now,
    };

    const existing = Array.isArray(user.viewedProducts) ? user.viewedProducts : [];
    const deduped = existing.filter(
      (item) =>
        String(item.product) !== String(prod._id) &&
        String(item.slug || '') !== String(prod.slug || '')
    );

    const updated = [entry, ...deduped]
      .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
      .slice(0, MAX_VIEWED_PRODUCTS);

    user.viewedProducts = updated;
    await user.save();

    const responseData = user.viewedProducts.map((v) => ({
      productId: String(v.product),
      slug: v.slug,
      name: v.name,
      image: v.image || '',
      price: v.price,
      priceNumber: v.priceNumber,
      weight: v.weight || '',
      unit: v.unit || '',
      categoryVi: v.categoryVi || '',
      viewedAt: v.viewedAt,
    }));

    res.json({ success: true, data: responseData });
  } catch (err) { next(err); }
});

// DELETE /api/account/viewed-products - Xóa lịch sử xem của tài khoản hiện tại (toàn bộ hoặc 1 sản phẩm)
router.delete('/viewed-products', protect, async (req, res, next) => {
  try {
    const { productId } = req.query;
    const user = await User.findById(req.user.id).select('+viewedProducts');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    if (productId) {
      user.viewedProducts = (user.viewedProducts || []).filter(
        (v) => String(v.product) !== String(productId)
      );
    } else {
      user.viewedProducts = [];
    }
    await user.save();
    res.json({ success: true, data: user.viewedProducts });
  } catch (err) { next(err); }
});

module.exports = router;
