const router = require('express').Router();
const mongoose = require('mongoose');
const FlashSale = require('../models/FlashSale');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/flash-sales/active — public (used by Home page & Promotions)
router.get('/active', async (req, res, next) => {
  try {
    const now = new Date();
    // Query active flash sales within current time window
    const sales = await FlashSale.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .populate('product', 'name slug price priceNumber image category categoryVi description stock')
      .sort({ createdAt: -1 });

    const formatted = sales.map((sale) => {
      const p = sale.product || {};
      const total = sale.totalQuantity || 1;
      const sold = Math.min(total, sale.soldQuantity || 0);
      const percent = Math.min(100, Math.round((sold / total) * 100));

      return {
        _id: sale._id,
        productId: p._id || sale.product,
        name: sale.name || p.name || 'Sản phẩm Flash Sale',
        slug: sale.slug || p.slug || '',
        category: sale.category || p.categoryVi || p.category || 'Nông sản',
        description: sale.description || p.description || '',
        image: sale.image || p.image || '',
        originalPrice: sale.originalPrice || p.priceNumber || 0,
        flashSalePrice: sale.flashSalePrice || 0,
        discountPercent: sale.discountPercent || Math.max(0, Math.round(((sale.originalPrice - sale.flashSalePrice) / (sale.originalPrice || 1)) * 100)),
        totalQuantity: total,
        soldQuantity: sold,
        soldPercent: percent,
        isSoldOut: sold >= total,
        startDate: sale.startDate,
        endDate: sale.endDate,
        isActive: sale.isActive,
      };
    });

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    next(err);
  }
});

// GET /api/flash-sales — all flash sales (supports admin filter)
router.get('/', async (req, res, next) => {
  try {
    const sales = await FlashSale.find()
      .populate('product', 'name slug price priceNumber image')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: sales.length, data: sales });
  } catch (err) {
    next(err);
  }
});

// POST /api/flash-sales — admin
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const flashSale = await FlashSale.create(req.body);
    res.status(201).json({ success: true, data: flashSale });
  } catch (err) {
    next(err);
  }
});

// PUT /api/flash-sales/:id — admin
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const flashSale = await FlashSale.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!flashSale) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mục Flash Sale.' });
    }
    res.json({ success: true, data: flashSale });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/flash-sales/:id — admin
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const flashSale = await FlashSale.findByIdAndDelete(req.params.id);
    if (!flashSale) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy mục Flash Sale.' });
    }
    res.json({ success: true, message: 'Đã xóa mục Flash Sale.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

