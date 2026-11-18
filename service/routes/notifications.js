const router = require('express').Router();
const crypto = require('crypto');
const Notification = require('../models/Notification');
const { protect, optionalAuth } = require('../middleware/auth');
const { addClient, removeClient } = require('../utils/sse');

// GET /api/notifications/stream - SSE Stream thời gian thực
router.get('/stream', optionalAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Tắt buffering trên Nginx nếu có

  const clientId = crypto.randomBytes(16).toString('hex');
  const userId = req.user ? req.user._id : (req.query.userId || null);
  const role = req.user ? req.user.role : (req.query.role || 'customer');

  addClient(clientId, res, userId, role);

  // Gửi heartbeat định kỳ để giữ kết nối không bị timeout
  res.write(': connected\n\n');
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(clientId);
  });
});

// GET /api/notifications - Lấy danh sách thông báo của tài khoản hoặc vai trò
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.user) {
      if (req.user.role === 'customer') {
        // Khách hàng CHỈ nhận thông báo gửi đích danh cho mình hoặc thông báo chung cho khách hàng
        filter.$and = [
          {
            $or: [
              { recipient: req.user._id },
              { recipientRole: 'customer' },
            ],
          },
          { type: { $ne: 'inventory' } }, // Tuyệt đối không nhận thông báo kho vận nội bộ
        ];
      } else {
        // Nhân viên / Quản trị viên
        filter.$or = [
          { recipient: req.user._id },
          { recipientRole: req.user.role },
          { recipientRole: 'all' },
        ];
        if (['admin', 'sales'].includes(req.user.role)) {
          filter.$or.push({ recipientRole: 'sales' });
        }
        if (['admin', 'warehouse'].includes(req.user.role)) {
          filter.$or.push({ recipientRole: 'warehouse' });
        }
        if (['admin', 'manager'].includes(req.user.role)) {
          filter.$or.push({ recipientRole: 'manager' });
        }
      }
    } else {
      filter.recipientRole = 'customer';
      filter.type = { $ne: 'inventory' };
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = notifications.filter(n => n.unread).length;

    res.json({
      success: true,
      unreadCount,
      data: notifications,
    });
  } catch (err) { next(err); }
});

// PUT /api/notifications/read-all - Đánh dấu tất cả đã đọc
router.put('/read-all', optionalAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.user) {
      filter.$or = [
        { recipient: req.user._id },
        { recipientRole: req.user.role },
        { recipientRole: 'all' },
      ];
    }
    await Notification.updateMany(filter, { $set: { unread: false } });
    res.json({ success: true, message: 'Đã đánh dấu tất cả là đã đọc' });
  } catch (err) { next(err); }
});

// PUT /api/notifications/:id/read - Đánh dấu 1 thông báo đã đọc
router.put('/:id/read', optionalAuth, async (req, res, next) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { $set: { unread: false } });
    res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
  } catch (err) { next(err); }
});

module.exports = router;
