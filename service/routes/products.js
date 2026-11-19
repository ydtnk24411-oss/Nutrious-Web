const router   = require('express').Router();
const mongoose = require('mongoose');
const { body } = require('express-validator');
const Product  = require('../models/Product');
const Combo    = require('../models/Combo');
const Category = require('../models/Category');
const ProductImage = require('../models/ProductImage');
const StoreInventory = require('../models/StoreInventory');
const ShippingConfig = require('../models/ShippingConfig');
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

function mergeUniqueByIdOrSlug(...lists) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const doc of list || []) {
      if (!doc) continue;
      const key = String(doc._id || doc.id || doc.slug || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(doc);
    }
  }
  return merged;
}

function sortMergedItems(list, sortField, sortDir) {
  list.sort((a, b) => {
    if (sortField === 'name') {
      return sortDir * String(a.name || '').localeCompare(String(b.name || ''), 'vi');
    }
    if (sortField === 'priceNumber' || sortField === 'soldCount' || sortField === 'averageRating') {
      const diff = (Number(a[sortField]) || 0) - (Number(b[sortField]) || 0);
      if (diff !== 0) return sortDir * diff;
    }
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

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

// GET /api/products  - public, supports ?categoryId=&category=&search=&sort=&page=&limit=
// Cache 10 phút (600s) đối với các lượt duyệt catalog chung, tự động xóa cache khi admin thêm/sửa/xóa sản phẩm
router.get('/', optionalAuth, cacheMiddleware(600, (req) => !req.query.search && !req.query.keyword, true), async (req, res, next) => {
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
    const useBrief = req.query.format === 'brief' || req.query.fields === 'brief' || limitNum === 0 || limitNum > 100;

    let resultDocs = [];
    let total = 0;

    if (isCombo === 'true') {
      const comboColFilter = { ...filter };
      delete comboColFilter.isCombo;
      const prodComboFilter = { ...filter, isCombo: true };
      const [colCombos, prodCombos] = await Promise.all([
        Combo.find(comboColFilter)
          .sort(sortObj)
          .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
          .lean(),
        Product.find(prodComboFilter)
          .sort(sortObj)
          .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
          .lean(),
      ]);
      const combinedCombos = mergeUniqueByIdOrSlug(
        colCombos.map((c) => ({ ...c, isCombo: true })),
        prodCombos
      );
      sortMergedItems(combinedCombos, sortField, sortDir);
      total = combinedCombos.length;
      resultDocs = limitNum > 0 ? combinedCombos.slice(skipNum, skipNum + limitNum) : combinedCombos;
    } else if (isCombo === 'false') {
      let prodQuery = Product.find(filter)
        .sort(sortObj)
        .lean();
      if (!useBrief) {
        prodQuery = prodQuery.populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
      } else {
        prodQuery = prodQuery.select('name slug price priceNumber image images category categoryVi categoryId stock reservedStock safetyBuffer isActive isCombo addOnDeals weight unit soldCount averageRating container cutType cutting packSize packaging preparation quantity ripeness sizeGroup thickness type specifications description createdAt');
      }
      if (limitNum > 0) prodQuery = prodQuery.skip(skipNum).limit(limitNum);
      [resultDocs, total] = await Promise.all([prodQuery, Product.countDocuments(filter)]);
    } else {
      // Combine standalone Products + active Combos from both collection combos and legacy Product { isCombo: true }
      const prodFilter = { ...filter, isCombo: { $ne: true } };
      const comboColFilter = { ...filter };
      delete comboColFilter.isCombo;
      const prodComboFilter = { ...filter, isCombo: true };
      let prodQuery = Product.find(prodFilter).sort(sortObj).lean();
      if (!useBrief) {
        prodQuery = prodQuery.populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
      } else {
        prodQuery = prodQuery.select('name slug price priceNumber image images category categoryVi categoryId stock reservedStock safetyBuffer isActive isCombo addOnDeals weight unit soldCount averageRating container cutType cutting packSize packaging preparation quantity ripeness sizeGroup thickness type specifications description createdAt');
      }
      const [prods, colCombos, prodCombos] = await Promise.all([
        prodQuery,
        Combo.find(comboColFilter).sort(sortObj).populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS).lean(),
        Product.find(prodComboFilter).sort(sortObj).populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS).lean(),
      ]);
      const combined = mergeUniqueByIdOrSlug(
        prods,
        colCombos.map((c) => ({ ...c, isCombo: true })),
        prodCombos
      );
      sortMergedItems(combined, sortField, sortDir);
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

    const storeId = req.query.storeId || req.headers['x-store-id'];
    let enrichedData = enrichProductOrComboList(resultDocs);

    if (storeId && storeId !== 'all') {
      const prodIdSet = new Set();
      for (const p of enrichedData) {
        if (p._id || p.id) prodIdSet.add(String(p._id || p.id));
        if (Array.isArray(p.comboItems)) {
          for (const ci of p.comboItems) {
            const ciId = ci?.product?._id || ci?.product?.id || ci?.product;
            if (ciId) prodIdSet.add(String(ciId));
          }
        }
      }
      const prodIds = [...prodIdSet].filter((id) => mongoose.Types.ObjectId.isValid(id));
      const storeInvs = prodIds.length > 0
        ? await StoreInventory.find({
            storeId,
            productId: { $in: prodIds },
          }).lean()
        : [];

      const invMap = new Map(storeInvs.map(inv => [String(inv.productId), inv]));

      enrichedData = enrichedData.map(p => {
        const prodObj = typeof p.toObject === 'function' ? p.toObject() : { ...p };
        const inv = invMap.get(String(prodObj._id || prodObj.id));

        if (prodObj.isCombo && Array.isArray(prodObj.comboItems)) {
          let minComboStock = 9999;
          for (const ci of prodObj.comboItems) {
            const ciProd = ci.product;
            const ciId = ciProd?._id || ciProd?.id || ciProd;
            const ciInv = invMap.get(String(ciId));
            const ciStock = ciInv ? Math.max(0, (ciInv.physicalStock || 0) - (ciInv.reservedStock || 0) - (ciInv.safetyBuffer || 0)) : 0;
            const perCombo = Math.floor(ciStock / (ci.quantity || 1));
            minComboStock = Math.min(minComboStock, perCombo);
          }
          const availableStock = minComboStock === 9999 ? 0 : minComboStock;
          prodObj.availableStock = availableStock;
          prodObj.stock = availableStock;
          prodObj.storeStock = availableStock;
        } else {
          const availableStock = inv
            ? Math.max(0, (inv.physicalStock || 0) - (inv.reservedStock || 0) - (inv.safetyBuffer || 0))
            : ((storeId === 'store-thuduc' || storeId === 'default') ? Math.max(0, (prodObj.stock || 0) - (prodObj.safetyBuffer || 0)) : 0);
          prodObj.storePhysicalStock = inv?.physicalStock || 0;
          prodObj.storeReservedStock = inv?.reservedStock || 0;
          prodObj.availableStock = availableStock;
          prodObj.stock = availableStock;
          prodObj.storeStock = availableStock;
          if (inv?.storeDiscountPrice && Number(inv.storeDiscountPrice) > 0) {
            prodObj.originalPrice = prodObj.price || (Number(prodObj.priceNumber || 0).toLocaleString('vi-VN') + ' ₫');
            prodObj.originalPriceNumber = prodObj.priceNumber || 0;
            prodObj.priceNumber = Number(inv.storeDiscountPrice);
            prodObj.price = Number(inv.storeDiscountPrice).toLocaleString('vi-VN') + ' ₫';
            prodObj.isStoreDiscount = true;
            prodObj.storeDiscountPrice = Number(inv.storeDiscountPrice);
          } else if (inv?.storePrice) {
            prodObj.priceNumber = inv.storePrice;
            prodObj.price = inv.storePrice.toLocaleString('vi-VN') + ' ₫';
          }
        }
        prodObj.storeId = storeId;
        prodObj.storeName = inv?.storeName || '';
        return prodObj;
      });

      if (inStock === 'true' || inStock === true) {
        enrichedData = enrichedData.filter(p => (p.stock ?? 0) > 0);
      }
    }

    res.json({
      success: true,
      total: (storeId && storeId !== 'all' && (inStock === 'true' || inStock === true)) ? enrichedData.length : total,
      page: pageNum,
      data: enrichedData,
    });
  } catch (err) { next(err); }
});

async function findPublicItemOrCombo(rawSlug) {
  const prodPublicFilter = {
    $or: [
      { isCombo: { $ne: true }, isActive: { $ne: false } },
      { isCombo: true, comboStatus: 'paused' },
      { isCombo: true, comboStatus: { $nin: ['hidden', 'paused'] }, isActive: { $ne: false } },
    ],
  };
  let product = await Product.findOne({ slug: rawSlug, ...prodPublicFilter }).lean();
  if (!product && mongoose.Types.ObjectId.isValid(rawSlug)) {
    product = await Product.findOne({ _id: rawSlug, ...prodPublicFilter }).lean();
  }
  if (product) return { doc: product, isCombo: Boolean(product.isCombo) };

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

// GET /api/products/:slug/related - lấy sản phẩm liên quan cùng danh mục
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
      isCombo: { $ne: true },
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
        isCombo: { $ne: true },
        stock: { $gt: 0 },
      })
        .sort({ rating: -1, soldCount: -1 })
        .limit(limitNum - related.length);
      related = [...related, ...fallbackProducts];
    }

    res.json({ success: true, data: enrichProductOrComboList(related) });
  } catch (err) { next(err); }
});

