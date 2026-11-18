const router = require('express').Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Combo = require('../models/Combo');
const InventoryLog = require('../models/InventoryLog');
const StoreInventory = require('../models/StoreInventory');
const StockAdjustmentTicket = require('../models/StockAdjustmentTicket');
const Supplier = require('../models/Supplier');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { smartOrderRouting } = require('../utils/orderRouter');
const { protect, staffOnly, adminOnly, hasRole, getScopedStoreId } = require('../middleware/auth');
const { cacheMiddleware, clearCache } = require('../utils/cache');

let invProductCache = null;
let invProductCacheExp = 0;

async function getCachedAllProducts() {
  const now = Date.now();
  if (invProductCache && now < invProductCacheExp) {
    return invProductCache;
  }
  const products = await Product.find({ isActive: { $ne: false } }).select(
    '_id name slug price priceNumber costPrice image category categoryVi stock minStock unit isActive updatedAt safetyBuffer reservedStock'
  ).lean();
  invProductCache = products;
  invProductCacheExp = now + 15000; // 15s cache
  return products;
}

function clearInvCache() {
  invProductCache = null;
  invProductCacheExp = 0;
}

// GET /api/inventory/suppliers - Danh sách Nhà cung cấp / Nông trại đối tác
router.get('/suppliers', protect, staffOnly, async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({ success: true, data: suppliers });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/fefo-alerts - Cảnh báo Lô hàng Nông sản cận Date (FEFO - Hết hạn trong 48h)
router.get('/fefo-alerts', protect, staffOnly, async (req, res, next) => {
  try {
    const scopedStore = getScopedStoreId(req);
    const filter = { 'batches.quantity': { $gt: 0 } };
    if (scopedStore && scopedStore !== 'all') {
      filter.storeId = scopedStore;
    }
    const twoDaysAhead = new Date(Date.now() + 48 * 3600 * 1000);

    const inventories = await StoreInventory.find(filter).populate('productId', 'name image category unit priceNumber').lean();
    const alerts = [];

    for (const inv of inventories) {
      for (const b of inv.batches || []) {
        if (b.quantity > 0 && b.expDate && new Date(b.expDate) <= twoDaysAhead) {
          const daysLeft = Math.max(0, Math.ceil((new Date(b.expDate).getTime() - Date.now()) / (24 * 3600 * 1000)));
          alerts.push({
            storeId: inv.storeId,
            storeName: inv.storeName,
            productId: inv.productId?._id,
            productName: inv.productId?.name || inv.productName,
            productImage: inv.productId?.image || '',
            category: inv.productId?.category || '',
            unit: inv.productId?.unit || 'kg',
            batchCode: b.batchCode,
            expDate: b.expDate,
            daysLeft,
            quantity: b.quantity,
            costPrice: b.costPrice,
            isExpired: new Date(b.expDate) < new Date(),
          });
        }
      }
    }

    alerts.sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime());
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) { next(err); }
});

