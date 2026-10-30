const router = require('express').Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

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
    const { name, phone, avatar } = req.body;
    console.log('Update profile request:', {
      userId: req.user.id,
      name,
      phone,
      hasAvatar: !!avatar,
      avatarLength: avatar?.length
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, avatar },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    console.log('User updated:', {
      _id: user._id,
      name: user.name,
      hasAvatar: !!user.avatar,
      avatarLength: user.avatar?.length
    });

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

// POST /api/account/addresses - Add new address
router.post('/addresses', protect, async (req, res, next) => {
  try {
    const { label, fullName, phone, address, city, isDefault } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    // Nếu set làm default, bỏ default của các địa chỉ khác
    if (isDefault) {
      user.addresses = user.addresses.map(addr => ({ ...addr.toObject(), isDefault: false }));
    }
    user.addresses.push({ label, fullName, phone, address, city, isDefault });
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
    user.addresses[addressIndex] = { ...user.addresses[addressIndex].toObject(), label, fullName, phone, address, city, isDefault };
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

module.exports = router;
