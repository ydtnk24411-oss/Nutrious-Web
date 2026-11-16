const router = require('express').Router();
const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');
const StoreInventory = require('../models/StoreInventory');
const StockAdjustmentTicket = require('../models/StockAdjustmentTicket');
const { smartOrderRouting } = require('../utils/orderRouter');
const { protect, staffOnly, hasRole } = require('../middleware/auth');

// GET /api/inventory — get inventory products and summary
router.get('/', protect, staffOnly, async (req, res, next) => {
  try {
    const { search, category, status, page = 1, limit = 100 } = req.query;
    const filter = { isActive: { $ne: false } };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) {
      filter.$or = [
        { category: { $regex: category, $options: 'i' } },
        { categoryVi: { $regex: category, $options: 'i' } },
      ];
    }

    // Load all active non-combo products to calculate accurate summary from MongoDB (Combo tồn kho phụ thuộc SP thành phần)
    const allProducts = await Product.find({
      isActive: { $ne: false },
      isCombo: { $ne: true },
    }).select(
      '_id name slug price priceNumber image category categoryVi stock minStock unit isActive updatedAt'
    );

    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockQuantity = 0;

    for (const p of allProducts) {
      const stock = p.stock ?? 0;
      const minStock = p.minStock ?? 10;
      totalStockQuantity += stock;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      } else {
        inStockCount++;
      }
    }

    const summary = {
      totalProducts: allProducts.length,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      totalStockQuantity,
    };

    // Apply status filter if provided
    let filtered = allProducts;
    if (status === 'out_of_stock') {
      filtered = allProducts.filter((p) => (p.stock ?? 0) <= 0);
    } else if (status === 'low_stock') {
      filtered = allProducts.filter(
        (p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.minStock ?? 10)
      );
    } else if (status === 'in_stock') {
      filtered = allProducts.filter((p) => (p.stock ?? 0) > (p.minStock ?? 10));
    }

    if (search || category) {
      const s = search ? search.toLowerCase() : '';
      const c = category ? category.toLowerCase() : '';
      filtered = filtered.filter((p) => {
        const matchSearch =
          !s ||
          p.name.toLowerCase().includes(s) ||
          p.slug.toLowerCase().includes(s);
        const matchCategory =
          !c ||
          (p.category && p.category.toLowerCase().includes(c)) ||
          (p.categoryVi && p.categoryVi.toLowerCase().includes(c));
        return matchSearch && matchCategory;
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const paginated = filtered.slice(skip, skip + Number(limit));

    // Map status string
    const data = paginated.map((p) => {
      const stock = p.stock ?? 0;
      const minStock = p.minStock ?? 10;
      let pStatus = 'in_stock';
      if (stock <= 0) pStatus = 'out_of_stock';
      else if (stock <= minStock) pStatus = 'low_stock';

      return {
        _id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        priceNumber: p.priceNumber,
        image: p.image,
        category: p.category,
        categoryVi: p.categoryVi,
        stock,
        minStock,
        reservedStock: p.reservedStock ?? 0,
        safetyBuffer: p.safetyBuffer ?? 2,
        availableOnlineStock: Math.max(0, stock - (p.reservedStock ?? 0) - (p.safetyBuffer ?? 2)),
        unit: p.unit || 'kg',
        isActive: p.isActive,
        status: pStatus,
        updatedAt: p.updatedAt,
      };
    });

    res.json({
      success: true,
      summary,
      total: filtered.length,
      page: Number(page),
      data,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/adjust — adjust product stock
router.post('/adjust', protect, hasRole('warehouse', 'admin'), async (req, res, next) => {
  try {
    const { productId, delta, newStock, reason = 'Điều chỉnh kho', note = '' } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Thiếu productId' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    }
    if (product.isCombo) {
      return res.status(400).json({
        success: false,
        message: 'Tồn kho Combo được tính tự động từ tồn kho các sản phẩm thành phần, không chỉnh sửa độc lập.',
      });
    }

    const oldStock = product.stock ?? 0;
    let targetStock = oldStock;
    let actualDelta = 0;

    if (typeof newStock === 'number') {
      targetStock = Math.max(0, newStock);
      actualDelta = targetStock - oldStock;
    } else if (typeof delta === 'number') {
      actualDelta = delta;
      targetStock = Math.max(0, oldStock + delta);
    } else {
      return res.status(400).json({ success: false, message: 'Cần chỉ định delta hoặc newStock' });
    }

    product.stock = targetStock;
    await product.save();

    // Log the change
    const log = await InventoryLog.create({
      product: product._id,
      productName: product.name,
      type: actualDelta >= 0 ? 'import' : 'export',
      delta: actualDelta,
      oldStock,
      newStock: targetStock,
      reason,
      note,
      updatedBy: req.user?._id || null,
    });

    res.json({
      success: true,
      data: product,
      log,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/logs — get stock adjustment history
router.get('/logs', protect, staffOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 100, productId, days, startDate, endDate } = req.query;
    const filter = {};
    if (productId) filter.product = productId;

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
    const [logs, total] = await Promise.all([
      InventoryLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(maxLimit)
        .populate('updatedBy', 'name email'),
      InventoryLog.countDocuments(filter),
    ]);

    res.json({ success: true, total, data: logs });
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

// PUT /api/inventory/store-inventories/:id — Cập nhật ngưỡng an toàn hoặc tồn kho cửa hàng
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
  if (role === 'admin') return true;
  if (role === 'manager' && (!user.assignedStore || user.assignedStore === 'all' || user.assignedStore === 'default')) {
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
      type, // 'goods_receipt' | 'spoilage_writeoff' | 'cycle_count' | 'boris_return'
      items = [],
      note = '',
      evidenceImages = [],
    } = req.body;

    const validTypes = ['goods_receipt', 'spoilage_writeoff', 'cycle_count', 'boris_return'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Loại phiếu điều chỉnh không hợp lệ' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách sản phẩm điều chỉnh không được để trống' });
    }

    // Kiểm tra phân quyền khóa theo chi nhánh
    if (!checkStoreAccess(req.user, storeId)) {
      return res.status(403).json({
        success: false,
        message: `Bạn chỉ có quyền thao tác trong phạm vi chi nhánh được giao [${req.user.assignedStore}]. Không thể tác động kho [${storeId}].`,
      });
    }

    let totalLossValue = 0;
    let maxShortage = 0;
    const processedItems = [];

    for (const item of items) {
      const pId = item.productId || item._id;
      const qtyDelta = Number(item.quantityDelta) || 0;
      if (!pId || qtyDelta === 0) continue;

      const product = await Product.findById(pId).select('name slug priceNumber stock safetyBuffer');
      if (!product) continue;

      const unitPrice = Number(item.unitPrice || product.priceNumber || 0);
      let lossValue = 0;
      if (qtyDelta < 0) {
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

    // Ngưỡng kiểm soát gian lận chéo: Hụt > 3 sản phẩm HOẶC giá trị hụt > 500.000đ
    const userRole = (req.user?.role || '').toLowerCase();
    const exceedsThreshold = maxShortage > 3 || totalLossValue > 500000;
    const isDirectManager = userRole === 'admin' || userRole === 'manager';

    const requiresApproval = (type === 'spoilage_writeoff' || type === 'cycle_count') && exceedsThreshold && !isDirectManager;
    const ticketStatus = requiresApproval ? 'pending_approval' : 'approved';

    const ticketCode = `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const ticket = new StockAdjustmentTicket({
      ticketCode,
      storeId,
      storeName,
      type,
      items: processedItems,
      totalLossValue,
      maxShortageQuantity: maxShortage,
      requiresApproval,
      status: ticketStatus,
      createdBy: req.user._id,
      creatorName: req.user.name || 'Nhân viên kho',
      creatorRole: req.user.role || 'warehouse',
      note,
      evidenceImages,
      approvedBy: !requiresApproval ? req.user._id : null,
      approverName: !requiresApproval ? (req.user.name || 'Hệ thống tự động') : '',
      approvedAt: !requiresApproval ? new Date() : null,
    });

    await ticket.save();

    // Nếu không cần duyệt (hoặc người tạo là Cửa hàng trưởng / Admin) -> Cập nhật tồn kho ngay
    if (!requiresApproval) {
      await applyTicketInventoryChanges(ticket, req.user._id);
      return res.json({
        success: true,
        message: 'Tạo phiếu và cập nhật tồn kho chi nhánh thành công.',
        status: 'approved',
        ticket,
      });
    }

    // Nếu vượt ngưỡng -> Treo ở trạng thái Chờ duyệt
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
      // 1. Nhập hàng: Cộng vào physicalStock
      storeInv.physicalStock += Math.abs(quantityDelta);
      if (batchCode && expDate) {
        storeInv.batches.push({
          batchCode,
          expDate,
          quantity: Math.abs(quantityDelta),
          receivedDate: new Date(),
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

    // Đồng bộ tồn kho Master Product
    await Product.findByIdAndUpdate(productId, {
      $inc: {
        stock: ticket.type === 'spoilage_writeoff' ? -Math.abs(quantityDelta) : quantityDelta,
      },
    });

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

// GET /api/inventory/adjustment-tickets — Danh sách phiếu kiểm kê / điều chỉnh
// Sales và Marketing có quyền xem số lượng (read-only), không được tạo hoặc duyệt
router.get('/adjustment-tickets', protect, staffOnly, async (req, res, next) => {
  try {
    const { storeId, status, type, page = 1, limit = 50 } = req.query;
    const filter = {};

    // Khóa chi nhánh: Nếu nhân viên chỉ được phân quyền tại 1 chi nhánh, chỉ xem phiếu chi nhánh đó
    const userRole = (req.user?.role || '').toLowerCase();
    if (userRole !== 'admin' && req.user.assignedStore && req.user.assignedStore !== 'all') {
      filter.storeId = req.user.assignedStore;
    } else if (storeId) {
      filter.storeId = storeId;
    }

    if (status) filter.status = status;
    if (type) filter.type = type;

    const skip = (Number(page) - 1) * Number(limit);
    const [tickets, total] = await Promise.all([
      StockAdjustmentTicket.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email role')
        .populate('approvedBy', 'name email role')
        .lean(),
      StockAdjustmentTicket.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page: Number(page),
      data: tickets,
    });
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

    res.json({
      success: true,
      message: `Đã từ chối phiếu điều chỉnh [${ticket.ticketCode}]. Tồn kho được giữ nguyên không thay đổi.`,
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/store-config — Cấu hình vùng đệm an toàn & giá xả hàng cuối ngày riêng của chi nhánh
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

module.exports = router;

