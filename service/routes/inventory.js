const router = require('express').Router();
const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');
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
    const { page = 1, limit = 50, productId } = req.query;
    const filter = {};
    if (productId) filter.product = productId;

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      InventoryLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('updatedBy', 'name email'),
      InventoryLog.countDocuments(filter),
    ]);

    res.json({ success: true, total, data: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

