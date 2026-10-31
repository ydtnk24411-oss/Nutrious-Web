const router  = require('express').Router();
const { body } = require('express-validator');
const Product  = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');

// GET /api/products  — public, supports ?categoryId=&search=&sort=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { categoryId, search, sort = 'createdAt', page = 1, limit = 20 } = req.query;
    const filter = { isActive: { $ne: false } };

    if (categoryId && categoryId !== 'all') {
      // categoryId trong DB là string thường, không phải ObjectId
      filter.categoryId = categoryId;
    }

    if (search) filter.$text = { $search: search };

    const sortObj = sort === 'price-asc'  ? { priceNumber:  1 }
                  : sort === 'price-desc' ? { priceNumber: -1 }
                  : sort === 'name-asc'   ? { name:  1 }
                  : sort === 'name-desc'  ? { name: -1 }
                  : { createdAt: -1 };

    const limitNum = Number(limit);
    const pageNum  = Math.max(1, Number(page) || 1);
    let query = Product.find(filter).sort(sortObj);
    if (limitNum > 0) {
      const skip = (pageNum - 1) * limitNum;
      query = query.skip(skip).limit(limitNum);
    }
    const [products, total] = await Promise.all([
      query,
      Product.countDocuments(filter),
    ]);
    res.json({ success: true, total, page: pageNum, data: products });
  } catch (err) { next(err); }
});

// GET /api/products/:slug — public
router.get('/:slug', async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: { $ne: false } });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

const productValidation = [
  body('name').notEmpty().withMessage('Tên sản phẩm không được để trống.'),
  body('slug').notEmpty().withMessage('Slug không được để trống.'),
  body('priceNumber').isNumeric().withMessage('Giá phải là số.'),
];

// POST /api/products — admin
router.post('/', protect, adminOnly, productValidation, validate, async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
});

// PUT /api/products/:id — admin
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

// DELETE /api/products/:id — admin (soft delete)
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    res.json({ success: true, message: 'Đã xóa sản phẩm.' });
  } catch (err) { next(err); }
});

module.exports = router;
