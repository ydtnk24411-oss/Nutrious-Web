const mongoose = require('mongoose');
const Product = require('../models/Product');

const COMBO_ITEM_POPULATE_FIELDS =
  'name slug image price priceNumber unit weight stock isActive isCombo categoryVi category';

function slugifyVietnamese(raw) {
  const base = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || `combo-${Date.now()}`;
}

function resolveComboStatus(doc) {
  if (!doc) return 'hidden';
  if (doc.comboStatus === 'paused') return 'paused';
  if (doc.comboStatus === 'hidden') return 'hidden';
  if (doc.isActive === false) return 'hidden';
  return 'active';
}

function enrichComboDocument(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (!obj.isCombo) return obj;

  const status = resolveComboStatus(obj);
  const rawItems = Array.isArray(obj.comboItems) ? obj.comboItems : [];

  let retailTotal = 0;
  let hasPopulatedItems = false;
  let availableStock = rawItems.length > 0 ? Infinity : 0;
  let limitingItem = null;

  const enrichedItems = rawItems.map((ci) => {
    const qty = Math.max(1, Math.floor(Number(ci?.quantity) || 1));
    const prod =
      ci && typeof ci.product === 'object' && ci.product !== null && ci.product._id
        ? ci.product
        : null;

    if (!prod) {
      availableStock = 0;
      return {
        product: ci?.product || null,
        quantity: qty,
        lineTotal: 0,
      };
    }

    hasPopulatedItems = true;
    const unitPrice = Math.max(0, Number(prod.priceNumber) || 0);
    const lineTotal = unitPrice * qty;
    retailTotal += lineTotal;

    const prodStock = Math.max(0, Number(prod.stock ?? 0));
    const prodActive = prod.isActive !== false;
    const maxCombos = prodActive ? Math.floor(prodStock / qty) : 0;

    if (maxCombos < availableStock) {
      availableStock = maxCombos;
      limitingItem = {
        productId: String(prod._id),
        name: prod.name || '',
        productStock: prodStock,
        requiredQty: qty,
        maxCombos,
        isInactive: !prodActive,
      };
    }

    return {
      product: prod,
      quantity: qty,
      lineTotal,
    };
  });

  if (!Number.isFinite(availableStock)) {
    availableStock = 0;
  }
  if (!hasPopulatedItems && obj.originalPriceNumber > 0) {
    retailTotal = Number(obj.originalPriceNumber) || 0;
  }

  const comboPrice = Math.max(0, Number(obj.priceNumber) || 0);
  const savingAmount = Math.max(0, retailTotal - comboPrice);
  const savingPercent =
    retailTotal > 0 ? Math.round((savingAmount / retailTotal) * 100) : 0;

  return {
    ...obj,
    comboStatus: status,
    isActive: status === 'active',
    comboItems: enrichedItems,
    originalPriceNumber: retailTotal,
    retailTotal,
    savingAmount,
    savingPercent,
    availableStock,
    stock: availableStock,
    limitingItem,
  };
}

function enrichProductOrComboList(docs) {
  if (!Array.isArray(docs)) return [];
  return docs.map((d) => {
    const isCombo = d && d.isCombo === true;
    return isCombo ? enrichComboDocument(d) : d;
  });
}

async function validateAndBuildComboItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return {
      valid: false,
      message: 'Combo phải có ít nhất 1 sản phẩm thành phần.',
    };
  }

  // Merge duplicate product IDs by summing quantities
  const qtyByProdId = new Map();
  for (const row of rawItems) {
    if (!row) continue;
    const rawProd = row.product || row.productId;
    const prodId =
      typeof rawProd === 'object' && rawProd !== null
        ? String(rawProd._id || rawProd.id || '')
        : String(rawProd || '');
    if (!mongoose.Types.ObjectId.isValid(prodId)) {
      return {
        valid: false,
        message: 'Có sản phẩm thành phần trong Combo không hợp lệ.',
      };
    }
    const qty = Number(row.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      return {
        valid: false,
        message: 'Số lượng mỗi sản phẩm trong Combo phải là số nguyên lớn hơn hoặc bằng 1.',
      };
    }
    qtyByProdId.set(prodId, (qtyByProdId.get(prodId) || 0) + qty);
  }

  if (qtyByProdId.size === 0) {
    return {
      valid: false,
      message: 'Combo phải có ít nhất 1 sản phẩm thành phần.',
    };
  }

  const ids = Array.from(qtyByProdId.keys()).map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const foundProducts = await Product.find({ _id: { $in: ids } }).lean();
  const prodMap = new Map(foundProducts.map((p) => [String(p._id), p]));

  let retailTotal = 0;
  let availableStock = Infinity;
  const comboItems = [];

  for (const [prodId, qty] of qtyByProdId.entries()) {
    const prod = prodMap.get(prodId);
    if (!prod) {
      return {
        valid: false,
        message: 'Một sản phẩm thành phần không tồn tại trong cơ sở dữ liệu.',
      };
    }
    if (prod.isCombo) {
      return {
        valid: false,
        message: `Không thể chọn Combo khác ("${prod.name}") làm sản phẩm thành phần.`,
      };
    }
    if (prod.isActive === false) {
      return {
        valid: false,
        message: `Sản phẩm "${prod.name}" đã ngừng kinh doanh, không thể đưa vào Combo.`,
      };
    }

    const unitPrice = Math.max(0, Number(prod.priceNumber) || 0);
    retailTotal += unitPrice * qty;

    const prodStock = Math.max(0, Number(prod.stock ?? 0));
    availableStock = Math.min(availableStock, Math.floor(prodStock / qty));

    comboItems.push({
      product: new mongoose.Types.ObjectId(prodId),
      quantity: qty,
    });
  }

  if (!Number.isFinite(availableStock)) {
    availableStock = 0;
  }

  const firstProd = prodMap.get(Array.from(qtyByProdId.keys())[0]);

  return {
    valid: true,
    comboItems,
    retailTotal,
    availableStock,
    defaultImage: firstProd?.image || '',
    defaultCategoryId: firstProd?.categoryId || null,
    defaultCategory: firstProd?.category || '',
    defaultCategoryVi: firstProd?.categoryVi || '',
  };
}

async function generateUniqueComboSlug(name, requestedSlug, excludeId = null) {
  const baseSlug = slugifyVietnamese(requestedSlug || name);
  let candidate = baseSlug;
  let suffix = 1;
  while (true) {
    const query = { slug: candidate };
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }
    const exists = await Product.exists(query);
    if (!exists) return candidate;
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}

module.exports = {
  COMBO_ITEM_POPULATE_FIELDS,
  slugifyVietnamese,
  resolveComboStatus,
  enrichComboDocument,
  enrichProductOrComboList,
  validateAndBuildComboItems,
  generateUniqueComboSlug,
};

