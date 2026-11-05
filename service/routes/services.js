const router  = require('express').Router();
const { body } = require('express-validator');
const Service  = require('../models/Service');
const { protect, adminOnly } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');

// GET /api/services — public
router.get('/', async (req, res, next) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ createdAt: 1 });
    res.json({ success: true, data: services });
  } catch (err) { next(err); }
});

// GET /api/services/:slug — public
router.get('/:slug', async (req, res, next) => {
  try {
    const service = await Service.findOne({ slug: req.params.slug, isActive: true });
    if (!service) return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ.' });
    res.json({ success: true, data: service });
  } catch (err) { next(err); }
});

// POST /api/services — admin
router.post('/', protect, adminOnly,
  [
    body('name').notEmpty().withMessage('Tên dịch vụ không được để trống.'),
    body('slug').notEmpty().withMessage('Slug không được để trống.'),
    body('priceNumber').isNumeric().withMessage('Giá phải là số.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const service = await Service.create(req.body);
      res.status(201).json({ success: true, data: service });
    } catch (err) { next(err); }
  }
);

// PUT /api/services/:id — admin
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!service) return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ.' });
    res.json({ success: true, data: service });
  } catch (err) { next(err); }
});

// DELETE /api/services/:id — admin
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    await Service.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Đã xóa dịch vụ.' });
  } catch (err) { next(err); }
});

module.exports = router;
