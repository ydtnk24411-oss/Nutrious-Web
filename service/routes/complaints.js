const router = require('express').Router();
const Complaint = require('../models/Complaint');
const Order = require('../models/Order');
const { protect, staffOnly, hasRole, optionalAuth, getScopedStoreId } = require('../middleware/auth');

// GET /api/complaints - list for CSKH, Store Manager & Admin
router.get('/', protect, hasRole('admin', 'manager', 'sales', 'support'), async (req, res, next) => {
  try {
    const { status, type, search, page = 1, limit = 50 } = req.query;
    const conditions = [];

    // Phân quyền theo Chi nhánh phụ trách
    const scopedStore = getScopedStoreId(req);
    let countScope = {};
    if (scopedStore && scopedStore !== 'all' && scopedStore !== 'ALL') {
      const storeOrderIds = await Order.find({ warehouseId: scopedStore }).distinct('_id');
      const storeCondition = {
        $or: [
          { warehouseId: scopedStore },
          { order: { $in: storeOrderIds } },
        ],
      };
      conditions.push(storeCondition);
      countScope = storeCondition;
    }

    if (status && status !== 'all') conditions.push({ status });
    if (type && type !== 'all') conditions.push({ type });
    if (search) {
      conditions.push({
        $or: [
          { complaintCode: { $regex: search, $options: 'i' } },
          { customerName: { $regex: search, $options: 'i' } },
          { customerPhone: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const filter = conditions.length > 0 ? { $and: conditions } : {};

    const [
      complaints,
      total,
      pendingCount,
      processingCount,
      resolvedCount,
      rejectedCount,
    ] = await Promise.all([
      Complaint.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('customer', 'name email phone')
        .populate('order', 'orderCode total status createdAt')
        .populate('assignedTo', 'name email'),
      Complaint.countDocuments(filter),
      Complaint.countDocuments({ ...countScope, status: 'pending' }),
      Complaint.countDocuments({ ...countScope, status: 'processing' }),
      Complaint.countDocuments({ ...countScope, status: 'resolved' }),
      Complaint.countDocuments({ ...countScope, status: 'rejected' }),
    ]);

    const stats = {
      total,
      pending: pendingCount,
      processing: processingCount,
      resolved: resolvedCount,
      rejected: rejectedCount,
      scopedStore: scopedStore || 'all',
    };

    res.json({ success: true, data: complaints, stats, total, scopedStore: scopedStore || 'all' });
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/my - list complaints for logged in customer
router.get('/my', protect, async (req, res, next) => {
  try {
    const complaints = await Complaint.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .populate('order', 'orderCode total status createdAt');
    res.json({ success: true, data: complaints });
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/track/:code - track complaint by code (public)
router.get('/track/:code', async (req, res, next) => {
  try {
    const rawCode = String(req.params.code || '').trim();
    if (!rawCode) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã khiếu nại' });
    }

    const complaint = await Complaint.findOne({
      complaintCode: { $regex: new RegExp(`^${rawCode}$`, 'i') },
    })
      .populate('order', 'orderCode total status createdAt')
      .select('complaintCode customerName customerPhone customerEmail status type title description images resolutionNote resolvedAt createdAt updatedAt');

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khiếu nại với mã này' });
    }

    res.json({ success: true, data: complaint });
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/:id - detail (admin/staff)
router.get('/:id', protect, hasRole('admin', 'manager', 'sales', 'support'), async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('order', 'orderCode total status createdAt')
      .populate('assignedTo', 'name email');

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Khiếu nại không tồn tại' });
    }

    res.json({ success: true, data: complaint });
  } catch (err) {
    next(err);
  }
});

// POST /api/complaints - create complaint
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { title, description, type = 'product', orderId, orderCode, customerName, customerPhone, customerEmail, images } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Tiêu đề và nội dung khiếu nại là bắt buộc' });
    }

    let resolvedOrderId = orderId || null;
    if (!resolvedOrderId && orderCode) {
      try {
        const found = await Order.findOne({ orderCode: String(orderCode).trim().toUpperCase() });
        if (found) resolvedOrderId = found._id;
      } catch (e) {}
    }

    const complaint = await Complaint.create({
      customer: req.user?._id || null,
      customerName: req.user?.name || customerName || 'Khách hàng',
      customerPhone: req.user?.phone || customerPhone || '',
      customerEmail: req.user?.email || customerEmail || '',
      order: resolvedOrderId,
      type,
      title,
      description,
      images: images || [],
      status: 'pending',
    });

    res.status(201).json({ success: true, data: complaint });
  } catch (err) {
    next(err);
  }
});

// PUT /api/complaints/:id - update resolution
router.put('/:id', protect, hasRole('admin', 'support', 'cskh', 'sales', 'manager'), async (req, res, next) => {
  try {
    const { status, resolutionNote, assignedTo } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Khiếu nại không tồn tại' });
    }

    if (status) {
      complaint.status = status;
      if (status === 'resolved' && !complaint.resolvedAt) {
        complaint.resolvedAt = new Date();
      }
    }
    if (resolutionNote !== undefined) complaint.resolutionNote = resolutionNote;
    if (assignedTo) complaint.assignedTo = assignedTo;

    await complaint.save();

    res.json({ success: true, data: complaint });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