// GET /api/products/:slug/frequently-bought - Sản phẩm thường được mua cùng nhau (Frequently Bought Together)
router.get('/:slug/frequently-bought', async (req, res, next) => {
  try {
    const { doc: product } = await findPublicItemOrCombo(req.params.slug);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }

    // Tìm 2 sản phẩm gợi ý mua cùng: còn hàng, không phải combo, khác sản phẩm hiện tại
    const companionProducts = await Product.find({
      _id: { $ne: product._id },
      isActive: { $ne: false },
      isCombo: { $ne: true },
      stock: { $gt: 0 },
    })
      .sort({ soldCount: -1, rating: -1 })
      .limit(2)
      .lean();

    res.json({ success: true, data: enrichProductOrComboList(companionProducts) });
  } catch (err) { next(err); }
});

// GET /api/products/:slug/combos - combo mua kèm tiết kiệm có chứa sản phẩm này (đọc cả collection combos và Product { isCombo: true })
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
    const sharedFilter = {
      isActive: { $ne: false },
      comboStatus: { $nin: ['paused', 'hidden'] },
      'comboItems.product': item._id,
    };

    const [colCombos, prodCombos] = await Promise.all([
      Combo.find(sharedFilter)
        .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
        .limit(limitNum)
        .lean(),
      Product.find({ isCombo: true, ...sharedFilter })
        .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
        .limit(limitNum)
        .lean(),
    ]);

    const combos = mergeUniqueByIdOrSlug(colCombos, prodCombos);

    // Bỏ combo rỗng hoặc có thành phần đã ngừng kinh doanh, đồng thời tính động giá mua lẻ & tồn kho khả dụng
    const valid = combos
      .filter(
        (c) =>
          Array.isArray(c.comboItems) &&
          c.comboItems.length > 0 &&
          c.comboItems.every((it) => it.product && it.product.isActive !== false)
      )
      .slice(0, limitNum)
      .map((c) => enrichComboDocument(c, { assumeCombo: true }));

    res.json({ success: true, data: valid });
  } catch (err) { next(err); }
});