// GET /api/inventory - get inventory products and summary
router.get('/', protect, staffOnly, cacheMiddleware(15), async (req, res, next) => {
  try {
    const { search, category, status, type, page = 1, limit = 100, storeId } = req.query;
    const scopedStore = getScopedStoreId(req) || storeId;
    const isStoreScoped = Boolean(scopedStore && scopedStore !== 'all' && scopedStore !== 'ALL');

    // Load all active products (với in-memory cache 15s chống nghẽn MongoDB Atlas)
    const allProducts = await getCachedAllProducts();

    // Nếu có scopedStore (Store Manager hoặc filter kho), lấy tồn kho cấp chi nhánh từ StoreInventory
    let invMap = new Map();
    if (isStoreScoped) {
      const storeInvs = await StoreInventory.find({ storeId: scopedStore }).lean();
      storeInvs.forEach((inv) => {
        invMap.set(String(inv.productId), inv);
      });
    }

    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockQuantity = 0;

    const mappedProducts = allProducts.map((p) => {
      let stock = p.stock ?? 0;
      let reservedStock = p.reservedStock ?? 0;
      let safetyBuffer = p.safetyBuffer ?? 2;
      let storePrice = p.priceNumber;
      let storeDiscountPrice = null;
      let isClearance = false;

      if (isStoreScoped) {
        const storeInv = invMap.get(String(p._id));
        stock = storeInv ? (storeInv.physicalStock ?? 0) : 0;
        reservedStock = storeInv ? (storeInv.reservedStock ?? 0) : 0;
        safetyBuffer = storeInv?.safetyBuffer ?? (p.safetyBuffer ?? 2);
        storeDiscountPrice = storeInv?.storeDiscountPrice || null;
        isClearance = Boolean(storeDiscountPrice);
        storePrice = isClearance ? storeDiscountPrice : (storeInv?.storePrice || p.priceNumber);
      }

      // Mức tồn kho tối thiểu: Mỗi chi nhánh là 10, Toàn bộ công ty (8 chi nhánh) là 80 (8 x 10)
      const minStock = isStoreScoped
        ? (invMap.get(String(p._id))?.minStockLevel ?? 10)
        : (p.minStock && p.minStock >= 80 ? p.minStock : 80);
      totalStockQuantity += stock;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      } else {
        inStockCount++;
      }

      let pStatus = 'in_stock';
      if (stock <= 0) pStatus = 'out_of_stock';
      else if (stock <= minStock) pStatus = 'low_stock';

      const availableOnline = Math.max(0, stock - reservedStock - safetyBuffer);

      return {
        _id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        priceNumber: p.priceNumber,
        costPrice: (isStoreScoped && invMap.get(String(p._id))?.costPrice) ? invMap.get(String(p._id)).costPrice : (p.costPrice || Math.round((p.priceNumber || 0) * 0.55)),
        storePrice,
        storeDiscountPrice,
        isClearance,
        image: p.image,
        category: p.category,
        categoryVi: p.categoryVi,
        isCombo: Boolean(p.isCombo || (p.name || '').toLowerCase().startsWith('combo')),
        stock,
        minStock,
        reservedStock,
        safetyBuffer,
        availableOnlineStock: availableOnline,
        unit: p.unit || 'kg',
        isActive: p.isActive,
        status: pStatus,
        updatedAt: p.updatedAt,
      };
    });

    const summary = {
      totalProducts: allProducts.length,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      totalStockQuantity,
      scopedStore: isStoreScoped ? scopedStore : 'all',
    };

    // Apply status filter if provided
    let filtered = mappedProducts;
    if (status === 'out_of_stock') {
      filtered = mappedProducts.filter((p) => p.status === 'out_of_stock');
    } else if (status === 'low_stock') {
      filtered = mappedProducts.filter((p) => p.status === 'low_stock');
    } else if (status === 'in_stock') {
      filtered = mappedProducts.filter((p) => p.status === 'in_stock');
    }

    if (type === 'combo') {
      filtered = filtered.filter((p) => p.isCombo || (p.name || '').toLowerCase().startsWith('combo'));
    } else if (type === 'single') {
      filtered = filtered.filter((p) => !p.isCombo && !(p.name || '').toLowerCase().startsWith('combo'));
    }

    if (search || category) {
      const s = search ? search.toLowerCase() : '';
      const c = category ? category.toLowerCase() : '';
      filtered = filtered.filter((p) => {
        const matchSearch =
          !s ||
          p.name.toLowerCase().includes(s) ||
          p.slug.toLowerCase().includes(s) ||
          (p._id && String(p._id).toLowerCase().includes(s));
        const matchCategory =
          !c ||
          (p.category && p.category.toLowerCase().includes(c)) ||
          (p.categoryVi && p.categoryVi.toLowerCase().includes(c));
        return matchSearch && matchCategory;
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const paginated = filtered.slice(skip, skip + Number(limit));

    res.json({
      success: true,
      summary,
      total: filtered.length,
      page: Number(page),
      data: paginated,
      scopedStore: isStoreScoped ? scopedStore : 'all',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/adjust - adjust product stock
router.post('/adjust', protect, hasRole('warehouse', 'manager', 'admin'), async (req, res, next) => {
  try {
    const { productId, delta, newStock, reason = 'Điều chỉnh kho', note = '', storeId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Thiếu productId' });
    }

    const targetStore = (req.user?.role !== 'admin' && req.user?.assignedStore && req.user?.assignedStore !== 'all')
      ? req.user.assignedStore
      : (storeId || req.user?.assignedStore || 'store-thuduc');

    const product = await Product.findById(productId);
    if (!product) {
      const isComboDoc = await Combo.exists({ _id: productId });
      if (isComboDoc) {
        return res.status(400).json({
          success: false,
          message: 'Tồn kho Combo được tính tự động từ tồn kho các sản phẩm thành phần, không chỉnh sửa độc lập.',
        });
      }
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }

    // 1. Cập nhật tồn kho cấp chi nhánh StoreInventory
    let storeInv = await StoreInventory.findOne({ storeId: targetStore, productId });
    if (!storeInv) {
      storeInv = new StoreInventory({
        storeId: targetStore,
        productId,
        sku: product.slug || '',
        productName: product.name,
        physicalStock: 0,
        reservedStock: 0,
        safetyBuffer: product.safetyBuffer ?? 2,
      });
    }

    const oldStoreStock = storeInv.physicalStock ?? 0;
    let targetStoreStock = oldStoreStock;
    let actualDelta = 0;

    if (typeof newStock === 'number') {
      targetStoreStock = Math.max(0, newStock);
      actualDelta = targetStoreStock - oldStoreStock;
    } else if (typeof delta === 'number') {
      actualDelta = delta;
      targetStoreStock = Math.max(0, oldStoreStock + delta);
    } else {
      return res.status(400).json({ success: false, message: 'Cần chỉ định delta hoặc newStock' });
    }

    storeInv.physicalStock = targetStoreStock;
    await storeInv.save();

    // 2. Đồng bộ tổng tồn kho Catalog Product
    product.stock = Math.max(0, (product.stock ?? 0) + actualDelta);
    await product.save();

    // 3. Ghi log kiểm kê gắn đúng chi nhánh
    const log = await InventoryLog.create({
      product: product._id,
      productName: product.name,
      type: actualDelta >= 0 ? 'import' : 'export',
      delta: actualDelta,
      oldStock: oldStoreStock,
      newStock: targetStoreStock,
      storeId: targetStore,
      reason,
      note,
      updatedBy: req.user?._id || null,
    });

    res.json({
      success: true,
      message: `Đã cập nhật tồn kho chi nhánh [${targetStore}] thành công.`,
      data: product,
      storeInventory: storeInv,
      log,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/logs - get stock adjustment history
router.get('/logs', protect, staffOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 100, productId, days, startDate, endDate, storeId, search, type } = req.query;
    const filter = {};
    if (productId && mongoose.Types.ObjectId.isValid(String(productId))) {
      filter.product = String(productId);
    }

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const orClauses = [
        { productName: { $regex: escaped, $options: 'i' } },
        { reason: { $regex: escaped, $options: 'i' } },
        { note: { $regex: escaped, $options: 'i' } },
        { referenceId: { $regex: escaped, $options: 'i' } },
      ];

      // Hỗ trợ tìm kiếm theo mã sản phẩm (6 ký tự cuối _id hoặc SP-xxxxxx)
      const qLower = q.toLowerCase();
      const codeQuery = qLower.replace(/^(sp[-_]?|#)/i, '').trim();
      if (codeQuery.length >= 3) {
        const cachedProducts = await getCachedAllProducts();
        const matchedProdIds = cachedProducts
          .filter((p) => String(p._id).toLowerCase().includes(codeQuery))
          .map((p) => p._id);
        if (matchedProdIds.length > 0) {
          orClauses.push({ product: { $in: matchedProdIds } });
        }
      }

      filter.$or = orClauses;
    }

    const scopedStore = getScopedStoreId(req) || storeId;
    if (scopedStore && scopedStore !== 'all' && scopedStore !== 'ALL') {
      filter.storeId = scopedStore;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = e;
      }
    } else if (days && days !== 'all') {
      const numDays = Number(days);
      if (!isNaN(numDays) && numDays > 0) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - numDays);
        cutoff.setHours(0, 0, 0, 0);
        filter.createdAt = { $gte: cutoff };
      }
    }

    const maxLimit = Math.min(Number(limit) || 100, 500);
    const skip = (Number(page) - 1) * maxLimit;
    // Không dùng .populate('updatedBy') trực tiếp với .lean() vì log kế toán/seed lưu updatedBy dạng chuỗi tên (vd: "Trần Văn Toàn (Thủ kho)") gây CastError.
    const [logs, total] = await Promise.all([
      InventoryLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(maxLimit)
        .lean(),
      InventoryLog.countDocuments(filter),
    ]);

    const isOid24 = (val) => {
      const s = val && typeof val === 'object' && val._id ? String(val._id) : String(val || '');
      return /^[0-9a-fA-F]{24}$/.test(s) && mongoose.Types.ObjectId.isValid(s);
    };

    const prodIdsSet = new Set();
    const prodNamesSet = new Set();
    const userIdsSet = new Set();

    for (const l of logs) {
      if (isOid24(l.product)) {
        prodIdsSet.add(String(l.product));
      }
      if (l.productName) {
        prodNamesSet.add(l.productName);
      }
      if (isOid24(l.updatedBy)) {
        userIdsSet.add(String(l.updatedBy));
      }
    }

    const prodIds = Array.from(prodIdsSet);
    const prodNames = Array.from(prodNamesSet);
    const userIds = Array.from(userIdsSet);

    const prodConds = [];
    if (prodIds.length > 0) prodConds.push({ _id: { $in: prodIds } });
    if (prodNames.length > 0) prodConds.push({ name: { $in: prodNames } });

    const [prods, combos, users] = await Promise.all([
      prodConds.length > 0 ? Product.find({ $or: prodConds }).select('_id name slug image').lean() : [],
      prodConds.length > 0 ? Combo.find({ $or: prodConds }).select('_id name slug image').lean() : [],
      userIds.length > 0 ? User.find({ _id: { $in: userIds } }).select('_id name email').lean() : [],
    ]);

    const prodById = new Map();
    const prodByName = new Map();
    for (const doc of [...prods, ...combos]) {
      if (!doc) continue;
      prodById.set(String(doc._id), doc);
      if (doc.name && !prodByName.has(doc.name)) {
        prodByName.set(doc.name, doc);
      }
    }

    const userById = new Map();
    for (const u of users) {
      if (u) userById.set(String(u._id), u);
    }

    const enrichedLogs = logs.map((l) => {
      const pIdStr = isOid24(l.product) ? String(l.product) : '';
      const prodDoc = (pIdStr && prodById.get(pIdStr)) || prodByName.get(l.productName) || null;
      const resolvedProdId = prodDoc ? String(prodDoc._id) : pIdStr;
      const img = (prodDoc && prodDoc.image) || '';

      let resolvedUpdatedBy = null;
      if (isOid24(l.updatedBy)) {
        resolvedUpdatedBy = userById.get(String(l.updatedBy)) || null;
      } else if (typeof l.updatedBy === 'string' && l.updatedBy.trim()) {
        resolvedUpdatedBy = { name: l.updatedBy.trim() };
      } else if (l.updatedBy && typeof l.updatedBy === 'object' && l.updatedBy.name) {
        resolvedUpdatedBy = l.updatedBy;
      }

      return {
        ...l,
        product: prodDoc
          ? { _id: prodDoc._id, name: prodDoc.name || l.productName, slug: prodDoc.slug, image: prodDoc.image }
          : l.product,
        productCode: resolvedProdId ? resolvedProdId.slice(-6).toUpperCase() : '',
        productImage: img,
        updatedBy: resolvedUpdatedBy,
      };
    });

    res.json({ success: true, total, data: enrichedLogs });
  } catch (err) {
    next(err);
  }
});

// ── 3.4. ĐỒNG BỘ GIAO DỊCH POS THỜI GIAN THỰC (POS EVENT SYNC) ──────────────
// POST /api/inventory/pos-transaction
router.post('/pos-transaction', protect, hasRole('warehouse', 'sales', 'manager', 'admin'), async (req, res, next) => {
  try {
    const { storeId = 'default', receiptCode, items = [] } = req.body;
    if (!receiptCode || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu mã hóa đơn (receiptCode) hoặc danh sách sản phẩm (items)' });
    }

    const processedItems = [];

    for (const item of items) {
      const pId = item.productId || item._id;
      const qty = Number(item.quantity) || 1;
      const sku = item.sku || '';

      if (!pId || qty <= 0) continue;

      // 1. Cập nhật tồn kho cấp cửa hàng StoreInventory (Store-level Ledger)
      let storeInv = await StoreInventory.findOne({ storeId, productId: pId });
      const product = await Product.findById(pId);
      if (!product) continue;

      if (!storeInv) {
        storeInv = new StoreInventory({
          storeId,
          productId: pId,
          sku: sku || product.slug || '',
          physicalStock: Math.max(0, (product.stock || 0) - qty),
          reservedStock: 0,
          safetyBuffer: product.safetyBuffer ?? 2,
        });
        await storeInv.save();
      } else {
        storeInv.physicalStock = Math.max(0, storeInv.physicalStock - qty);
        await storeInv.save();
      }

      // 2. Trừ tồn kho đồng bộ trên Master Catalog Product
      const updatedProduct = await Product.findByIdAndUpdate(
        pId,
        { $inc: { stock: -qty } },
        { new: true }
      );

      // 3. Ghi lịch sử kiểm kê thời gian thực loại 'pos_sale'
      const log = await InventoryLog.create({
        product: pId,
        productName: updatedProduct?.name || product.name,
        type: 'pos_sale',
        delta: -qty,
        oldStock: (updatedProduct?.stock ?? 0) + qty,
        newStock: updatedProduct?.stock ?? 0,
        reason: `POS Bán tại quầy: ${receiptCode}`,
        storeId,
        referenceId: receiptCode,
        updatedBy: req.user?._id || null,
      });

      const availableOnline = Math.max(
        0,
        storeInv.physicalStock - (storeInv.reservedStock || 0) - (storeInv.safetyBuffer || 0)
      );

      processedItems.push({
        productId: pId,
        name: updatedProduct?.name,
        deducted: qty,
        storePhysicalStock: storeInv.physicalStock,
        storeSafetyBuffer: storeInv.safetyBuffer,
        availableOnlineStock: availableOnline,
        isOnlineOutOfStock: availableOnline <= 0,
        masterCatalogStock: updatedProduct?.stock,
        logId: log._id,
      });
    }

    res.json({
      success: true,
      message: `Đã xử lý đồng bộ hóa đơn POS [${receiptCode}] thành công.`,
      receiptCode,
      storeId,
      itemsCount: processedItems.length,
      data: processedItems,
    });
  } catch (err) {
    next(err);
  }
});

// ── 3.3. QUẢN LÝ TỒN KHO CẤP CỬA HÀNG (STORE-LEVEL INVENTORIES) ───────────────
// GET /api/inventory/store-inventories
router.get('/store-inventories', protect, staffOnly, async (req, res, next) => {
  try {
    const { storeId, page = 1, limit = 50, search } = req.query;
    const filter = {};
    if (storeId) filter.storeId = storeId;

    const skip = (Number(page) - 1) * Number(limit);

    const [inventories, total] = await Promise.all([
      StoreInventory.find(filter)
        .populate('productId', 'name slug price priceNumber image category unit')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean({ virtuals: true }),
      StoreInventory.countDocuments(filter),
    ]);

    // Bổ sung tính toán availableOnlineStock
    const enriched = inventories.map((inv) => {
      const physical = inv.physicalStock ?? 0;
      const reserved = inv.reservedStock ?? 0;
      const buffer = inv.safetyBuffer ?? 2;
      return {
        ...inv,
        availableOnlineStock: Math.max(0, physical - reserved - buffer),
        isOnlineAvailable: physical - reserved - buffer > 0,
      };
    });

    res.json({
      success: true,
      total,
      page: Number(page),
      data: enriched,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/store-inventories/:id - Cập nhật ngưỡng an toàn hoặc tồn kho cửa hàng
router.put('/store-inventories/:id', protect, hasRole('warehouse', 'manager', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { physicalStock, safetyBuffer, storePrice, reservedStock, batches } = req.body;

    const storeInv = await StoreInventory.findById(id);
    if (!storeInv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi tồn kho cửa hàng' });
    }

    if (typeof physicalStock === 'number') storeInv.physicalStock = Math.max(0, physicalStock);
    if (typeof safetyBuffer === 'number') storeInv.safetyBuffer = Math.max(0, safetyBuffer);
    if (typeof storePrice === 'number' || storePrice === null) storeInv.storePrice = storePrice;
    if (typeof reservedStock === 'number') storeInv.reservedStock = Math.max(0, reservedStock);
    if (Array.isArray(batches)) storeInv.batches = batches;

    await storeInv.save();

    res.json({
      success: true,
      message: 'Cập nhật thông số tồn kho chi nhánh thành công',
      data: storeInv,
    });
  } catch (err) {
    next(err);
  }
});

// ── 3.2. ĐỊNH TUYẾN ĐƠN HÀNG THÔNG MINH (SMART ORDER ROUTING) ──────────────────
// POST /api/inventory/smart-order-route
router.post('/smart-order-route', protect, staffOnly, async (req, res, next) => {
  try {
    const { items = [], customerLocation = {}, options = {} } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cần danh sách sản phẩm (items) để tính toán định tuyến' });
    }

    const routingResult = await smartOrderRouting(items, customerLocation, options);

    res.json({
      success: true,
      message: 'Tính toán định tuyến đơn hàng thông minh thành công',
      ...routingResult,
    });
  } catch (err) {
    next(err);
  }
});


// ── PHÂN QUYỀN KHÓA THEO CHI NHÁNH (STOREID LOCK) ─────────────────────────────
function checkStoreAccess(user, targetStoreId) {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  // Admin, Quản lý kho (Warehouse) và Quản lý (Manager) có quyền trên toàn bộ các kho
  if (['admin', 'warehouse', 'manager'].includes(role)) return true;
  if (!user.assignedStore || user.assignedStore === 'all' || user.assignedStore === 'default') {
    return true;
  }
  if (user.assignedStore && user.assignedStore !== targetStoreId) {
    return false;
  }
  return true;
}

// ── 2. PHÂN CÔNG NHÂN SỰ CẬP NHẬT THỦ CÔNG TẠI TỪNG CỬA HÀNG ──────────────────
// POST /api/inventory/adjustment-tickets
// Nghiệp vụ: Goods Receipt (Nhập kho), Spoilage Write-off (Hủy hỏng), Cycle Count (Kiểm kê), BORIS (Đổi trả)
// Quyền: Nhân viên Kho (Warehouse) hoặc Quản lý (Manager/Admin). Sales và Marketing hoàn toàn bị chặn!
router.post('/adjustment-tickets', protect, hasRole('warehouse', 'manager', 'admin'), async (req, res, next) => {
  try {
    const {
      storeId = 'default',
      storeName = 'Kho Nông Sản Evergreen Mart',
      targetStoreId = '',
      targetStoreName = '',
      supplierId = null,
      supplierName = '',
      type, // 'goods_receipt' | 'spoilage_writeoff' | 'cycle_count' | 'boris_return' | 'store_transfer'
      items = [],
      note = '',
      evidenceImages = [],
    } = req.body;

    const validTypes = ['goods_receipt', 'spoilage_writeoff', 'cycle_count', 'boris_return', 'store_transfer'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Loại phiếu điều chỉnh không hợp lệ' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách sản phẩm điều chỉnh không được để trống' });
    }

    // Kiểm tra phân quyền khóa theo chi nhánh
    if (type === 'store_transfer') {
      const hasSourceAccess = checkStoreAccess(req.user, storeId);
      const hasTargetAccess = checkStoreAccess(req.user, targetStoreId);
      if (!hasSourceAccess && !hasTargetAccess) {
        return res.status(403).json({
          success: false,
          message: `Bạn chỉ có quyền tạo phiếu điều chuyển liên quan đến chi nhánh được giao [${req.user.assignedStore}].`,
        });
      }
    } else {
      if (!checkStoreAccess(req.user, storeId)) {
        return res.status(403).json({
          success: false,
          message: `Bạn chỉ có quyền thao tác trong phạm vi chi nhánh được giao [${req.user.assignedStore}]. Không thể tác động kho [${storeId}].`,
        });
      }
    }

    if (type === 'store_transfer') {
      if (!targetStoreId || targetStoreId === storeId) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn chi nhánh nhận hàng khác với chi nhánh xuất' });
      }
    }

    let totalLossValue = 0;
    let maxShortage = 0;
    const processedItems = [];

    for (const item of items) {
      const pId = item.productId || item._id;
      const rawQty = Number(item.quantityDelta ?? item.quantity) || 0;
      if (!pId || rawQty === 0) continue;

      const product = await Product.findById(pId).select('name slug priceNumber stock safetyBuffer costPrice');
      if (!product) continue;

      // Nếu là store_transfer: quantityDelta là số âm đối với kho xuất
      const qtyDelta = type === 'store_transfer' ? -Math.abs(rawQty) : rawQty;
      const unitPrice = Number(item.unitPrice || product.costPrice || Math.round((product.priceNumber || 0) * 0.55));

      if (type === 'store_transfer') {
        const storeInv = await StoreInventory.findOne({ storeId, productId: pId });
        let avail = 0;
        if (storeInv) {
          avail = storeInv.physicalStock - (storeInv.reservedStock || 0);
        } else if (storeId === 'store-thuduc' || storeId === 'default') {
          avail = product.stock || 0;
        }
        if (avail < Math.abs(qtyDelta)) {
          return res.status(400).json({
            success: false,
            message: `Sản phẩm [${product.name}] tại kho xuất chỉ còn ${avail} sp khả dụng, không đủ để chuyển ${Math.abs(qtyDelta)} sp`,
          });
        }
      }

      let lossValue = 0;
      if (qtyDelta < 0 && type !== 'store_transfer') {
        const shortage = Math.abs(qtyDelta);
        if (shortage > maxShortage) maxShortage = shortage;
        lossValue = shortage * unitPrice;
        totalLossValue += lossValue;
      }

      processedItems.push({
        productId: pId,
        productName: product.name,
        sku: item.sku || product.slug || '',
        quantityDelta: qtyDelta,
        unitPrice,
        lossValue,
        batchCode: item.batchCode || '',
        expDate: item.expDate ? new Date(item.expDate) : null,
        reason: item.reason || note || '',
      });
    }

    if (processedItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có mặt hàng nào hợp lệ để tạo phiếu' });
    }

    let totalAmount = 0;
    if (type === 'goods_receipt' || type === 'store_transfer') {
      totalAmount = processedItems.reduce((sum, it) => sum + (Math.abs(it.quantityDelta) * it.unitPrice), 0);
    }

    // Ngưỡng kiểm soát gian lận chéo: Hụt > 3 sản phẩm HOẶC giá trị hụt > 500.000đ
    const userRole = (req.user?.role || '').toLowerCase();
    const exceedsThreshold = maxShortage > 3 || totalLossValue > 500000;
    const isDirectManager = userRole === 'admin' || userRole === 'manager';

    const requiresApproval = (type === 'spoilage_writeoff' || type === 'cycle_count') && exceedsThreshold && !isDirectManager;
    let ticketStatus = requiresApproval ? 'pending_approval' : 'approved';
    if (type === 'store_transfer') {
      ticketStatus = 'in_transit';
    }

    const ticketCode = `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const ticket = new StockAdjustmentTicket({
      ticketCode,
      storeId,
      storeName,
      targetStoreId: targetStoreId || '',
      targetStoreName: targetStoreName || '',
      supplierId: supplierId || null,
      supplierName: supplierName || '',
      type,
      items: processedItems,
      totalAmount,
      paidAmount: 0,
      paymentStatus: 'unpaid',
      totalLossValue,
      maxShortageQuantity: maxShortage,
      requiresApproval,
      status: ticketStatus,
      createdBy: req.user._id,
      creatorName: req.user.name || 'Nhân viên kho',
      creatorRole: req.user.role || 'warehouse',
      note,
      evidenceImages,
      approvedBy: !requiresApproval && type !== 'store_transfer' ? req.user._id : null,
      approverName: !requiresApproval && type !== 'store_transfer' ? (req.user.name || 'Hệ thống tự động') : '',
      approvedAt: !requiresApproval && type !== 'store_transfer' ? new Date() : null,
    });

    await ticket.save();
    clearCache('adjustment-tickets');
    clearCache('inventory');

    // ── XỬ LÝ ĐIỀU CHUYỂN LIÊN KHO (STORE TRANSFER) ──
    if (type === 'store_transfer') {
      for (const item of processedItems) {
        const qty = Math.abs(item.quantityDelta);
        let storeInv = await StoreInventory.findOne({ storeId, productId: item.productId });
        if (storeInv) {
          storeInv.physicalStock = Math.max(0, storeInv.physicalStock - qty);
          await storeInv.save();
        }
        await InventoryLog.create({
          product: item.productId,
          productName: item.productName,
          type: 'export',
          delta: -qty,
          oldStock: (storeInv ? storeInv.physicalStock + qty : 0),
          newStock: (storeInv ? storeInv.physicalStock : 0),
          storeId: storeId,
          referenceId: ticketCode,
          reason: `Xuất điều chuyển sang [${targetStoreName}] theo phiếu [${ticketCode}]: ${note || 'Điều chuyển hàng liên kho'}`,
          updatedBy: req.user._id,
        });
      }

      Notification.create({
        recipientRole: 'warehouse',
        title: 'Điều chuyển hàng hóa liên kho',
        body: `Phiếu #${ticketCode}: Đang chuyển ${processedItems.length} mặt hàng từ [${storeName}] sang [${targetStoreName}].`,
        type: 'inventory',
        path: '/admin/inventory',
      }).catch(err => console.error('Notification error:', err));

      return res.json({
        success: true,
        message: `Đã xuất kho và chuyển phiếu sang trạng thái [Đang vận chuyển] tới [${targetStoreName}].`,
        status: 'in_transit',
        ticket,
      });
    }

    // Nếu không cần duyệt (hoặc người tạo là Cửa hàng trưởng / Admin) -> Cập nhật tồn kho ngay
    if (!requiresApproval) {
      await applyTicketInventoryChanges(ticket, req.user._id);

      if (type === 'goods_receipt') {
        Notification.create({
          recipientRole: 'warehouse',
          title: 'Nhập kho hàng mới thành công',
          body: `Phiếu #${ticketCode}: Đã nhập ${processedItems.length} mặt hàng từ [${supplierName || 'Nhà Cung Cấp'}] vào [${storeName}]. Tổng tiền: ${totalAmount.toLocaleString('vi-VN')}₫.`,
          type: 'inventory',
          path: '/admin/inventory',
        }).catch(err => console.error('Notification error:', err));
      } else if (type === 'spoilage_writeoff') {
        Notification.create({
          recipientRole: 'admin',
          title: 'Xuất hủy nông sản hư hỏng',
          body: `Phiếu #${ticketCode}: Đã xuất hủy ${processedItems.length} mặt hàng tại [${storeName}]. Thiệt hại: ${totalLossValue.toLocaleString('vi-VN')}₫.`,
          type: 'inventory',
          path: '/admin/inventory',
        }).catch(err => console.error('Notification error:', err));
      } else if (type === 'cycle_count') {
        Notification.create({
          recipientRole: 'admin',
          title: 'Kiểm kê định kỳ chi nhánh',
          body: `Phiếu #${ticketCode}: Đã hoàn tất đối soát kiểm kê tại [${storeName}].`,
          type: 'inventory',
          path: '/admin/inventory',
        }).catch(err => console.error('Notification error:', err));
      }

      return res.json({
        success: true,
        message: 'Tạo phiếu và cập nhật tồn kho chi nhánh thành công.',
        status: 'approved',
        ticket,
      });
    }

    // Nếu vượt ngưỡng -> Treo ở trạng thái Chờ duyệt
    Notification.create({
      recipientRole: 'manager',
      title: 'Cần duyệt phiếu kiểm kê / hao hụt',
      body: `Phiếu #${ticketCode} tại [${storeName}] vượt ngưỡng cho phép (Hụt ${maxShortage} sp / Thiệt hại ${totalLossValue.toLocaleString('vi-VN')}₫) đang chờ Cửa hàng trưởng duyệt.`,
      type: 'inventory',
      path: '/admin/inventory',
    }).catch(err => console.error('Notification error:', err));

    res.json({
      success: true,
      message: `Phiếu kiểm kê hụt vượt ngưỡng cho phép (Hụt ${maxShortage} sp / Giá trị ${totalLossValue.toLocaleString('vi-VN')}đ). Hệ thống đã treo phiếu ở trạng thái [Chờ Cửa hàng trưởng phê duyệt] để ngăn chặn gian lận.`,
      status: 'pending_approval',
      ticket,
    });
  } catch (err) {
    next(err);
  }
});

// Hàm hỗ trợ áp dụng biến động kho vật lý khi phiếu được duyệt
async function applyTicketInventoryChanges(ticket, actorId) {
  for (const item of ticket.items) {
    const { productId, quantityDelta, batchCode, expDate } = item;

    let storeInv = await StoreInventory.findOne({ storeId: ticket.storeId, productId });
    if (!storeInv) {
      const prod = await Product.findById(productId);
      storeInv = new StoreInventory({
        storeId: ticket.storeId,
        storeName: ticket.storeName,
        productId,
        sku: item.sku,
        physicalStock: Math.max(0, (prod?.stock || 0) + quantityDelta),
        safetyBuffer: prod?.safetyBuffer ?? 2,
        reservedStock: 0,
        damagedStock: 0,
      });
    }

    const oldPhysical = storeInv.physicalStock;

    if (ticket.type === 'goods_receipt') {
      // 1. Nhập hàng: Cộng vào physicalStock và cập nhật giá vốn đầu vào (costPrice)
      storeInv.physicalStock += Math.abs(quantityDelta);
      if (item.unitPrice && item.unitPrice > 0) {
        storeInv.costPrice = item.unitPrice;
      }
      if (batchCode && expDate) {
        storeInv.batches.push({
          batchCode,
          expDate,
          quantity: Math.abs(quantityDelta),
          receivedDate: new Date(),
          costPrice: item.unitPrice || 0,
        });
      }
    } else if (ticket.type === 'spoilage_writeoff') {
      // 2. Xuất hủy hàng dập nát, hỏng, hết hạn: Trừ physicalStock, cộng damagedStock
      const writeOffQty = Math.abs(quantityDelta);
      storeInv.physicalStock = Math.max(0, storeInv.physicalStock - writeOffQty);
      storeInv.damagedStock = (storeInv.damagedStock || 0) + writeOffQty;
    } else if (ticket.type === 'cycle_count') {
      // 3. Kiểm kê định kỳ: Điều chỉnh theo quantityDelta (+ hoặc -)
      storeInv.physicalStock = Math.max(0, storeInv.physicalStock + quantityDelta);
    } else if (ticket.type === 'boris_return') {
      // 4. Xử lý hàng đổi trả tại quầy (BORIS): Tái nhập vào physicalStock
      storeInv.physicalStock += Math.abs(quantityDelta);
    }

    await storeInv.save();

    // Đồng bộ tồn kho và giá vốn Master Product
    const prodUpdate = {
      $inc: {
        stock: ticket.type === 'spoilage_writeoff' ? -Math.abs(quantityDelta) : quantityDelta,
      },
    };
    if (ticket.type === 'goods_receipt' && item.unitPrice && item.unitPrice > 0) {
      prodUpdate.$set = { costPrice: item.unitPrice };
    }
    await Product.findByIdAndUpdate(productId, prodUpdate);

    // Ghi Log kiểm kê
    await InventoryLog.create({
      product: productId,
      productName: item.productName,
      type: quantityDelta >= 0 ? 'import' : 'export',
      delta: quantityDelta,
      oldStock: oldPhysical,
      newStock: storeInv.physicalStock,
      reason: `Phiếu ${ticket.type} [${ticket.ticketCode}]: ${item.reason || ticket.note}`,
      storeId: ticket.storeId,
      referenceId: ticket.ticketCode,
      updatedBy: actorId,
    });
  }
}

// GET /api/inventory/adjustment-tickets - Danh sách phiếu kiểm kê / điều chỉnh
// Tối ưu hóa siêu tốc: loại bỏ mảng items 437 phần tử khỏi danh sách bảng (giảm 99% dung lượng từ 1.2MB xuống 15KB) + Cache 10s
router.get('/adjustment-tickets', protect, staffOnly, cacheMiddleware(10), async (req, res, next) => {
  try {
    const { storeId, status, type, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    // Khóa chi nhánh: Cửa hàng trưởng (manager) chỉ xem các phiếu phát sinh tại chi nhánh mình hoặc được điều chuyển đến chi nhánh mình. Admin và Thủ kho (warehouse) có thẩm quyền toàn hệ thống hoặc xem theo bộ lọc query.
    const userRole = (req.user?.role || '').toLowerCase();
    const effectiveStore = (userRole === 'manager' && req.user.assignedStore && req.user.assignedStore !== 'all')
      ? req.user.assignedStore
      : storeId;

    if (effectiveStore && effectiveStore !== 'all') {
      filter.$or = [
        { storeId: effectiveStore },
        { targetStoreId: effectiveStore },
      ];
    }

    if (status && status !== 'all') filter.status = status;
    if (type && type !== 'all') filter.type = type;
    if (search && search.trim()) {
      filter.ticketCode = new RegExp(search.trim(), 'i');
    }

    const skip = (Number(page) - 1) * Number(limit);

    const baseStoreFilter = {};
    if (effectiveStore && effectiveStore !== 'all') {
      baseStoreFilter.$or = [
        { storeId: effectiveStore },
        { targetStoreId: effectiveStore },
      ];
    }

    const [rawTickets, total, summaryAgg] = await Promise.all([
      StockAdjustmentTicket.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: Number(limit) },
        {
          $project: {
            ticketCode: 1,
            storeId: 1,
            storeName: 1,
            targetStoreId: 1,
            targetStoreName: 1,
            supplierId: 1,
            supplierName: 1,
            type: 1,
            totalAmount: 1,
            paidAmount: 1,
            paymentStatus: 1,
            totalLossValue: 1,
            maxShortageQuantity: 1,
            requiresApproval: 1,
            status: 1,
            createdBy: 1,
            creatorName: 1,
            creatorRole: 1,
            approvedBy: 1,
            approverName: 1,
            approvedAt: 1,
            rejectedReason: 1,
            note: 1,
            evidenceImages: 1,
            createdAt: 1,
            updatedAt: 1,
            itemsCount: { $size: { $ifNull: ['$items', []] } },
          },
        },
      ]),
      StockAdjustmentTicket.countDocuments(filter),
      StockAdjustmentTicket.aggregate([
        { $match: baseStoreFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending_approval'] }, 1, 0] } },
            inTransit: { $sum: { $cond: [{ $eq: ['$status', 'in_transit'] }, 1, 0] } },
            completed: {
              $sum: { $cond: [{ $in: ['$status', ['completed', 'approved']] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    // Populate createdBy and approvedBy cho aggregation
    const userIds = [
      ...new Set([
        ...rawTickets.map((t) => t.createdBy).filter(Boolean),
        ...rawTickets.map((t) => t.approvedBy).filter(Boolean),
      ]),
    ];
    const User = require('../models/User');
    const users = await User.find({ _id: { $in: userIds } }).select('name email role avatar').lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const tickets = rawTickets.map((t) => {
      const count = t.itemsCount || 0;
      return {
        ...t,
        createdBy: t.createdBy ? userMap.get(String(t.createdBy)) || t.createdBy : null,
        approvedBy: t.approvedBy ? userMap.get(String(t.approvedBy)) || t.approvedBy : null,
        // Cung cấp mảng giả lập có độ dài itemsCount để t.items.length trong template Angular hoạt động chính xác
        items: new Array(count).fill({}),
      };
    });

    const summary = summaryAgg && summaryAgg[0]
      ? {
          total: summaryAgg[0].total || 0,
          pending: summaryAgg[0].pending || 0,
          inTransit: summaryAgg[0].inTransit || 0,
          completed: summaryAgg[0].completed || 0,
        }
      : { total, pending: 0, inTransit: 0, completed: 0 };

    res.json({
      success: true,
      total,
      page: Number(page),
      summary,
      data: tickets,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/adjustment-tickets/:id - Chi tiết 1 phiếu kho đầy đủ danh sách mặt hàng
router.get('/adjustment-tickets/:id', protect, staffOnly, async (req, res, next) => {
  try {
    const ticket = await StockAdjustmentTicket.findById(req.params.id)
      .populate('createdBy', 'name email role avatar')
      .populate('approvedBy', 'name email role avatar')
      .populate('supplierId', 'name code phone contactPerson')
      .lean();
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu kho' });
    }
    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/adjustment-tickets/:id/approve
// Quyền: CHỈ Cửa hàng trưởng (Manager) hoặc Quản trị viên (Admin) mới có quyền duyệt!
router.put('/adjustment-tickets/:id/approve', protect, hasRole('manager', 'admin'), async (req, res, next) => {
  try {
    const ticket = await StockAdjustmentTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu điều chỉnh' });
    }

    if (ticket.status !== 'pending_approval') {
      return res.status(400).json({ success: false, message: `Phiếu này đang ở trạng thái [${ticket.status}], không thể duyệt lại` });
    }

    if (!checkStoreAccess(req.user, ticket.storeId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền duyệt phiếu của chi nhánh này' });
    }

    // Áp dụng biến động tồn kho sau khi Quản lý bấm Duyệt
    await applyTicketInventoryChanges(ticket, req.user._id);

    ticket.status = 'approved';
    ticket.approvedBy = req.user._id;
    ticket.approverName = req.user.name || 'Cửa hàng trưởng';
    ticket.approvedAt = new Date();
    await ticket.save();
    clearCache('adjustment-tickets');
    clearCache('inventory');

    Notification.create({
      recipientRole: 'warehouse',
      title: `Phiếu kho #${ticket.ticketCode} đã được phê duyệt`,
      body: `${req.user.name || 'Cửa hàng trưởng'} đã phê duyệt phiếu tại [${ticket.storeName}]. Tồn kho thực tế đã cập nhật.`,
      type: 'inventory',
      path: '/admin/inventory',
    }).catch(err => console.error('Notification error:', err));

    res.json({
      success: true,
      message: `Cửa hàng trưởng đã phê duyệt phiếu [${ticket.ticketCode}]. Tồn kho thực tế đã được cập nhật chính thức.`,
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/adjustment-tickets/:id/reject
// Quyền: CHỈ Cửa hàng trưởng (Manager) hoặc Quản trị viên (Admin)
router.put('/adjustment-tickets/:id/reject', protect, hasRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { reason = 'Số liệu không khớp, yêu cầu kiểm đếm lại' } = req.body;
    const ticket = await StockAdjustmentTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu điều chỉnh' });
    }

    if (ticket.status !== 'pending_approval') {
      return res.status(400).json({ success: false, message: `Phiếu này đang ở trạng thái [${ticket.status}], không thể từ chối` });
    }

    if (!checkStoreAccess(req.user, ticket.storeId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền từ chối phiếu của chi nhánh này' });
    }

    ticket.status = 'rejected';
    ticket.rejectedReason = reason;
    ticket.approvedBy = req.user._id;
    ticket.approverName = req.user.name || 'Cửa hàng trưởng';
    ticket.approvedAt = new Date();
    await ticket.save();
    clearCache('adjustment-tickets');
    clearCache('inventory');

    Notification.create({
      recipientRole: 'warehouse',
      title: `Phiếu kho #${ticket.ticketCode} bị từ chối`,
      body: `Cửa hàng trưởng đã từ chối phiếu tại [${ticket.storeName}]. Lý do: ${reason}.`,
      type: 'inventory',
      path: '/admin/inventory',
    }).catch(err => console.error('Notification error:', err));

    res.json({
      success: true,
      message: `Đã từ chối phiếu điều chỉnh [${ticket.ticketCode}]. Tồn kho được giữ nguyên không thay đổi.`,
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/adjustment-tickets/:id/receive-transfer - Xác nhận đã nhận hàng điều chuyển kho
router.put('/adjustment-tickets/:id/receive-transfer', protect, hasRole('warehouse', 'manager', 'admin'), async (req, res, next) => {
  try {
    const ticket = await StockAdjustmentTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu điều chuyển' });
    if (ticket.type !== 'store_transfer') return res.status(400).json({ success: false, message: 'Phiếu này không phải là phiếu điều chuyển kho' });
    if (ticket.status !== 'in_transit') return res.status(400).json({ success: false, message: `Phiếu đang ở trạng thái [${ticket.status}], không thể nhận hàng` });

    if (!checkStoreAccess(req.user, ticket.targetStoreId)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền xác nhận nhận hàng cho chi nhánh đích [${ticket.targetStoreId}]`,
      });
    }

    // Tăng tồn kho tại targetStoreId
    for (const item of ticket.items) {
      const qty = Math.abs(item.quantityDelta);
      let targetInv = await StoreInventory.findOne({ storeId: ticket.targetStoreId, productId: item.productId });
      if (!targetInv) {
        const prod = await Product.findById(item.productId);
        targetInv = new StoreInventory({
          storeId: ticket.targetStoreId,
          storeName: ticket.targetStoreName,
          productId: item.productId,
          sku: item.sku,
          physicalStock: qty,
          safetyBuffer: prod?.safetyBuffer ?? 2,
          reservedStock: 0,
          damagedStock: 0,
        });
      } else {
        targetInv.physicalStock += qty;
      }
      if (item.unitPrice && item.unitPrice > 0) {
        targetInv.costPrice = item.unitPrice;
      }
      if (item.batchCode && item.expDate) {
        targetInv.batches.push({
          batchCode: item.batchCode,
          expDate: item.expDate,
          quantity: qty,
          receivedDate: new Date(),
          costPrice: item.unitPrice || 0,
        });
      }
      await targetInv.save();

      await InventoryLog.create({
        product: item.productId,
        productName: item.productName,
        type: 'import',
        delta: qty,
        oldStock: targetInv.physicalStock - qty,
        newStock: targetInv.physicalStock,
        storeId: ticket.targetStoreId,
        referenceId: ticket.ticketCode,
        reason: `Nhập nhận hàng điều chuyển từ [${ticket.storeName}] theo phiếu [${ticket.ticketCode}]`,
        updatedBy: req.user._id,
      });
    }

    ticket.status = 'completed';
    ticket.approvedBy = req.user._id;
    ticket.approverName = req.user.name || 'Nhân viên nhận kho';
    ticket.approvedAt = new Date();
    await ticket.save();
    clearCache('adjustment-tickets');
    clearCache('inventory');

    Notification.create({
      recipientRole: 'warehouse',
      title: 'Đã nhận đủ hàng điều chuyển liên kho',
      body: `Chi nhánh [${ticket.targetStoreName || 'Kho đích'}] đã kiểm đếm và nhận đủ ${ticket.items.length} mặt hàng từ [${ticket.storeName}] (Phiếu #${ticket.ticketCode}).`,
      type: 'inventory',
      path: '/admin/inventory',
    }).catch(err => console.error('Notification error:', err));

    res.json({
      success: true,
      message: `Đã hoàn tất kiểm đếm và nhận hàng điều chuyển vào kho [${ticket.targetStoreName}]`,
      ticket,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/supplier-debts - Báo cáo công nợ nhà cung cấp / nông trại
router.get('/supplier-debts', protect, staffOnly, async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({ isActive: true }).lean();
    const grnTickets = await StockAdjustmentTicket.find({
      type: 'goods_receipt',
      supplierId: { $ne: null },
    }).lean();

    const data = suppliers.map((sup) => {
      const tickets = grnTickets.filter(t => String(t.supplierId) === String(sup._id));
      const totalInboundOrders = tickets.length;
      const totalAmount = tickets.reduce((s, t) => s + (t.totalAmount || 0), 0);
      const paidAmount = tickets.reduce((s, t) => s + (t.paidAmount || 0), 0);
      const remainingDebt = Math.max(0, totalAmount - paidAmount);
      return {
        ...sup,
        totalInboundOrders,
        totalAmount,
        paidAmount,
        remainingDebt,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/supplier-payments - Ghi nhận thanh toán tiền hàng cho Nhà cung cấp
// Quyền: CHỈ Quản trị viên (Admin) / Kế toán tài chính mới có quyền chi trả. Nhân viên kho hoàn toàn bị chặn!
router.post('/supplier-payments', protect, adminOnly, async (req, res, next) => {
  try {
    const { supplierId, ticketId, amount = 0 } = req.body;
    if (ticketId) {
      const ticket = await StockAdjustmentTicket.findById(ticketId);
      if (!ticket) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập kho' });
      ticket.paidAmount = (ticket.paidAmount || 0) + Number(amount);
      if (ticket.paidAmount >= ticket.totalAmount) {
        ticket.paymentStatus = 'paid';
      } else if (ticket.paidAmount > 0) {
        ticket.paymentStatus = 'partial';
      }
      await ticket.save();
    clearCache('adjustment-tickets');
    clearCache('inventory');
      return res.json({ success: true, message: 'Ghi nhận thanh toán phiếu nhập kho thành công', ticket });
    }

    if (supplierId) {
      let remain = Number(amount);
      const unpaidTickets = await StockAdjustmentTicket.find({
        supplierId,
        paymentStatus: { $in: ['unpaid', 'partial'] },
      }).sort({ createdAt: 1 });

      for (const t of unpaidTickets) {
        if (remain <= 0) break;
        const debt = (t.totalAmount || 0) - (t.paidAmount || 0);
        const payThis = Math.min(debt, remain);
        t.paidAmount = (t.paidAmount || 0) + payThis;
        if (t.paidAmount >= (t.totalAmount || 0)) {
          t.paymentStatus = 'paid';
        } else {
          t.paymentStatus = 'partial';
        }
        remain -= payThis;
        await t.save();
      }
      const supObj = await Supplier.findById(supplierId).lean();
      Notification.create({
        recipientRole: 'admin',
        title: 'Thanh toán tiền hàng Nhà Cung Cấp',
        body: `Đã chi trả ${Number(amount).toLocaleString('vi-VN')}₫ cho [${supObj ? supObj.name : 'Nhà cung cấp'}]. ${note ? 'Ghi chú: ' + note : ''}`,
        type: 'inventory',
        path: '/admin/inventory',
      }).catch(err => console.error('Notification error:', err));

      return res.json({ success: true, message: `Đã đối soát và ghi nhận thanh toán ${Number(amount).toLocaleString('vi-VN')}đ cho Nhà cung cấp` });
    }

    res.status(400).json({ success: false, message: 'Thiếu thông tin nhà cung cấp hoặc phiếu' });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/store-config - Lấy thông tin cấu hình kho riêng (vùng đệm, giá xả hàng, tồn chi nhánh)
router.get('/store-config', protect, staffOnly, async (req, res, next) => {
  try {
    const { storeId = 'store-thuduc', productId } = req.query;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Thiếu productId cần lấy thông tin' });
    }
    let storeInv = await StoreInventory.findOne({ storeId, productId }).lean();
    if (!storeInv) {
      const prod = await Product.findById(productId).lean();
      storeInv = {
        storeId,
        productId,
        physicalStock: 0,
        reservedStock: 0,
        safetyBuffer: prod?.safetyBuffer ?? 2,
        storeDiscountPrice: null,
        storePrice: prod?.priceNumber || 0,
      };
    }
    res.json({ success: true, data: storeInv });
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/store-config - Cấu hình vùng đệm an toàn & giá xả hàng cuối ngày riêng của chi nhánh
// Quyền: CHỈ Cửa hàng trưởng (Manager) hoặc Admin. Sales & Marketing hoàn toàn bị chặn!
router.put('/store-config', protect, hasRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { storeId = 'default', productId, safetyBuffer, storeDiscountPrice, storePrice } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Thiếu productId cần cấu hình' });
    }

    if (!checkStoreAccess(req.user, storeId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cấu hình cho chi nhánh này' });
    }

    let storeInv = await StoreInventory.findOne({ storeId, productId });
    if (!storeInv) {
      const prod = await Product.findById(productId);
      storeInv = new StoreInventory({
        storeId,
        productId,
        sku: prod?.slug || '',
        physicalStock: prod?.stock || 0,
        safetyBuffer: typeof safetyBuffer === 'number' ? safetyBuffer : (prod?.safetyBuffer ?? 2),
        storeDiscountPrice: typeof storeDiscountPrice === 'number' ? storeDiscountPrice : null,
        storePrice: typeof storePrice === 'number' ? storePrice : null,
      });
    } else {
      if (typeof safetyBuffer === 'number') storeInv.safetyBuffer = Math.max(0, safetyBuffer);
      if (typeof storeDiscountPrice === 'number' || storeDiscountPrice === null) storeInv.storeDiscountPrice = storeDiscountPrice;
      if (typeof storePrice === 'number' || storePrice === null) storeInv.storePrice = storePrice;
    }

    await storeInv.save();

    res.json({
      success: true,
      message: 'Cửa hàng trưởng đã cập nhật thông số vùng đệm an toàn & giá xả hàng chi nhánh thành công.',
      data: storeInv,
    });
  } catch (err) {
    next(err);
  }
});

const { triggerEndOfDayClearance, resetClearancePrices } = require('../utils/clearanceScheduler');

// POST /api/inventory/trigger-clearance - Kích hoạt thủ công tiến trình xả hàng cuối ngày
router.post('/trigger-clearance', protect, hasRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { discountPercent = 0.3, storeId } = req.body;
    const targetStore = req.user.assignedStore || storeId;
    const result = await triggerEndOfDayClearance(Number(discountPercent) || 0.3, targetStore);
    res.json({
      success: true,
      message: `Đã kích hoạt xả hàng cuối ngày cho ${result.updatedCount} mặt hàng tươi sống.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/reset-clearance - Hoàn nguyên giá gốc (kết thúc đợt xả hàng)
router.post('/reset-clearance', protect, hasRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { storeId } = req.body;
    const targetStore = req.user.assignedStore || storeId;
    const result = await resetClearancePrices(targetStore);
    res.json({
      success: true,
      message: `Đã hoàn nguyên giá chuẩn cho ${result.resetCount} mặt hàng.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/clearance-status - Xem thống kê các mặt hàng đang xả kho
router.get('/clearance-status', protect, staffOnly, async (req, res, next) => {
  try {
    const { storeId } = req.query;
    const filter = { storeDiscountPrice: { $ne: null } };
    if (storeId && storeId !== 'all') filter.storeId = storeId;
    const count = await StoreInventory.countDocuments(filter);
    const sampleItems = await StoreInventory.find(filter).limit(10).lean();
    res.json({
      success: true,
      totalClearanceItems: count,
      data: sampleItems,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

