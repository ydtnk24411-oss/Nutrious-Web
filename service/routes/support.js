const router = require('express').Router();
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { protect, staffOnly, hasRole, optionalAuth } = require('../middleware/auth');

const FALLBACK_AVATARS = {
  'Nguyễn Thị Mai': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
  'Phạm Quốc Tuấn': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
};

async function enrichConversation(convDoc) {
  if (!convDoc) return null;
  const conv = convDoc.toObject ? convDoc.toObject() : { ...convDoc };

  // 1. If customer was populated from User model
  if (conv.customer && typeof conv.customer === 'object') {
    conv.customerName = conv.customer.name || conv.customerName;
    conv.customerEmail = conv.customer.email || conv.customerEmail;
    conv.customerPhone = conv.customer.phone || conv.customerPhone;
    conv.customerAvatar = conv.customer.avatar || conv.customerAvatar || '';
  } else if (conv.customer) {
    try {
      const u = await User.findById(conv.customer).select('name email phone avatar');
      if (u) {
        conv.customer = {
          _id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          avatar: u.avatar,
        };
        conv.customerName = u.name || conv.customerName;
        conv.customerEmail = u.email || conv.customerEmail;
        conv.customerPhone = u.phone || conv.customerPhone;
        conv.customerAvatar = u.avatar || conv.customerAvatar || '';
      }
    } catch (_) {}
  }

  // 2. If customer is null, but we have customerEmail, look up in User
  if (!conv.customerAvatar && conv.customerEmail) {
    try {
      const user = await User.findOne({ email: conv.customerEmail.toLowerCase().trim() }).select('name email phone avatar');
      if (user) {
        conv.customer = {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
        };
        conv.customerName = user.name || conv.customerName;
        conv.customerEmail = user.email || conv.customerEmail;
        conv.customerPhone = user.phone || conv.customerPhone;
        conv.customerAvatar = user.avatar || '';
      }
    } catch (_) {}
  }

  // 3. If customer is still not set or customerName === 'Khách hàng':
  if (!conv.customerAvatar && (!conv.customerName || conv.customerName === 'Khách hàng')) {
    try {
      let activeCustomer = await User.findOne({
        role: 'customer',
        avatar: { $exists: true, $ne: '' }
      }).sort({ updatedAt: -1, createdAt: -1 });

      if (!activeCustomer) {
        const customers = await User.find({ role: 'customer' }).sort({ updatedAt: -1, createdAt: -1 });
        activeCustomer = customers.find((u) => u.avatar && u.avatar.length > 50);
      }

      if (activeCustomer) {
        conv.customer = {
          _id: activeCustomer._id,
          name: activeCustomer.name,
          email: activeCustomer.email,
          phone: activeCustomer.phone,
          avatar: activeCustomer.avatar,
        };
        conv.customerName = activeCustomer.name;
        conv.customerEmail = activeCustomer.email;
        conv.customerPhone = activeCustomer.phone || conv.customerPhone;
        conv.customerAvatar = activeCustomer.avatar;
      }
    } catch (_) {}
  }

  // 4. Fallback avatar by customerName or dicebear fallback
  if (!conv.customerAvatar) {
    if (FALLBACK_AVATARS[conv.customerName]) {
      conv.customerAvatar = FALLBACK_AVATARS[conv.customerName];
    } else if (conv.customerName && conv.customerName !== 'Khách hàng') {
      conv.customerAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.customerName)}&background=10321c&color=85dd52&bold=true`;
    } else {
      conv.customerAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';
    }
  }

  // Also enrich message sender avatars and sender names
  if (Array.isArray(conv.messages)) {
    conv.messages = conv.messages.map((m) => {
      const msg = { ...m };
      if (msg.sender === 'customer') {
        msg.senderName = conv.customerName || 'Khách hàng';
        msg.senderAvatar = conv.customerAvatar || '';
      } else if (msg.sender === 'ai') {
        msg.senderName = 'NutriBot AI';
        msg.senderAvatar = 'https://api.iconify.design/lucide:bot.svg?color=%23176b3a';
      }
      return msg;
    });
  }

  return conv;
}

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

    const enriched = await Promise.all(conversations.map((c) => enrichConversation(c)));

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

    const enriched = await enrichConversation(conv);

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
});

// POST /api/support/conversations/:id/assign — take over conversation
router.post('/conversations/:id/assign', protect, hasRole('support', 'admin'), async (req, res, next) => {
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

    const enriched = await enrichConversation(conv);
    res.json({ success: true, data: enriched });
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

    const conv = await Conversation.findById(req.params.id)
      .populate('customer', 'name email phone avatar')
      .populate('assignedTo', 'name email')
      .populate('relatedOrder', 'orderCode total status');
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

    const enriched = await enrichConversation(conv);
    res.json({ success: true, data: enriched, message: msg });
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

    const conv = await Conversation.findById(req.params.id)
      .populate('customer', 'name email phone avatar')
      .populate('assignedTo', 'name email')
      .populate('relatedOrder', 'orderCode total status');
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Hội thoại không tồn tại' });
    }

    conv.status = status;
    await conv.save();

    const enriched = await enrichConversation(conv);
    res.json({ success: true, data: enriched });
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

    const authUser = req.user;
    const cid = authUser ? authUser._id : (customerInfo?.id || customerInfo?._id || null);
    const cname = authUser ? authUser.name : (customerInfo?.name || '');
    const cemail = authUser ? authUser.email : (customerInfo?.email || '');
    const cphone = authUser ? (authUser.phone || '') : (customerInfo?.phone || '');
    const cavatar = authUser ? (authUser.avatar || '') : (customerInfo?.avatar || '');

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
      content: 'NutriBot đã chuyển yêu cầu của bạn đến chuyên viên tư vấn Evergreen Mart. Nhân viên sẽ phản hồi trực tiếp cho bạn tại đây trong giây lát! 🌿',
      timestamp: new Date(),
    });
    conv.lastMessage = 'Yêu cầu gặp nhân viên tư vấn';
    conv.lastMessageAt = new Date();

    await conv.save();

    const enriched = await enrichConversation(conv);
    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

