const router = require('express').Router();
const Complaint = require('../models/Complaint');
const { protect, staffOnly, hasRole, optionalAuth } = require('../middleware/auth');

// GET /api/complaints — list for admin
router.get('/', protect, staffOnly, async (req, res, next) => {
  try {
    const { status, type, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status && status !== 'all') filter.status = status;
    if (type && type !== 'all') filter.type = type;
    if (search) {
      filter.$or = [
        { complaintCode: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
      ];
    }

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
      Complaint.countDocuments({ status: 'pending' }),
      Complaint.countDocuments({ status: 'processing' }),
      Complaint.countDocuments({ status: 'resolved' }),
      Complaint.countDocuments({ status: 'rejected' }),
    ]);

    const stats = {
      total,
      pending: pendingCount,
      processing: processingCount,
      resolved: resolvedCount,
      rejected: rejectedCount,
    };

    res.json({ success: true, data: complaints, stats, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/:id — detail
router.get('/:id', protect, staffOnly, async (req, res, next) => {
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

// POST /api/complaints — create complaint
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { title, description, type = 'product', orderId, customerName, customerPhone, customerEmail, images } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Tiêu đề và nội dung khiếu nại là bắt buộc' });
    }

    const complaint = await Complaint.create({
      customer: req.user?._id || null,
      customerName: req.user?.name || customerName || 'Khách hàng',
      customerPhone: req.user?.phone || customerPhone || '',
      customerEmail: req.user?.email || customerEmail || '',
      order: orderId || null,
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

// PUT /api/complaints/:id — update resolution
router.put('/:id', protect, hasRole('support', 'admin'), async (req, res, next) => {
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

