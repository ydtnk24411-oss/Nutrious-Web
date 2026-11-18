const router   = require('express').Router();
const mongoose = require('mongoose');
const { body } = require('express-validator');
const Product  = require('../models/Product');
const Combo    = require('../models/Combo');
const Category = require('../models/Category');
const SearchLog = require('../models/SearchLog');
const { protect, adminOnly, optionalAuth, authorizeRoles } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');
const { cacheMiddleware, clearCache } = require('../utils/cache');
const { recordSearchLogSafely } = require('../utils/searchSanitizer');
const {
  COMBO_ITEM_POPULATE_FIELDS,
  normalizeProductImages,
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
// Cache 20 giây đối với các lượt duyệt catalog chung, KHÔNG cache đối với tìm kiếm từ khóa để đảm bảo ghi nhận SearchLog đầy đủ
router.get('/', optionalAuth, cacheMiddleware(20, (req) => !req.query.search && !req.query.keyword), async (req, res, next) => {
  try {
    const {
      categoryId,
      category,
      search,
      keyword,
      minPrice,
      maxPrice,
      inStock,
      sort = 'createdAt',
      page = 1,
      limit = 20,
      isCombo
    } = req.query;

    const searchTerm = (keyword || search || '').trim();
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

    // 1. Khoảng giá (minPrice, maxPrice)
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.priceNumber = {};
      if (minPrice !== undefined && !isNaN(Number(minPrice))) {
        filter.priceNumber.$gte = Math.max(0, Number(minPrice));
      }
      if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
        filter.priceNumber.$lte = Number(maxPrice);
      }
    }

    // 2. Tình trạng còn hàng (inStock)
    if (inStock === 'true' || inStock === true) {
      filter.stock = { $gt: 0 };
    }

    // 3. Tìm kiếm từ khóa / mã sản phẩm (keyword / search)
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, 'i');
      const searchCondition = {
        $or: [
          { name: { $regex: searchRegex } },
          { slug: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { brand: { $regex: searchRegex } },
        ]
      };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, searchCondition];
        delete filter.$or;
      } else {
        filter.$or = searchCondition.$or;
      }
    }

    const sortField = (sort === 'price-asc' || sort === 'priceNumber')   ? 'priceNumber'
                    : (sort === 'price-desc' || sort === '-priceNumber') ? 'priceNumber'
                    : (sort === 'name-asc' || sort === 'name')           ? 'name'
                    : (sort === 'name-desc' || sort === '-name')         ? 'name'
                    : (sort === 'bestseller' || sort === 'popular')      ? 'soldCount'
                    : (sort === 'rating')                                ? 'averageRating'
                    : 'createdAt';
    const sortDir = (sort === 'price-asc' || sort === 'priceNumber' || sort === 'name-asc' || sort === 'name') ? 1 : -1;
    const sortObj = sort === 'bestseller' || sort === 'popular' || sort === 'rating'
      ? { [sortField]: -1, createdAt: -1 }
      : { [sortField]: sortDir };

    const limitNum = Number(limit);
    const pageNum  = Math.max(1, Number(page) || 1);
    const skipNum  = limitNum > 0 ? (pageNum - 1) * limitNum : 0;

    let resultDocs = [];
    let total = 0;

    if (isCombo === 'true') {
      const comboFilter = { ...filter };
      delete comboFilter.isCombo;
      let comboQuery = Combo.find(comboFilter)
        .sort(sortObj)
        .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS);
      if (limitNum > 0) comboQuery = comboQuery.skip(skipNum).limit(limitNum);
      [resultDocs, total] = await Promise.all([comboQuery, Combo.countDocuments(comboFilter)]);
    } else if (isCombo === 'false') {
      let prodQuery = Product.find(filter)
        .sort(sortObj)
        .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
      if (limitNum > 0) prodQuery = prodQuery.skip(skipNum).limit(limitNum);
      [resultDocs, total] = await Promise.all([prodQuery, Product.countDocuments(filter)]);
    } else {
      // Combine standalone Products + active Combos from collection combos
      const prodFilter = { ...filter, isCombo: { $ne: true } };
      const comboFilter = { ...filter };
      delete comboFilter.isCombo;
      const [prods, combos] = await Promise.all([
        Product.find(prodFilter).sort(sortObj).populate('addOnDeals.product', ADDON_POPULATE_FIELDS),
        Combo.find(comboFilter).sort(sortObj).populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS),
      ]);
      const combined = [...prods, ...combos];
      combined.sort((a, b) => {
        if (sortField === 'name') {
          return sortDir * String(a.name || '').localeCompare(String(b.name || ''), 'vi');
        }
        if (sortField === 'priceNumber' || sortField === 'soldCount' || sortField === 'averageRating') {
          const diff = (Number(a[sortField]) || 0) - (Number(b[sortField]) || 0);
          if (diff !== 0) return sortDir * diff;
        }
        return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
      });
      total = combined.length;
      resultDocs = limitNum > 0 ? combined.slice(skipNum, skipNum + limitNum) : combined;
    }

    if (searchTerm) {
      recordSearchLogSafely({
        keyword: searchTerm,
        resultCount: total,
        customerId: req.user?._id || null,
        sessionId: req.sessionID || req.headers['x-session-id'] || '',
      });
    }

    res.json({
      success: true,
      total,
      page: pageNum,
      data: enrichProductOrComboList(resultDocs),
    });
  } catch (err) { next(err); }
});

