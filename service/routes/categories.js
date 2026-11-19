const router   = require('express').Router();
const { body } = require('express-validator');
const Category = require('../models/Category');
const Product  = require('../models/Product');
const { protect, adminOnly, staffOnly, hasRole } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');
const { cacheMiddleware, clearCache } = require('../utils/cache');

// GET /api/categories - public (cache 10 phút, tự động xóa khi thêm/sửa/xóa danh mục)
router.get('/', cacheMiddleware(600, null, true), async (req, res, next) => {
  try {
    const cats = await Category.find({ isActive: { $ne: false } }).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: cats });
  } catch (err) { next(err); }
});

// GET /api/categories/with-counts - for admin product & category management
router.get('/with-counts', protect, staffOnly, async (req, res, next) => {
  try {
    const [cats, prods] = await Promise.all([
      Category.find({ isActive: { $ne: false } }).sort({ order: 1, createdAt: 1 }).lean(),
      Product.find({ isActive: { $ne: false } }).select('categoryId category categoryVi').lean(),
    ]);

    const catsWithCounts = cats.map((c) => {
      const catIdStr = String(c._id);
      const shortSlug = (c.slug || '').replace(/^\/category\//, '');
      const productCount = prods.filter((p) => {
        const pCatId = p.categoryId ? String(p.categoryId) : '';
        return (
          pCatId === catIdStr ||
          p.category === c.name ||
          p.categoryVi === c.name ||
          p.category === shortSlug ||
          p.category === c.slug
        );
      }).length;

      return {
        ...c,
        productCount,
      };
    });

    res.json({ success: true, data: catsWithCounts });
  } catch (err) { next(err); }
});

// POST /api/categories - admin
router.post('/', protect, hasRole('content', 'admin'),
  [
    body('name').notEmpty().withMessage('Tên danh mục không được để trống.'),
    body('slug').notEmpty().withMessage('Slug không được để trống.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const cat = await Category.create(req.body);
      clearCache();
      res.status(201).json({ success: true, data: cat });
    } catch (err) { next(err); }
  }
);

// PUT /api/categories/:id - admin
router.put('/:id', protect, hasRole('content', 'admin'), async (req, res, next) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cat) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });

    // Cascade update categoryVi & category slug cho các sản phẩm thuộc danh mục này
    try {
      const cleanSlug = (cat.slug || '').replace(/^\/category\//, '');
      await Product.updateMany(
        { categoryId: cat._id },
        { $set: { category: cleanSlug, categoryVi: cat.name } }
      );
    } catch (_) {}

    clearCache();
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
});

// DELETE /api/categories/:id - admin with relation check
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
    clearCache();
    res.json({ success: true, message: 'Đã xóa danh mục.' });
  } catch (err) { next(err); }
});

module.exports = router;
