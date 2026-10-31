const router   = require('express').Router();
const { body } = require('express-validator');
const Category = require('../models/Category');
const { protect, adminOnly } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');

// GET /api/categories — public
router.get('/', async (req, res, next) => {
  try {
    const cats = await Category.find({ isActive: { $ne: false } }).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: cats });
  } catch (err) { next(err); }
});

// POST /api/categories — admin
router.post('/', protect, adminOnly,
  [
    body('name').notEmpty().withMessage('Tên danh mục không được để trống.'),
    body('slug').notEmpty().withMessage('Slug không được để trống.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const cat = await Category.create(req.body);
      res.status(201).json({ success: true, data: cat });
    } catch (err) { next(err); }
  }
);

// PUT /api/categories/:id — admin
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cat) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
});

// DELETE /api/categories/:id — admin
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Đã xóa danh mục.' });
  } catch (err) { next(err); }
});

module.exports = router;
