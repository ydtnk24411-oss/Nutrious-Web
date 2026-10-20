const router  = require('express').Router();
const { body } = require('express-validator');
const Product  = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');

// GET /api/products  — public, supports ?category=&search=&sort=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { category, search, sort = 'createdAt', page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };
    if (category && category !== 'all') filter.category = { $regex: category, $options: 'i' };
    if (search) filter.$text = { $search: search };

    const sortObj = sort === 'price-asc'  ? { priceNumber:  1 }
                  : sort === 'price-desc' ? { priceNumber: -1 }
                  : sort === 'name-asc'   ? { name:  1 }
                  : sort === 'name-desc'  ? { name: -1 }
                  : { createdAt: -1 };

    const skip  = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortObj).skip(skip).limit(Number(limit)),
      Product.countDocuments(filter),
    ]);
    res.json({ success: true, total, page: Number(page), data: products });
  } catch (err) { next(err); }
});

// GET /api/products/:slug — public
router.get('/:slug', async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

const productValidation = [
  body('name').notEmpty().withMessage('Tên sản phẩm không được để trống.'),
  body('slug').notEmpty().withMessage('Slug không được để trống.'),
  body('priceNumber').isNumeric().withMessage('Giá phải là số.'),
  body('category').isIn(['Vegetables', 'Fruits', 'Meat']).withMessage('Danh mục không hợp lệ.'),
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
