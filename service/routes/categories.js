const router   = require('express').Router();
const { body } = require('express-validator');
const Category = require('../models/Category');
const Product  = require('../models/Product');
const { protect, adminOnly, staffOnly, hasRole } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');

// GET /api/categories — public
router.get('/', async (req, res, next) => {
  try {
    const cats = await Category.find({ isActive: { $ne: false } }).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: cats });
  } catch (err) { next(err); }
});

// GET /api/categories/with-counts — for admin product & category management
router.get('/with-counts', protect, staffOnly, async (req, res, next) => {
  try {
    const cats = await Category.find({ isActive: { $ne: false } }).sort({ order: 1, createdAt: 1 });
    const catsWithCounts = await Promise.all(
      cats.map(async (c) => {
        const shortSlug = c.slug ? c.slug.replace(/^\/category\//, '') : '';
        const productCount = await Product.countDocuments({
          $or: [
            { categoryId: c._id },
            { category: c.name },
            { categoryVi: c.name },
            { category: shortSlug },
            { category: c.slug },
          ],
        });
        return {
          ...c.toObject(),
          productCount,
        };
      })
    );
    res.json({ success: true, data: catsWithCounts });
  } catch (err) { next(err); }
});

// POST /api/categories — admin
router.post('/', protect, hasRole('content', 'admin'),
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
router.put('/:id', protect, hasRole('content', 'admin'), async (req, res, next) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cat) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
});

// DELETE /api/categories/:id — admin with relation check
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });

    // Check products associated with this category
    const shortSlug = cat.slug ? cat.slug.replace(/^\/category\//, '') : '';
    const productCount = await Product.countDocuments({
      $or: [
        { categoryId: cat._id },
        { category: cat.name },
        { categoryVi: cat.name },
        { category: shortSlug },
        { category: cat.slug },
      ],
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa danh mục "${cat.name}" vì vẫn còn ${productCount} sản phẩm đang liên kết.`,
      });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa danh mục.' });
  } catch (err) { next(err); }
});

module.exports = router;