async function findPublicItemOrCombo(rawSlug) {
  let product = await Product.findOne({ slug: rawSlug, isActive: { $ne: false } }).lean();
  if (!product && mongoose.Types.ObjectId.isValid(rawSlug)) {
    product = await Product.findOne({ _id: rawSlug, isActive: { $ne: false } }).lean();
  }
  if (product) return { doc: product, isCombo: false };

  const comboPublicFilter = {
    $or: [
      { comboStatus: 'paused' },
      { comboStatus: { $nin: ['hidden', 'paused'] }, isActive: { $ne: false } },
    ],
  };
  let combo = await Combo.findOne({ slug: rawSlug, ...comboPublicFilter }).lean();
  if (!combo && mongoose.Types.ObjectId.isValid(rawSlug)) {
    combo = await Combo.findOne({ _id: rawSlug, ...comboPublicFilter }).lean();
  }
  return combo ? { doc: combo, isCombo: true } : { doc: null, isCombo: false };
}

// GET /api/products/:slug/related — lấy sản phẩm liên quan cùng danh mục
router.get('/:slug/related', async (req, res, next) => {
  try {
    const { doc: product } = await findPublicItemOrCombo(req.params.slug);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }

    const limitNum = Math.min(16, Number(req.query.limit) || 8);
    const filter = {
      _id: { $ne: product._id },
      isActive: { $ne: false },
      stock: { $gt: 0 },
    };

    if (product.categoryId) {
      filter.categoryId = product.categoryId;
    } else if (product.category && product.category !== 'combo') {
      filter.category = product.category;
    }

    // Thuật toán: Cùng danh mục, còn tồn kho (stock > 0), sắp xếp theo rating và lượt bán nhiều nhất
    let related = await Product.find(filter)
      .sort({ rating: -1, soldCount: -1, createdAt: -1 })
      .limit(limitNum);

    // Nếu danh mục có ít sản phẩm, bổ sung thêm các sản phẩm nông sản tươi khác còn tồn kho
    if (related.length < limitNum) {
      const excludeIds = [product._id, ...related.map((r) => r._id)];
      const fallbackProducts = await Product.find({
        _id: { $nin: excludeIds },
        isActive: { $ne: false },
        stock: { $gt: 0 },
      })
        .sort({ rating: -1, soldCount: -1 })
        .limit(limitNum - related.length);
      related = [...related, ...fallbackProducts];
    }

    res.json({ success: true, data: related });
  } catch (err) { next(err); }
});

// GET /api/products/:slug/frequently-bought — Sản phẩm thường được mua cùng nhau (Frequently Bought Together)
router.get('/:slug/frequently-bought', async (req, res, next) => {
  try {
    const { doc: product } = await findPublicItemOrCombo(req.params.slug);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }

    // Tìm 2 sản phẩm gợi ý mua cùng: còn hàng, khác sản phẩm hiện tại, sắp xếp theo lượt bán và đánh giá
    const companionProducts = await Product.find({
      _id: { $ne: product._id },
      isActive: { $ne: false },
      stock: { $gt: 0 },
    })
      .sort({ soldCount: -1, rating: -1 })
      .limit(2)
      .lean();

    res.json({ success: true, data: companionProducts });
  } catch (err) { next(err); }
});

