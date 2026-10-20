const router  = require('express').Router();
const { body } = require('express-validator');
const Booking  = require('../models/Booking');
const Service  = require('../models/Service');
const { protect, adminOnly } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');

// POST /api/bookings — public
router.post('/',
  [
    body('service').notEmpty().withMessage('Dịch vụ không được để trống.'),
    body('guestName').notEmpty().withMessage('Họ tên không được để trống.'),
    body('guestEmail').isEmail().withMessage('Email không hợp lệ.'),
    body('date').notEmpty().withMessage('Ngày không được để trống.'),
    body('time').notEmpty().withMessage('Giờ không được để trống.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const service = await Service.findById(req.body.service);
      if (!service) return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại.' });

      const booking = await Booking.create({
        ...req.body,
        serviceName: service.name,
      });
      res.status(201).json({ success: true, data: booking });
    } catch (err) { next(err); }
  }
);

// GET /api/bookings — admin
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.$or = [
      { guestName:  { $regex: search, $options: 'i' } },
      { guestEmail: { $regex: search, $options: 'i' } },
      { serviceName: { $regex: search, $options: 'i' } },
    ];
    const skip = (Number(page) - 1) * Number(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
        .populate('service', 'name price'),
      Booking.countDocuments(filter),
    ]);
    res.json({ success: true, total, page: Number(page), data: bookings });
  } catch (err) { next(err); }
});

// PUT /api/bookings/:id/status — admin
router.put('/:id/status', protect, adminOnly, async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
    }
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy booking.' });
    res.json({ success: true, data: booking });
  } catch (err) { next(err); }
});

module.exports = router;
