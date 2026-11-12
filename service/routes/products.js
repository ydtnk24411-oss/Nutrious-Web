const router   = require('express').Router();
const mongoose = require('mongoose');
const { body } = require('express-validator');
const Product  = require('../models/Product');
const Category = require('../models/Category');
const { protect, adminOnly } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');
const {
  COMBO_ITEM_POPULATE_FIELDS,
  enrichComboDocument,
  enrichProductOrComboList,
} = require('../utils/comboHelper');
const {
  filterProductAddOnDeals,
  isValidAddOnDeal,
  isAddonPriceValid,
  isAddonRelevant,
} = require('../utils/addonRelevance');

const ADDON_POPULATE_FIELDS = 'name slug image price priceNumber unit weight stock isActive isCombo categoryVi category';

async function sanitizeAddOnDeals(rawDeals, selfId, mainDoc) {
  if (!Array.isArray(rawDeals) || rawDeals.length === 0) return [];
  const seen = new Set();
  const selfStr = selfId ? String(selfId) : '';
  const result = [];
  const mainPrice = mainDoc ? Number(mainDoc.priceNumber) || 0 : 0;

  for (const d of rawDeals) {
    if (!d) continue;
    const rawProd = d.product;
    const prodId = typeof rawProd === 'object' && rawProd !== null
      ? String(rawProd._id || rawProd.id || '')
      : String(rawProd || '');
    if (!mongoose.Types.ObjectId.isValid(prodId)) continue;
    if (selfStr && prodId === selfStr) continue;
    if (seen.has(prodId)) continue;
    seen.add(prodId);

    const cand = await Product.findById(prodId).select('name slug price priceNumber category categoryVi stock isActive isCombo').lean();
    if (!cand || cand.isActive === false || cand.isCombo) continue;

    // Bắt buộc: Giá sản phẩm mua kèm phải THẤP HƠN sản phẩm chính
    if (mainPrice > 0) {
      if (!isAddonPriceValid(mainDoc, cand) || !isAddonRelevant(mainDoc, cand)) {
        continue;
      }
    }

    const discountType = d.discountType === 'fixed' ? 'fixed' : 'percent';
    const rawVal = Math.max(0, Number(d.discountValue) || 0);
    const discountValue = discountType === 'percent'
      ? Math.min(99, Math.round(rawVal))
      : Math.round(rawVal);
    if (discountValue <= 0) continue;

    result.push({
      product: new mongoose.Types.ObjectId(prodId),
      discountType,
      discountValue,
      isActive: d.isActive !== false,
    });
  }
  return result;
}

// GET /api/products  — public, supports ?categoryId=&category=&search=&sort=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { categoryId, category, search, sort = 'createdAt', page = 1, limit = 20, isCombo } = req.query;
    const catParam = categoryId || category;
    const filter = { isActive: { $ne: false } };

    if (isCombo === 'true') {
      filter.isCombo = true;
    } else if (isCombo === 'false') {
      filter.isCombo = { $ne: true };
    }

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
      .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
      .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
    if (limitNum > 0) {
      const skip = (pageNum - 1) * limitNum;
      query = query.skip(skip).limit(limitNum);
    }
    const [products, total] = await Promise.all([
      query,
      Product.countDocuments(filter),
    ]);
    res.json({
      success: true,
      total,
      page: pageNum,
      data: enrichProductOrComboList(products),
    });
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
      comboStatus: { $nin: ['paused', 'hidden'] },
      'comboItems.product': product._id,
    })
      .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
      .limit(limitNum);

    // Bỏ combo rỗng hoặc có thành phần đã ngừng kinh doanh, đồng thời tính động giá mua lẻ & tồn kho khả dụng
    const valid = combos
      .filter(
        (c) =>
          Array.isArray(c.comboItems) &&
          c.comboItems.length > 0 &&
          c.comboItems.every((it) => it.product && it.product.isActive !== false)
      )
      .map((c) => enrichComboDocument(c));

    res.json({ success: true, data: valid });
  } catch (err) { next(err); }
});

// GET /api/products/:slug — public
router.get('/:slug', async (req, res, next) => {
  try {
    const publicFilter = {
      $or: [
        { isCombo: { $ne: true }, isActive: { $ne: false } },
        { isCombo: true, comboStatus: 'paused' },
        { isCombo: true, comboStatus: { $nin: ['hidden', 'paused'] }, isActive: { $ne: false } },
      ],
    };
    let product = await Product.findOne({ slug: req.params.slug, ...publicFilter })
      .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
      .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
    if (!product && mongoose.Types.ObjectId.isValid(req.params.slug)) {
      product = await Product.findOne({ _id: req.params.slug, ...publicFilter })
        .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
        .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
    }
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    const responseData = product.isCombo ? enrichComboDocument(product) : product;
    res.json({ success: true, data: responseData });
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
    if (req.body.addOnDeals !== undefined) {
      req.body.addOnDeals = req.body.isCombo ? [] : sanitizeAddOnDeals(req.body.addOnDeals, null);
    }
    const created = await Product.create(req.body);
    const product = await Product.findById(created._id)
      .populate('comboItems.product', 'name slug image price priceNumber unit weight stock')
      .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
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
    if (req.body.addOnDeals !== undefined) {
      req.body.addOnDeals = req.body.isCombo ? [] : sanitizeAddOnDeals(req.body.addOnDeals, req.params.id);
    }
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('comboItems.product', 'name slug image price priceNumber unit weight stock')
      .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
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