// GET /api/products/:slug/combos — combo mua kèm tiết kiệm có chứa sản phẩm này (từ collection combos)
router.get('/:slug/combos', async (req, res, next) => {
  try {
    const { doc: item, isCombo } = await findPublicItemOrCombo(req.params.slug);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }
    if (isCombo) {
      return res.json({ success: true, data: [] });
    }

    const limitNum = Math.min(6, Number(req.query.limit) || 3);
    const combos = await Combo.find({
      isActive: { $ne: false },
      comboStatus: { $nin: ['paused', 'hidden'] },
      'comboItems.product': item._id,
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

// GET /api/products/:slug — public (kiểm tra Product trước, nếu không có thì tìm trong collection combos)
router.get('/:slug', async (req, res, next) => {
  try {
    let product = await Product.findOne({ slug: req.params.slug, isActive: { $ne: false } })
      .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
    if (!product && mongoose.Types.ObjectId.isValid(req.params.slug)) {
      product = await Product.findOne({ _id: req.params.slug, isActive: { $ne: false } })
        .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
    }
    if (product) {
      const responseData = enrichProductOrComboList([product])[0];
      return res.json({ success: true, data: responseData });
    }

    const comboFilter = {
      $or: [
        { comboStatus: 'paused' },
        { comboStatus: { $nin: ['hidden', 'paused'] }, isActive: { $ne: false } },
      ],
    };
    let combo = await Combo.findOne({ slug: req.params.slug, ...comboFilter })
      .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS);
    if (!combo && mongoose.Types.ObjectId.isValid(req.params.slug)) {
      combo = await Combo.findOne({ _id: req.params.slug, ...comboFilter })
        .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS);
    }
    if (!combo) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    res.json({ success: true, data: enrichComboDocument(combo) });
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
    if (req.body.image || Array.isArray(req.body.images)) {
      req.body.images = normalizeProductImages({ image: req.body.image, images: req.body.images });
      if (!req.body.image && req.body.images.length) req.body.image = req.body.images[0];
    }
    if (req.body.addOnDeals !== undefined) {
      req.body.addOnDeals = await sanitizeAddOnDeals(req.body.addOnDeals, null, req.body);
    }
    const created = await Product.create(req.body);
    clearCache();
    const product = await Product.findById(created._id)
      .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
    res.status(201).json({ success: true, data: enrichProductOrComboList([product])[0] });
  } catch (err) { next(err); }
});

// PUT /api/products/:id — admin
router.put('/:id', protect, authorizeRoles('Manager', 'Admin', 'Sales'), async (req, res, next) => {
  try {
    const userRole = String(req.user?.role || req.session?.employee?.role || '').toLowerCase();
    const isPriceChanged = req.body.priceNumber !== undefined || req.body.price !== undefined;
    
    // Độc quyền Manager/Admin: Sales không được tự ý sửa giá sản phẩm
    if (isPriceChanged && userRole === 'sales') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Quản lý (Manager) hoặc Admin mới có quyền điều chỉnh giá sản phẩm.',
      });
    }

    if (req.body.categoryId) {
      const cat = await Category.findById(req.body.categoryId);
      if (cat) {
        req.body.category = (cat.slug || '').replace(/^\/category\//, '');
        req.body.categoryVi = cat.name;
      }
    }
    if (Array.isArray(req.body.images)) {
      const targetImage = req.body.image ?? (await Product.findById(req.params.id).select('image').lean())?.image;
      req.body.images = normalizeProductImages({ image: targetImage, images: req.body.images });
    } else if (typeof req.body.image === 'string' && req.body.image.trim()) {
      const existing = await Product.findById(req.params.id).select('images').lean();
      req.body.images = normalizeProductImages({ image: req.body.image, images: existing?.images || [] });
    }
    if (req.body.addOnDeals !== undefined) {
      const mainDoc = await Product.findById(req.params.id).select('priceNumber category categoryVi').lean();
      req.body.addOnDeals = await sanitizeAddOnDeals(req.body.addOnDeals, req.params.id, { ...mainDoc, ...req.body });
    }
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    clearCache();
    res.json({ success: true, data: enrichProductOrComboList([product])[0] });
  } catch (err) { next(err); }
});

// DELETE /api/products/:id — admin (soft delete)
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    clearCache();
    res.json({ success: true, message: 'Đã xóa sản phẩm.' });
  } catch (err) { next(err); }
});

module.exports = router;
