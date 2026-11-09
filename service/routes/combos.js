const router = require('express').Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { protect, adminOnly, staffOnly } = require('../middleware/auth');
const {
  COMBO_ITEM_POPULATE_FIELDS,
  enrichComboDocument,
  validateAndBuildComboItems,
  generateUniqueComboSlug,
} = require('../utils/comboHelper');

const VALID_COMBO_STATUSES = ['active', 'paused', 'hidden'];

// GET /api/combos — Danh sách Combo trong Admin (kèm tổng mua lẻ, tiết kiệm & tồn kho khả dụng tính động)
router.get('/', protect, staffOnly, async (req, res, next) => {
  try {
    const {
      search = '',
      status = 'all',
      sort = 'createdAt',
      page = 1,
      limit = 12,
    } = req.query;

    const rawCombos = await Product.find({ isCombo: true })
      .sort({ createdAt: -1 })
      .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
      .lean();

    const allCombos = rawCombos.map((c) => enrichComboDocument(c));

    const summary = {
      totalCombos: allCombos.length,
      activeCount: allCombos.filter((c) => c.comboStatus === 'active').length,
      pausedCount: allCombos.filter((c) => c.comboStatus === 'paused').length,
      hiddenCount: allCombos.filter((c) => c.comboStatus === 'hidden').length,
      outOfStockCount: allCombos.filter((c) => c.availableStock <= 0).length,
    };

    let filtered = allCombos;

    if (status && status !== 'all') {
      if (status === 'out_of_stock') {
        filtered = filtered.filter((c) => c.availableStock <= 0);
      } else if (VALID_COMBO_STATUSES.includes(status)) {
        filtered = filtered.filter((c) => c.comboStatus === status);
      }
    }

    const q = String(search || '').trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((c) => {
        const matchSelf =
          (c.name || '').toLowerCase().includes(q) ||
          (c.slug || '').toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q);
        if (matchSelf) return true;
        return (c.comboItems || []).some((ci) =>
          (ci.product?.name || '').toLowerCase().includes(q)
        );
      });
    }

    if (sort === 'price-asc') {
      filtered.sort((a, b) => (a.priceNumber || 0) - (b.priceNumber || 0));
    } else if (sort === 'price-desc') {
      filtered.sort((a, b) => (b.priceNumber || 0) - (a.priceNumber || 0));
    } else if (sort === 'saving-desc') {
      filtered.sort((a, b) => (b.savingAmount || 0) - (a.savingAmount || 0));
    } else if (sort === 'stock-asc') {
      filtered.sort((a, b) => (a.availableStock || 0) - (b.availableStock || 0));
    } else if (sort === 'name-asc') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Number(limit);
    const total = filtered.length;
    const data =
      limitNum > 0
        ? filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum)
        : filtered;

    res.json({
      success: true,
      total,
      page: pageNum,
      summary,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/combos/:id — Xem chi tiết 1 Combo trong Admin
router.get('/:id', protect, staffOnly, async (req, res, next) => {
  try {
    const rawId = req.params.id;
    let combo = null;
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      combo = await Product.findOne({ _id: rawId, isCombo: true })
        .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
        .lean();
    }
    if (!combo) {
      combo = await Product.findOne({ slug: rawId, isCombo: true })
        .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
        .lean();
    }
    if (!combo) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Combo.' });
    }
    res.json({ success: true, data: enrichComboDocument(combo) });
  } catch (err) {
    next(err);
  }
});

