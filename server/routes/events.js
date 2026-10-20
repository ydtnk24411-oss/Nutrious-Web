const router = require('express').Router();
const { body } = require('express-validator');
const Event  = require('../models/Event');
const { protect, adminOnly } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');

// GET /api/events — public
router.get('/', async (req, res, next) => {
  try {
    const events = await Event.find({ isActive: true })
      .select('-registrations')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: events });
  } catch (err) { next(err); }
});

// GET /api/events/:slug — public
router.get('/:slug', async (req, res, next) => {
  try {
    const event = await Event.findOne({ slug: req.params.slug, isActive: true });
    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện.' });
    res.json({ success: true, data: event });
  } catch (err) { next(err); }
});

// POST /api/events/:slug/register — public
router.post('/:slug/register',
  [
    body('name').notEmpty().withMessage('Họ tên không được để trống.'),
    body('email').isEmail().withMessage('Email không hợp lệ.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const event = await Event.findOne({ slug: req.params.slug, isActive: true });
      if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện.' });
      if (event.registrations.length >= event.capacity) {
        return res.status(400).json({ success: false, message: 'Sự kiện đã hết chỗ.' });
      }
      event.registrations.push({ name: req.body.name, email: req.body.email, phone: req.body.phone });
      await event.save();
      res.json({ success: true, message: 'Đăng ký tham gia thành công!' });
    } catch (err) { next(err); }
  }
);

// POST /api/events — admin
router.post('/', protect, adminOnly,
  [
    body('name').notEmpty().withMessage('Tên sự kiện không được để trống.'),
    body('slug').notEmpty().withMessage('Slug không được để trống.'),
    body('date').notEmpty().withMessage('Ngày không được để trống.'),
    body('time').notEmpty().withMessage('Giờ không được để trống.'),
    body('location').notEmpty().withMessage('Địa điểm không được để trống.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const event = await Event.create(req.body);
      res.status(201).json({ success: true, data: event });
    } catch (err) { next(err); }
  }
);

// PUT /api/events/:id — admin
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện.' });
    res.json({ success: true, data: event });
  } catch (err) { next(err); }
});

// DELETE /api/events/:id — admin
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    await Event.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Đã xóa sự kiện.' });
  } catch (err) { next(err); }
});

// GET /api/events/admin/all — admin (kèm registrations)
router.get('/admin/all', protect, adminOnly, async (req, res, next) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json({ success: true, data: events });
  } catch (err) { next(err); }
});

module.exports = router;
