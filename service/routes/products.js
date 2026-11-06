const router   = require('express').Router();
const mongoose = require('mongoose');
const { body } = require('express-validator');
const Product  = require('../models/Product');
const Category = require('../models/Category');
const { protect, adminOnly } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');

// GET /api/products  — public, supports ?categoryId=&category=&search=&sort=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { categoryId, category, search, sort = 'createdAt', page = 1, limit = 20 } = req.query;
    const catParam = categoryId || category;
    const filter = { isActive: { $ne: false } };

    if (catParam && catParam !== 'all') {
      if (mongoose.Types.ObjectId.isValid(catParam)) {
        filter.categoryId = new mongoose.Types.ObjectId(catParam);
      } else {
        // Find category by slug or name
        const cleanSlug = catParam.startsWith('/') ? catParam : `/category/${catParam}`;
        const foundCat = await Category.findOne({
          $or: [
            { slug: cleanSlug },
            { slug: catParam },
            { name: catParam }
          ]
        });
        if (foundCat) {
          filter.categoryId = foundCat._id;
        } else {
          filter.$or = [
            { category: catParam },
            { categoryVi: catParam },
          ];
        }
      }
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const searchCondition = {
        $or: [
          { name: { $regex: searchRegex } },
          { slug: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
        ]
      };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, searchCondition];
        delete filter.$or;
      } else {
        filter.$or = searchCondition.$or;
      }
    }

    const sortObj = sort === 'price-asc'  ? { priceNumber:  1 }
                  : sort === 'price-desc' ? { priceNumber: -1 }
                  : sort === 'name-asc'   ? { name:  1 }
                  : sort === 'name-desc'  ? { name: -1 }
                  : { createdAt: -1 };

    const limitNum = Number(limit);
    const pageNum  = Math.max(1, Number(page) || 1);
    let query = Product.find(filter)
      .sort(sortObj)
      .populate('comboItems.product', 'name slug image price priceNumber unit weight stock');
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

// GET /api/products/:slug/related — lấy sản phẩm liên quan cùng danh mục
router.get('/:slug/related', async (req, res, next) => {
  try {
    const rawSlug = req.params.slug;
    let product = await Product.findOne({ slug: rawSlug, isActive: { $ne: false } });
    if (!product && mongoose.Types.ObjectId.isValid(rawSlug)) {
      product = await Product.findOne({ _id: rawSlug, isActive: { $ne: false } });
    }
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }

    const limitNum = Math.min(16, Number(req.query.limit) || 8);
    const filter = {
      _id: { $ne: product._id },
      isActive: { $ne: false },
      isCombo: { $ne: true }
    };

    if (product.categoryId) {
      filter.categoryId = product.categoryId;
    } else if (product.category) {
      filter.category = product.category;
    }

    let related = await Product.find(filter).limit(limitNum);

    // Nếu danh mục có ít sản phẩm, bổ sung thêm các sản phẩm nông sản tươi khác
    if (related.length < limitNum) {
      const excludeIds = [product._id, ...related.map((r) => r._id)];
      const fallbackProducts = await Product.find({
        _id: { $nin: excludeIds },
        isActive: { $ne: false },
        isCombo: { $ne: true }
      }).limit(limitNum - related.length);
      related = [...related, ...fallbackProducts];
    }

    res.json({ success: true, data: related });
  } catch (err) { next(err); }
});

// GET /api/products/:slug/combos — combo mua kèm tiết kiệm có chứa sản phẩm này
router.get('/:slug/combos', async (req, res, next) => {
  try {
    const rawSlug = req.params.slug;
    let product = await Product.findOne({ slug: rawSlug, isActive: { $ne: false } });
    if (!product && mongoose.Types.ObjectId.isValid(rawSlug)) {
      product = await Product.findOne({ _id: rawSlug, isActive: { $ne: false } });
    }
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }

    const limitNum = Math.min(6, Number(req.query.limit) || 3);
    const combos = await Product.find({
      isCombo: true,
      isActive: { $ne: false },
      'comboItems.product': product._id,
    })
      .populate('comboItems.product', 'name slug image price priceNumber unit weight stock isActive')
      .limit(limitNum);

    // Bỏ combo có thành phần đã ngừng kinh doanh
    const valid = combos.filter((c) =>
      c.comboItems.every((it) => it.product && it.product.isActive !== false)
    );

    res.json({ success: true, data: valid });
  } catch (err) { next(err); }
});

// GET /api/products/:slug — public
router.get('/:slug', async (req, res, next) => {
  try {
    let product = await Product.findOne({ slug: req.params.slug, isActive: { $ne: false } })
      .populate('comboItems.product', 'name slug image price priceNumber unit weight stock');
    if (!product && mongoose.Types.ObjectId.isValid(req.params.slug)) {
      product = await Product.findOne({ _id: req.params.slug, isActive: { $ne: false } })
        .populate('comboItems.product', 'name slug image price priceNumber unit weight stock');
    }
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
    if (req.body.categoryId) {
      const cat = await Category.findById(req.body.categoryId);
      if (cat) {
        req.body.category = (cat.slug || '').replace(/^\/category\//, '');
        req.body.categoryVi = cat.name;
      }
    }
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
});

// PUT /api/products/:id — admin
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    if (req.body.categoryId) {
      const cat = await Category.findById(req.body.categoryId);
      if (cat) {
        req.body.category = (cat.slug || '').replace(/^\/category\//, '');
        req.body.categoryVi = cat.name;
      }
    }
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