// POST /api/combos — Tạo mới Combo tiết kiệm trong Admin
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const {
      name,
      slug,
      description = '',
      image = '',
      priceNumber,
      comboStatus = 'active',
      comboItems,
    } = req.body || {};

    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Tên Combo không được để trống.',
      });
    }

    const comboPrice = Math.round(Number(priceNumber));
    if (!Number.isFinite(comboPrice) || comboPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Giá bán Combo phải là số lớn hơn 0.',
      });
    }

    const status = VALID_COMBO_STATUSES.includes(comboStatus) ? comboStatus : 'active';

    const itemsCheck = await validateAndBuildComboItems(comboItems);
    if (!itemsCheck.valid) {
      return res.status(400).json({
        success: false,
        message: itemsCheck.message,
      });
    }

    if (comboPrice > itemsCheck.retailTotal) {
      return res.status(400).json({
        success: false,
        message: `Giá bán Combo (${comboPrice.toLocaleString('vi-VN')}đ) không được lớn hơn tổng giá mua lẻ các sản phẩm thành phần (${itemsCheck.retailTotal.toLocaleString('vi-VN')}đ).`,
      });
    }

    const uniqueSlug = await generateUniqueComboSlug(cleanName, slug, null);

    const created = await Product.create({
      name: cleanName,
      slug: uniqueSlug,
      description: String(description || '').trim(),
      image: String(image || '').trim() || itemsCheck.defaultImage,
      priceNumber: comboPrice,
      price: `${comboPrice.toLocaleString('vi-VN')}đ`,
      originalPriceNumber: itemsCheck.retailTotal,
      isCombo: true,
      comboStatus: status,
      isActive: status === 'active',
      comboItems: itemsCheck.comboItems,
      stock: itemsCheck.availableStock,
      categoryId: itemsCheck.defaultCategoryId,
      category: itemsCheck.defaultCategory,
      categoryVi: itemsCheck.defaultCategoryVi,
      brand: 'Evergreen Mart',
      unit: `Combo (${itemsCheck.comboItems.length} sản phẩm)`,
      preparation: '',
      type: '',
      weight: '',
      addOnDeals: [],
    });

    const populated = await Product.findById(created._id)
      .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
      .lean();

    res.status(201).json({
      success: true,
      data: enrichComboDocument(populated),
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/combos/:id — Chỉnh sửa Combo tiết kiệm trong Admin
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const existing = await Product.findOne({ _id: req.params.id, isCombo: true });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Combo.' });
    }

    const {
      name,
      slug,
      description,
      image,
      priceNumber,
      comboStatus,
      comboItems,
    } = req.body || {};

    const cleanName = name !== undefined ? String(name).trim() : existing.name;
    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Tên Combo không được để trống.',
      });
    }

    const comboPrice =
      priceNumber !== undefined ? Math.round(Number(priceNumber)) : existing.priceNumber;
    if (!Number.isFinite(comboPrice) || comboPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Giá bán Combo phải là số lớn hơn 0.',
      });
    }

    const rawItemsInput = comboItems !== undefined ? comboItems : existing.comboItems;
    const itemsCheck = await validateAndBuildComboItems(rawItemsInput);
    if (!itemsCheck.valid) {
      return res.status(400).json({
        success: false,
        message: itemsCheck.message,
      });
    }

    if (comboPrice > itemsCheck.retailTotal) {
      return res.status(400).json({
        success: false,
        message: `Giá bán Combo (${comboPrice.toLocaleString('vi-VN')}đ) không được lớn hơn tổng giá mua lẻ các sản phẩm thành phần (${itemsCheck.retailTotal.toLocaleString('vi-VN')}đ).`,
      });
    }

    const nextStatus =
      comboStatus && VALID_COMBO_STATUSES.includes(comboStatus)
        ? comboStatus
        : existing.comboStatus || (existing.isActive === false ? 'hidden' : 'active');

    let nextSlug = existing.slug;
    if (slug && String(slug).trim() && String(slug).trim() !== existing.slug) {
      nextSlug = await generateUniqueComboSlug(cleanName, slug, existing._id);
    }

    existing.name = cleanName;
    existing.slug = nextSlug;
    if (description !== undefined) {
      existing.description = String(description || '').trim();
    }
    if (image !== undefined) {
      existing.image = String(image || '').trim() || itemsCheck.defaultImage;
    }
    existing.priceNumber = comboPrice;
    existing.price = `${comboPrice.toLocaleString('vi-VN')}đ`;
    existing.originalPriceNumber = itemsCheck.retailTotal;
    existing.comboItems = itemsCheck.comboItems;
    existing.comboStatus = nextStatus;
    existing.isActive = nextStatus === 'active';
    existing.stock = itemsCheck.availableStock;
    existing.unit = `Combo (${itemsCheck.comboItems.length} sản phẩm)`;
    existing.categoryId = itemsCheck.defaultCategoryId || existing.categoryId;
    existing.category = itemsCheck.defaultCategory || existing.category;
    existing.categoryVi = itemsCheck.defaultCategoryVi || existing.categoryVi;
    existing.preparation = '';
    existing.type = '';
    existing.weight = '';
    existing.addOnDeals = [];

    await existing.save();

    const populated = await Product.findById(existing._id)
      .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
      .lean();

    res.json({
      success: true,
      data: enrichComboDocument(populated),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/combos/:id/status — Đổi nhanh trạng thái Combo (Đang kinh doanh / Tạm ngừng / Ẩn)
router.patch('/:id/status', protect, adminOnly, async (req, res, next) => {
  try {
    const { comboStatus } = req.body || {};
    if (!VALID_COMBO_STATUSES.includes(comboStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái Combo không hợp lệ (chỉ chấp nhận active, paused, hidden).',
      });
    }

    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id, isCombo: true },
      {
        $set: {
          comboStatus,
          isActive: comboStatus === 'active',
        },
      },
      { new: true }
    )
      .populate('comboItems.product', COMBO_ITEM_POPULATE_FIELDS)
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Combo.' });
    }

    res.json({
      success: true,
      data: enrichComboDocument(updated),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/combos/:id — Ẩn Combo khỏi cửa hàng (giữ toàn vẹn lịch sử đơn hàng)
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id, isCombo: true },
      { $set: { comboStatus: 'hidden', isActive: false } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Combo.' });
    }
    res.json({ success: true, message: 'Đã chuyển Combo sang trạng thái Ẩn.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

