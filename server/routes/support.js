const router = require('express').Router();
const Conversation = require('../models/Conversation');
const { protect, staffOnly, hasRole, optionalAuth } = require('../middleware/auth');

// GET /api/support/conversations — list for admin
router.get('/conversations', protect, staffOnly, async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
      ];
    }

    const [
      conversations,
      total,
      totalWaiting,
      totalAdminProcessing,
      totalAiProcessing,
      totalResolved,
    ] = await Promise.all([
      Conversation.find(filter)
        .sort({ lastMessageAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('customer', 'name email phone avatar')
        .populate('assignedTo', 'name email')
        .populate('relatedOrder', 'orderCode total status'),
      Conversation.countDocuments(filter),
      Conversation.countDocuments({ status: 'WAITING_FOR_ADMIN' }),
      Conversation.countDocuments({ status: 'ADMIN_PROCESSING' }),
      Conversation.countDocuments({ status: 'AI_PROCESSING' }),
      Conversation.countDocuments({ status: 'RESOLVED' }),
    ]);

    const stats = {
      total,
      waitingForAdmin: totalWaiting,
      adminProcessing: totalAdminProcessing,
      aiProcessing: totalAiProcessing,
      resolved: totalResolved,
    };

    res.json({
      success: true,
      data: conversations,
      stats,
      total,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/support/conversations/:id — detail
router.get('/conversations/:id', protect, staffOnly, async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.id)
      .populate('customer', 'name email phone avatar')
      .populate('assignedTo', 'name email')
      .populate('relatedOrder', 'orderCode total status');

    if (!conv) {
      return res.status(404).json({ success: false, message: 'Hội thoại không tồn tại' });
    }

    // Mark admin unread messages as read
    conv.unreadAdminCount = 0;
    await conv.save();

    res.json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
});

// POST /api/support/conversations/:id/assign — take over conversation
router.post('/conversations/:id/assign', protect, hasRole('support', 'admin'), async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Hội thoại không tồn tại' });
    }

    conv.assignedTo = req.user._id;
    conv.status = 'ADMIN_PROCESSING';
    await conv.save();

    res.json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
});

// POST /api/support/conversations/:id/reply — admin reply
router.post('/conversations/:id/reply', protect, hasRole('support', 'admin'), async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung phản hồi không được trống' });
    }

    const conv = await Conversation.findById(req.params.id);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Hội thoại không tồn tại' });
    }

    const msg = {
      sender: 'admin',
      senderName: req.user.name || 'Nhân viên hỗ trợ',
      senderAvatar: req.user.avatar || '',
      content: content.trim(),
      timestamp: new Date(),
      isRead: false,
    };

    conv.messages.push(msg);
    conv.lastMessage = content.trim();
    conv.lastMessageAt = new Date();
    conv.status = 'ADMIN_PROCESSING';
    conv.assignedTo = req.user._id;
    conv.unreadCustomerCount = (conv.unreadCustomerCount || 0) + 1;
    conv.unreadAdminCount = 0;

    await conv.save();

    res.json({ success: true, data: conv, message: msg });
  } catch (err) {
    next(err);
  }
});

// PUT /api/support/conversations/:id/status — update status
router.put('/conversations/:id/status', protect, hasRole('support', 'admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['AI_PROCESSING', 'WAITING_FOR_ADMIN', 'ADMIN_PROCESSING', 'RESOLVED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    const conv = await Conversation.findById(req.params.id);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Hội thoại không tồn tại' });
    }

    conv.status = status;
    await conv.save();

    res.json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
});

// POST /api/support/request-human — customer requests human support
router.post('/request-human', optionalAuth, async (req, res, next) => {
  try {
    const { sessionId, customerInfo } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Thiếu sessionId' });
    }

    let conv = await Conversation.findOne({ sessionId });
    if (!conv) {
      conv = new Conversation({
        sessionId,
        customer: req.user?._id || null,
        customerName: req.user?.name || customerInfo?.name || 'Khách hàng',
        customerEmail: req.user?.email || customerInfo?.email || '',
        customerPhone: req.user?.phone || customerInfo?.phone || '',
        messages: [],
      });
    }

    conv.status = 'WAITING_FOR_ADMIN';
    conv.unreadAdminCount = (conv.unreadAdminCount || 0) + 1;

    // Add a system announcement message
    conv.messages.push({
      sender: 'ai',
      senderName: 'NutriBot',
      content: 'NutriBot đã chuyển yêu cầu của bạn đến chuyên viên tư vấn Xanh Lá. Nhân viên sẽ phản hồi trực tiếp cho bạn tại đây trong giây lát! 🌿',
      timestamp: new Date(),
    });
    conv.lastMessage = 'Yêu cầu gặp nhân viên tư vấn';
    conv.lastMessageAt = new Date();

    await conv.save();

    res.json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

