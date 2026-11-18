const router = require('express').Router();
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Order = require('../models/Order');
const { protect, staffOnly, hasRole, optionalAuth, authorizeRoles } = require('../middleware/auth');

const FALLBACK_AVATARS = {
  'Nguyễn Thị Mai': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
  'Phạm Quốc Tuấn': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
};

function enrichConversation(convDoc) {
  if (!convDoc) return null;
  const conv = convDoc.toObject ? convDoc.toObject() : { ...convDoc };

  // 1. If customer was populated from User model
  if (conv.customer && typeof conv.customer === 'object') {
    conv.customerName = conv.customer.name || conv.customerName || 'Khách hàng';
    conv.customerEmail = conv.customer.email || conv.customerEmail || '';
    conv.customerPhone = conv.customer.phone || conv.customerPhone || '';
    const userAvatar = conv.customer.avatar || '';
    if (userAvatar && !userAvatar.startsWith('data:image/') && userAvatar.length <= 1000) {
      conv.customerAvatar = userAvatar;
    }
  }

  // 2. Fallback avatar (loại bỏ base64 nặng nếu có)
  if (!conv.customerAvatar || conv.customerAvatar.startsWith('data:image/') || conv.customerAvatar.length > 1000) {
    if (conv.customerName && FALLBACK_AVATARS[conv.customerName]) {
      conv.customerAvatar = FALLBACK_AVATARS[conv.customerName];
    } else if (conv.customerName && conv.customerName !== 'Khách hàng') {
      conv.customerAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.customerName)}&background=10321c&color=85dd52&bold=true`;
    } else {
      conv.customerAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';
    }
  }

  // 3. Enrich message sender avatars and sender names
  if (Array.isArray(conv.messages)) {
    conv.messages = conv.messages.map((m) => {
      const msg = { ...m };
      if (msg.sender === 'customer') {
        msg.senderName = conv.customerName || 'Khách hàng';
        msg.senderAvatar = conv.customerAvatar || '';
      } else if (msg.sender === 'ai') {
        msg.senderName = 'NutriBot AI';
        msg.senderAvatar = 'https://api.iconify.design/lucide:bot.svg?color=%23176b3a';
      } else if (msg.sender === 'admin') {
        const staff = msg.staffName || (m.senderName && m.senderName !== 'Admin' ? m.senderName : '');
        msg.senderName = 'Admin';
        msg.staffName = staff;
      }
      return msg;
    });
  }

  return conv;
}

// GET /api/support/conversations - list for admin / support / sales / manager
router.get('/conversations', protect, authorizeRoles('admin', 'support', 'cskh', 'sales', 'manager'), async (req, res, next) => {
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

    const [conversations, statsAgg] = await Promise.all([
      Conversation.find(filter)
        .select('_id sessionId customerName customerEmail customerPhone customerAvatar status lastMessage lastMessageAt unreadAdminCount customer')
        .sort({ lastMessageAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .maxTimeMS(4500)
        .lean(),
      Conversation.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]).option({ maxTimeMS: 4500 }),
    ]);

    const statsMap = {};
    let totalAll = 0;
    (statsAgg || []).forEach((item) => {
      statsMap[item._id] = item.count;
      totalAll += item.count;
    });

    const stats = {
      total: totalAll,
      waitingForAdmin: statsMap['WAITING_FOR_ADMIN'] || 0,
      adminProcessing: statsMap['ADMIN_PROCESSING'] || 0,
      aiProcessing: statsMap['AI_PROCESSING'] || 0,
      resolved: statsMap['RESOLVED'] || 0,
    };

    const enriched = (conversations || []).map((c) => enrichConversation(c)).filter(Boolean);

    // Tự động gom (deduplicate) các hội thoại của cùng 1 khách hàng để chỉ hiển thị 1 khung chat duy nhất
    const uniqueMap = new Map();
    for (const c of enriched) {
      const userKey = c.customer?._id
        ? String(c.customer._id)
        : (c.customerEmail ? c.customerEmail.toLowerCase().trim() : c.sessionId);

      if (!uniqueMap.has(userKey)) {
        uniqueMap.set(userKey, c);
      } else {
        const existing = uniqueMap.get(userKey);
        // Ưu tiên hội thoại đang được nhân viên hỗ trợ hoặc có tương tác mới nhất
        if (
          (c.status === 'ADMIN_PROCESSING' && existing.status !== 'ADMIN_PROCESSING') ||
          (c.status === 'WAITING_FOR_ADMIN' && existing.status === 'AI_PROCESSING') ||
          new Date(c.lastMessageAt).getTime() > new Date(existing.lastMessageAt).getTime()
        ) {
          uniqueMap.set(userKey, c);
        }
      }
    }
    const finalConversations = Array.from(uniqueMap.values());

    res.json({
      success: true,
      data: finalConversations,
      stats: {
        ...stats,
        total: finalConversations.length,
      },
      total: finalConversations.length,
    });
  } catch (err) {
    console.error('Lỗi tải danh sách hội thoại support:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách hội thoại.', error: err.message });
  }
});

// GET /api/support/conversations/:id - detail
router.get('/conversations/:id', protect, authorizeRoles('admin', 'support', 'cskh', 'sales', 'manager'), async (req, res, next) => {
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

    const enriched = enrichConversation(conv);

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('Lỗi tải danh sách hội thoại support:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách hội thoại.', error: err.message });
  }
});

// POST /api/support/conversations/:id/assign - take over conversation
router.post('/conversations/:id/assign', protect, hasRole('admin', 'support', 'cskh', 'sales', 'manager'), async (req, res, next) => {
  try {
    const conv = await Conversation.findById(req.params.id)
      .populate('customer', 'name email phone avatar')
      .populate('assignedTo', 'name email')
      .populate('relatedOrder', 'orderCode total status');
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Hội thoại không tồn tại' });
    }

    conv.assignedTo = req.user._id;
    conv.status = 'ADMIN_PROCESSING';
    await conv.save();

    const enriched = enrichConversation(conv);
    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('Lỗi tải danh sách hội thoại support:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách hội thoại.', error: err.message });
  }
});

// POST /api/support/conversations/:id/reply - staff reply
router.post('/conversations/:id/reply', protect, hasRole('admin', 'support', 'cskh', 'sales', 'manager'), async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung phản hồi không được trống' });
    }

    const conv = await Conversation.findById(req.params.id)
      .populate('customer', 'name email phone avatar')
      .populate('assignedTo', 'name email')
      .populate('relatedOrder', 'orderCode total status');
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Hội thoại không tồn tại' });
    }

    const staffName = req.user.name || 'Admin';
    const msg = {
      sender: 'admin',
      senderName: 'Admin', // Phía khách hàng chỉ thấy duy nhất tên là Admin
      staffName: staffName, // Phân biệt người gửi thực tế
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

    const enriched = enrichConversation(conv);
    res.json({ success: true, data: enriched, message: msg });
  } catch (err) {
    console.error('Lỗi tải danh sách hội thoại support:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách hội thoại.', error: err.message });
  }
});

// PUT /api/support/conversations/:id/status - update status
router.put('/conversations/:id/status', protect, hasRole('admin', 'support', 'cskh', 'sales', 'manager'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['AI_PROCESSING', 'WAITING_FOR_ADMIN', 'ADMIN_PROCESSING', 'RESOLVED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    const conv = await Conversation.findById(req.params.id)
      .populate('customer', 'name email phone avatar')
      .populate('assignedTo', 'name email')
      .populate('relatedOrder', 'orderCode total status');
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Hội thoại không tồn tại' });
    }

    conv.status = status;
    await conv.save();

    const enriched = enrichConversation(conv);
    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('Lỗi tải danh sách hội thoại support:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách hội thoại.', error: err.message });
  }
});

// POST /api/support/request-human - customer requests human support
router.post('/request-human', optionalAuth, async (req, res, next) => {
  try {
    const { sessionId, customerInfo } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Thiếu sessionId' });
    }

    const authUser = req.user;
    const cid = authUser ? authUser._id : (customerInfo?.id || customerInfo?._id || null);
    const cname = authUser ? authUser.name : (customerInfo?.name || '');
    const cemail = authUser ? authUser.email : (customerInfo?.email || '');
    const cphone = authUser ? (authUser.phone || '') : (customerInfo?.phone || '');
    const rawAvatar = authUser ? (authUser.avatar || '') : (customerInfo?.avatar || '');
    const cavatar = (rawAvatar && !rawAvatar.startsWith('data:image/') && rawAvatar.length <= 1000) ? rawAvatar : '';

    let conv = await Conversation.findOne({ sessionId });
    if (!conv) {
      conv = new Conversation({
        sessionId,
        customer: cid,
        customerName: cname || 'Khách hàng',
        customerEmail: cemail,
        customerPhone: cphone,
        customerAvatar: cavatar,
        messages: [],
      });
    } else {
      if (!conv.customer && cid) conv.customer = cid;
      if ((!conv.customerName || conv.customerName === 'Khách hàng') && cname) conv.customerName = cname;
      if (!conv.customerEmail && cemail) conv.customerEmail = cemail;
      if (!conv.customerPhone && cphone) conv.customerPhone = cphone;
      if (!conv.customerAvatar && cavatar) conv.customerAvatar = cavatar;
    }

    conv.status = 'WAITING_FOR_ADMIN';
    conv.unreadAdminCount = (conv.unreadAdminCount || 0) + 1;

    // Add a system announcement message
    conv.messages.push({
      sender: 'ai',
      senderName: 'NutriBot',
      content: 'NutriBot đã chuyển yêu cầu của bạn đến chuyên viên tư vấn Evergreen Mart. Nhân viên sẽ phản hồi trực tiếp cho bạn tại đây trong giây lát! ',
      timestamp: new Date(),
    });
    conv.lastMessage = 'Yêu cầu gặp nhân viên tư vấn';
    conv.lastMessageAt = new Date();

    await conv.save();

    const enriched = enrichConversation(conv);
    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('Lỗi tải danh sách hội thoại support:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách hội thoại.', error: err.message });
  }
});

module.exports = router;