// POST /api/products/compare-store-prices - so sánh giá và tồn kho giữa 2 chi nhánh khi đổi khu vực
router.post('/compare-store-prices', async (req, res, next) => {
  try {
    const { fromStoreId, toStoreId, items } = req.body;
    if (!fromStoreId || !toStoreId || !Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, hasDiscrepancy: false, discrepancies: [] });
    }

    if (fromStoreId === toStoreId) {
      return res.json({ success: true, hasDiscrepancy: false, discrepancies: [] });
    }

    const shippingConfig = await ShippingConfig.findOne({ key: 'default' }).lean();
    let warehouses = shippingConfig?.warehouses || [];
    if (warehouses.length === 0) {
      const stores = await mongoose.connection.db.collection('stores').find({ isActive: { $ne: false } }).toArray();
      warehouses = stores.map((s) => ({
        id: s.storeId || String(s._id),
        name: s.name,
        address: s.address || '',
      }));
    }
    const fromStoreInfo = warehouses.find((w) => w.id === fromStoreId) || { id: fromStoreId, name: fromStoreId };
    const toStoreInfo = warehouses.find((w) => w.id === toStoreId) || { id: toStoreId, name: toStoreId };

    const discrepancies = [];

    for (const it of items) {
      const prodIdentifier = it.productId || it.product || it.slug;
      if (!prodIdentifier) continue;

      let p = null;
      if (mongoose.Types.ObjectId.isValid(prodIdentifier)) {
        p = await Product.findById(prodIdentifier).lean();
      }
      if (!p && typeof prodIdentifier === 'string') {
        p = await Product.findOne({ slug: prodIdentifier }).lean();
      }
      if (!p) continue;

      const [fromInv, toInv] = await Promise.all([
        StoreInventory.findOne({ storeId: fromStoreId, productId: p._id }).lean(),
        StoreInventory.findOne({ storeId: toStoreId, productId: p._id }).lean(),
      ]);

      const oldPrice = Number(fromInv?.storeDiscountPrice || fromInv?.basePrice || it.priceNumber || p.priceNumber || 0);
      const newPrice = Number(toInv?.storeDiscountPrice || toInv?.basePrice || p.priceNumber || 0);

      const toPhysical = toInv?.physicalStock ?? p.stock ?? 0;
      const toReserved = toInv?.reservedStock ?? 0;
      const toBuffer = toInv?.safetyBuffer ?? 0;
      const toAvailable = Math.max(0, toPhysical - toReserved - toBuffer);

      const qty = Number(it.quantity) || 1;
      const isPriceChanged = oldPrice !== newPrice;
      const isOutOfStock = toAvailable < qty;

      if (isPriceChanged || isOutOfStock) {
        discrepancies.push({
          productId: String(p._id),
          productName: p.name,
          slug: p.slug,
          image: p.image,
          requestedQuantity: qty,
          oldPrice,
          newPrice,
          priceDiff: newPrice - oldPrice,
          isPriceChanged,
          oldStoreStock: fromInv?.physicalStock ?? p.stock ?? 0,
          newStoreStock: toAvailable,
          isOutOfStock,
        });
      }
    }

    res.json({
      success: true,
      fromStore: fromStoreInfo,
      toStore: toStoreInfo,
      hasDiscrepancy: discrepancies.length > 0,
      discrepancies,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/check-store-stock - kiểm tra số lượng tồn kho khả dụng của danh sách món tại chi nhánh chỉ định
router.post('/check-store-stock', async (req, res, next) => {
  try {
    const { storeId, items } = req.body;
    if (!storeId || !Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, hasShortage: false, items: [], shortages: [] });
    }

    const targetStoreId = String(storeId).trim();
    const resultItems = [];
    const shortages = [];

    // Lấy thông tin kho
    const shippingConfig = await ShippingConfig.findOne({ key: 'default' }).lean();
    let warehouses = shippingConfig?.warehouses || [];
    const storeInfo = warehouses.find((w) => w.id === targetStoreId) || { id: targetStoreId, name: targetStoreId };
    const storeName = storeInfo.name || targetStoreId;

    for (const it of items) {
      const prodIdentifier = it.productId || it.product || it.slug;
      if (!prodIdentifier) continue;

      let p = null;
      if (mongoose.Types.ObjectId.isValid(prodIdentifier)) {
        p = await Product.findById(prodIdentifier).lean();
      }
      if (!p && typeof prodIdentifier === 'string') {
        p = await Product.findOne({ slug: prodIdentifier }).lean();
      }
      if (!p) continue;

      const requestedQty = Math.max(1, Number(it.quantity) || 1);
      let availableStock = 0;
      let buffer = 0;

      if (p.isCombo && Array.isArray(p.comboItems) && p.comboItems.length > 0) {
        let minComboAvail = 999999;
        for (const ci of p.comboItems) {
          const compId = ci.product?._id || ci.product;
          if (!compId) continue;
          const compInv = await StoreInventory.findOne({ storeId: targetStoreId, productId: compId }).lean();
          let compAvail = 0;
          if (compInv) {
            compAvail = Math.max(0, (compInv.physicalStock ?? 0) - (compInv.reservedStock ?? 0) - (compInv.safetyBuffer ?? 0));
          } else {
            const compDoc = await Product.findById(compId).lean();
            compAvail = Math.max(0, (compDoc?.stock || 0) - (compDoc?.safetyBuffer || 0));
          }
          const perCombo = Math.max(1, Number(ci.quantity) || 1);
          const possible = Math.floor(compAvail / perCombo);
          if (possible < minComboAvail) {
            minComboAvail = possible;
          }
        }
        availableStock = minComboAvail === 999999 ? 0 : minComboAvail;
      } else {
        const storeInv = await StoreInventory.findOne({ storeId: targetStoreId, productId: p._id }).lean();
        if (storeInv) {
          const phys = storeInv.physicalStock ?? 0;
          const resv = storeInv.reservedStock ?? 0;
          buffer = storeInv.safetyBuffer ?? 0;
          availableStock = Math.max(0, phys - resv - buffer);
        } else if (targetStoreId === 'store-thuduc' || targetStoreId === 'default') {
          availableStock = Math.max(0, (p.stock || 0) - (p.safetyBuffer || 0));
        } else {
          availableStock = 0;
        }
      }

      const isShortage = availableStock < requestedQty;
      const itemRes = {
        productId: String(p._id),
        slug: p.slug,
        name: p.name,
        requestedQty,
        availableStock,
        maxQty: availableStock,
        isShortage,
      };
      resultItems.push(itemRes);

      if (isShortage) {
        shortages.push({
          ...itemRes,
          storeName,
          message: `Chi nhánh [${storeName}] hiện chỉ còn ${availableStock} "${p.name}" khả dụng cho kênh Online (bạn đang chọn ${requestedQty}).`,
        });
      }
    }

    res.json({
      success: true,
      storeId: targetStoreId,
      storeName,
      hasShortage: shortages.length > 0,
      items: resultItems,
      shortages,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug/stock-by-stores - kiểm tra tồn kho của sản phẩm tại tất cả các chi nhánh
router.get('/:slug/stock-by-stores', async (req, res, next) => {
  try {
    const rawSlug = req.params.slug;
    let product = await Product.findOne({ slug: rawSlug, isActive: { $ne: false } });
    if (!product && mongoose.Types.ObjectId.isValid(rawSlug)) {
      product = await Product.findOne({ _id: rawSlug, isActive: { $ne: false } });
    }
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }

    const inventories = await StoreInventory.find({ productId: product._id }).lean();
    const invMap = new Map(inventories.map((inv) => [inv.storeId, inv]));

    const shippingConfig = await ShippingConfig.findOne({ key: 'default' }).lean();
    let warehouses = (shippingConfig?.warehouses && shippingConfig.warehouses.length > 0)
      ? shippingConfig.warehouses
      : [];
    if (warehouses.length === 0) {
      const stores = await mongoose.connection.db.collection('stores').find({ isActive: { $ne: false } }).toArray();
      warehouses = stores.map((s) => ({
        id: s.storeId || String(s._id),
        name: s.name,
        address: s.address || '',
        province: s.province || '',
        district: s.district || '',
        phone: s.phone || '',
        openingHours: s.operatingHours ? `${s.operatingHours.open} - ${s.operatingHours.close}` : '07:00 - 21:30',
        lat: Array.isArray(s.location?.coordinates) ? s.location.coordinates[1] : undefined,
        lng: Array.isArray(s.location?.coordinates) ? s.location.coordinates[0] : undefined,
      }));
    }

    const storesStock = warehouses.map((w) => {
      const inv = invMap.get(w.id);
      const physical = inv?.physicalStock || 0;
      const reserved = inv?.reservedStock || 0;
      const buffer = inv?.safetyBuffer || 0;
      const available = Math.max(0, physical - reserved - buffer);
      return {
        storeId: w.id,
        storeName: w.name,
        address: w.address,
        province: w.province,
        district: w.district,
        phone: w.phone,
        openingHours: w.openingHours || '07:00 - 21:30',
        lat: w.lat,
        lng: w.lng,
        physicalStock: physical,
        availableStock: available,
        inStock: available > 0,
      };
    });

    res.json({
      success: true,
      data: {
        product: { id: product._id, name: product.name, slug: product.slug, totalStock: product.stock },
        stores: storesStock,
        totalStoresInStock: storesStock.filter((s) => s.inStock).length,
      },
    });
  } catch (err) { next(err); }
});

async function applyStoreStockToDetail(responseData, storeId) {
  if (!storeId || storeId === 'all') return responseData;

  if (responseData.isCombo && Array.isArray(responseData.comboItems) && responseData.comboItems.length > 0) {
    const compIds = responseData.comboItems
      .map((ci) => ci?.product?._id || ci?.product?.id || ci?.product)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));
    const compInvs = compIds.length > 0
      ? await StoreInventory.find({ storeId, productId: { $in: compIds } }).lean()
      : [];
    const invMap = new Map(compInvs.map((inv) => [String(inv.productId), inv]));
    let minComboStock = 9999;
    for (const ci of responseData.comboItems) {
      const ciId = ci?.product?._id || ci?.product?.id || ci?.product;
      const ciInv = invMap.get(String(ciId));
      const ciStock = ciInv ? Math.max(0, (ciInv.physicalStock || 0) - (ciInv.reservedStock || 0) - (ciInv.safetyBuffer || 0)) : 0;
      minComboStock = Math.min(minComboStock, Math.floor(ciStock / (ci.quantity || 1)));
    }
    const availableStock = minComboStock === 9999 ? 0 : minComboStock;
    responseData.availableStock = availableStock;
    responseData.stock = availableStock;
    responseData.storeStock = availableStock;
    responseData.storeId = storeId;
    return responseData;
  }

  const inv = await StoreInventory.findOne({ storeId, productId: responseData._id }).lean();
  const availableStock = inv
    ? Math.max(0, (inv.physicalStock || 0) - (inv.reservedStock || 0) - (inv.safetyBuffer || 0))
    : ((storeId === 'store-thuduc' || storeId === 'default') ? Math.max(0, (responseData.stock || 0) - (responseData.safetyBuffer || 0)) : 0);
  responseData.storePhysicalStock = inv?.physicalStock || 0;
  responseData.storeReservedStock = inv?.reservedStock || 0;
  responseData.availableStock = availableStock;
  responseData.stock = availableStock;
  responseData.storeStock = availableStock;
  responseData.storeId = storeId;
  responseData.storeName = inv?.storeName || '';
  if (inv?.storeDiscountPrice && Number(inv.storeDiscountPrice) > 0) {
    responseData.originalPrice = responseData.price || (Number(responseData.priceNumber || 0).toLocaleString('vi-VN') + ' ₫');
    responseData.originalPriceNumber = responseData.priceNumber || 0;
    responseData.priceNumber = Number(inv.storeDiscountPrice);
    responseData.price = Number(inv.storeDiscountPrice).toLocaleString('vi-VN') + ' ₫';
    responseData.isStoreDiscount = true;
    responseData.storeDiscountPrice = Number(inv.storeDiscountPrice);
  } else if (inv?.storePrice) {
    responseData.priceNumber = Number(inv.storePrice);
    responseData.price = Number(inv.storePrice).toLocaleString('vi-VN') + ' ₫';
  }
  return responseData;
}

// GET /api/products/:slug - public (kiểm tra Product trước, nếu không có thì tìm trong collection combos)
router.get('/:slug', async (req, res, next) => {
  try {
    const storeId = req.query.storeId || req.headers['x-store-id'];
    const prodPublicFilter = {
      $or: [
        { isCombo: { $ne: true }, isActive: { $ne: false } },
        { isCombo: true, comboStatus: 'paused' },
        { isCombo: true, comboStatus: { $nin: ['hidden', 'paused'] }, isActive: { $ne: false } },
      ],
    };
    let product = await Product.findOne({ slug: req.params.slug, ...prodPublicFilter })
      .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
      .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
    if (!product && mongoose.Types.ObjectId.isValid(req.params.slug)) {
      product = await Product.findOne({ _id: req.params.slug, ...prodPublicFilter })
        .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
        .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
    }
    if (product) {
      const responseData = enrichProductOrComboList([product])[0];
      await applyStoreStockToDetail(responseData, storeId);
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
    const comboData = enrichComboDocument(combo);
    await applyStoreStockToDetail(comboData, storeId);
    res.json({ success: true, data: comboData });
  } catch (err) { next(err); }
});

const productValidation = [
  body('name').notEmpty().withMessage('Tên sản phẩm không được để trống.'),
  body('slug').notEmpty().withMessage('Slug không được để trống.'),
  body('priceNumber').isNumeric().withMessage('Giá phải là số.'),
];

// POST /api/products - admin
router.post('/', protect, adminOnly, productValidation, validate, async (req, res, next) => {
  try {
    if (req.body.slug) {
      const existingProduct = await Product.findOne({ slug: req.body.slug.trim().toLowerCase() });
      if (existingProduct) {
        return res.status(409).json({
          success: false,
          message: 'Mã SKU này đã tồn tại trong hệ thống, vui lòng nhập mã khác.',
        });
      }
    }

    if (req.body.categoryId) {
      const cat = await Category.findById(req.body.categoryId);
      if (cat) {
        req.body.category = (cat.slug || '').replace(/^\/category\//, '');
        req.body.categoryVi = cat.name;
      }
    } else if (req.body.category) {
      const cleanSlug = String(req.body.category).replace(/^\/category\//, '');
      const cat = await Category.findOne({
        $or: [
          { slug: cleanSlug },
          { slug: `/category/${cleanSlug}` },
          { name: req.body.category },
        ],
      });
      if (cat) {
        req.body.categoryId = cat._id;
        req.body.categoryVi = cat.name;
        req.body.category = cleanSlug;
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

    // Đồng bộ sang bảng chuẩn hóa ProductImage
    if (created.image) {
      try {
        await ProductImage.findOneAndUpdate(
          { productId: created._id, isPrimary: true },
          {
            $set: {
              productId: created._id,
              imageUrl: created.image,
              imageType: 'thumbnail',
              caption: created.name,
              sortOrder: 1,
              isPrimary: true,
            },
          },
          { upsert: true }
        );
      } catch (_) {}
    }

    // Khởi tạo bản ghi tồn kho cấp chi nhánh StoreInventory cho kho trung tâm
    try {
      await StoreInventory.findOneAndUpdate(
        { storeId: 'store-thuduc', productId: created._id },
        {
          $setOnInsert: {
            storeId: 'store-thuduc',
            storeName: 'Evergreen Mart Thủ Đức',
            productId: created._id,
            sku: created.slug || '',
            productName: created.name,
            physicalStock: Math.max(0, Number(created.stock) || 0),
            reservedStock: 0,
            safetyBuffer: 2,
          },
        },
        { upsert: true }
      );
    } catch (_) {}

    clearCache();
    const product = await Product.findById(created._id)
      .populate('addOnDeals.product', ADDON_POPULATE_FIELDS);
    res.status(201).json({ success: true, data: enrichProductOrComboList([product])[0] });
  } catch (err) { next(err); }
});

// PUT /api/products/:id - Manager, Admin & Marketing
router.put('/:id', protect, authorizeRoles('Manager', 'Admin', 'Marketing'), async (req, res, next) => {
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

    if (req.body.slug) {
      const existingProduct = await Product.findOne({
        slug: req.body.slug.trim().toLowerCase(),
        _id: { $ne: req.params.id }
      });
      if (existingProduct) {
        return res.status(409).json({
          success: false,
          message: 'Mã SKU này đã tồn tại trong hệ thống, vui lòng nhập mã khác.',
        });
      }
    }

    if (req.body.categoryId) {
      const cat = await Category.findById(req.body.categoryId);
      if (cat) {
        req.body.category = (cat.slug || '').replace(/^\/category\//, '');
        req.body.categoryVi = cat.name;
      }
    } else if (req.body.category) {
      const cleanSlug = String(req.body.category).replace(/^\/category\//, '');
      const cat = await Category.findOne({
        $or: [
          { slug: cleanSlug },
          { slug: `/category/${cleanSlug}` },
          { name: req.body.category },
        ],
      });
      if (cat) {
        req.body.categoryId = cat._id;
        req.body.categoryVi = cat.name;
        req.body.category = cleanSlug;
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

    // Đồng bộ cập nhật bảng ProductImage
    if (product.image) {
      try {
        await ProductImage.findOneAndUpdate(
          { productId: product._id, isPrimary: true },
          {
            $set: {
              productId: product._id,
              imageUrl: product.image,
              caption: product.name,
              isPrimary: true,
            },
          },
          { upsert: true }
        );
      } catch (_) {}
    }

    // Đồng bộ thông tin tên sản phẩm & sku sang StoreInventory
    try {
      await StoreInventory.updateMany(
        { productId: product._id },
        { $set: { productName: product.name, sku: product.slug } }
      );
    } catch (_) {}

    clearCache();
    res.json({ success: true, data: enrichProductOrComboList([product])[0] });
  } catch (err) { next(err); }
});

// DELETE /api/products/:id - admin (soft delete)
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    clearCache();
    res.json({ success: true, message: 'Đã xóa sản phẩm.' });
  } catch (err) { next(err); }
});

module.exports = router;
