const router = require('express').Router();
const AuditLog = require('../models/AuditLog');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/audit-logs - Danh sách nhật ký hoạt động (chỉ Manager & Admin)
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      role,
      status,
      search,
    } = req.query;

    const filter = {};

    if (category && category !== 'all') {
      filter.category = category.toUpperCase();
    }

    if (role && role !== 'all') {
      filter.actorRole = role.toLowerCase();
    }

    if (status && status !== 'all') {
      filter.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { actorName: { $regex: q, $options: 'i' } },
        { actorEmail: { $regex: q, $options: 'i' } },
        { action: { $regex: q, $options: 'i' } },
        { details: { $regex: q, $options: 'i' } },
        { targetId: { $regex: q, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/audit-logs/stats - Thống kê nhanh các nhóm hoạt động
router.get('/stats', protect, adminOnly, async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, categoryStats, roleStats] = await Promise.all([
      AuditLog.countDocuments({ createdAt: { $gte: today } }),
      AuditLog.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AuditLog.aggregate([
        { $group: { _id: '$actorRole', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalToday,
        byCategory: categoryStats,
        byRole: roleStats,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
