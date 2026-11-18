const crypto = require('crypto');
const router = require('express').Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const Order  = require('../models/Order');
const User   = require('../models/User');
const Cart   = require('../models/Cart');
const Product = require('../models/Product');
const FlashSale = require('../models/FlashSale');
const InventoryLog = require('../models/InventoryLog');
const StoreInventory = require('../models/StoreInventory');
const AuditLog = require('../models/AuditLog');
const { protect, optionalAuth, adminOnly, staffOnly, hasRole, verifyStoreAccess, getScopedStoreId } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');
const { evaluateVoucher, consumeVoucher, restoreOrderVoucherOnce } = require('../utils/voucher');
const { creditOrderPoints, rollbackOrderPoints, tierFor }   = require('../utils/loyalty');
const { calculateShipping }   = require('../utils/shippingCalculator');
const { sendRealtimeNotification } = require('../utils/sse');
const { sendOrderConfirmationEmail } = require('../utils/email');
const { clearDashboardCache } = require('./dashboard');
const { cacheMiddleware, clearCache } = require('../utils/cache');
const ExcelJS = require('exceljs');

const QR_PAYMENT_TTL_MS = 15 * 60 * 1000; // 15 phút giữ đơn chờ chuyển khoản VietQR

function buildVietQrPayload(order) {
  const bankId = (process.env.BANK_ID || 'MB').trim();
  const accountNo = (process.env.ACCOUNT_NO || '0962299122').trim();
  const accountName = (process.env.ACCOUNT_NAME || 'VY TAM NHU').trim();
  const encodedAccountName = encodeURIComponent(accountName);
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${order.total}&addInfo=${encodeURIComponent(order.orderCode)}&accountName=${encodedAccountName}`;
  return {
    qrUrl,
    bankInfo: { bankId, accountNo, accountName },
  };
}

function buildOrderLookupQuery(rawCodeOrId) {
  const raw = String(rawCodeOrId || '').trim();
  if (mongoose.Types.ObjectId.isValid(raw)) {
    return { _id: new mongoose.Types.ObjectId(raw) };
  }
  const normalizedCode = raw.replace(/^XL-?/i, 'XL-');
  const noHyphenCode = raw.replace(/^XL-?/i, 'XL');
  return {
    $or: [
      { orderCode: raw },
      { orderCode: normalizedCode },
      { orderCode: noHyphenCode },
      { orderCode: raw.toUpperCase() },
    ],
  };
}

async function expireUnpaidQrOrderIfNeeded(order) {
  if (!order) return order;
  const createdAtMs = order.createdAt ? new Date(order.createdAt).getTime() : 0;
  const expiresAtMs = order.paymentExpiresAt
    ? new Date(order.paymentExpiresAt).getTime()
    : (createdAtMs ? createdAtMs + 15 * 60 * 1000 : 0);

  const isUnpaidQrPending =
    order.paymentMethod === 'bank_transfer' &&
    (order.paymentStatus || 'unpaid') !== 'paid' &&
    order.status === 'pending' &&
    expiresAtMs > 0 &&
    Date.now() > expiresAtMs;

  if (!isUnpaidQrPending) return order;

  const expiredNote = order.note
    ? `${order.note} | Tự động hủy do quá thời gian thanh toán VietQR (15 phút)`
    : 'Tự động hủy do quá thời gian thanh toán VietQR (15 phút)';

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: 'pending' },
    { $set: { paymentStatus: 'expired', status: 'cancelled', note: expiredNote } },
    { new: true }
  ).lean();

  if (updated) {
    await restoreOrderInventoryOnce(order._id, null);
    await restoreOrderVoucherOnce(order);
    await handleFlashSaleOrderCancelled(order);
    order.paymentStatus = 'expired';
    order.status = 'cancelled';
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: 'cancelled',
      updatedBy: 'Hệ thống tự động',
      role: 'System',
      note: 'Tự động hủy do quá thời gian thanh toán VietQR (15 phút)',
      updatedAt: new Date(),
    });
    order.note = updated.note;
  }
  return order;
}

function attachPaymentQrMetadata(orderObj) {
  if (!orderObj) return orderObj;
  if (
    orderObj.paymentMethod === 'bank_transfer' &&
    (orderObj.paymentStatus || 'unpaid') === 'unpaid' &&
    orderObj.status === 'pending'
  ) {
    const vietQr = buildVietQrPayload(orderObj);
    orderObj.qrUrl = vietQr.qrUrl;
    orderObj.bankInfo = vietQr.bankInfo;
  }
  return orderObj;
}

async function markQrOrderAsPaid(order, { reference = '', autoConfirm = true } = {}) {
  if (!order) return null;
  const setFields = {
    paymentStatus: 'paid',
    paidAt: order.paidAt || new Date(),
  };
  if (reference) setFields.paymentReference = String(reference);
  if (autoConfirm && order.status === 'pending') {
    setFields.status = 'confirmed';
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: { $ne: 'cancelled' }, paymentStatus: { $ne: 'paid' } },
    { $set: setFields },
    { new: true }
  );
  if (!updated) {
    return Order.findById(order._id);
  }
  if (order.status === 'pending' && updated.status === 'confirmed') {
    await handleFlashSaleOrderConfirmed(updated);
  }
  // Khi đơn VietQR đã xác nhận thanh toán thành công, lập tức cộng điểm và cập nhật chi tiêu cho khách hàng
  if (updated.paymentStatus === 'paid') {
    await creditOrderPoints(updated._id);
  }
  if (typeof clearDashboardCache === 'function') {
    clearDashboardCache();
  }
  if (typeof clearCache === 'function') {
    clearCache();
  }
  return updated;
}

function calcDealUnitDiscount(targetUnitPrice, deal) {
  if (!deal || deal.isActive === false) return 0;
  const val = Number(deal.discountValue) || 0;
  if (val <= 0 || targetUnitPrice <= 0) return 0;
  const rawDisc = deal.discountType === 'fixed'
    ? Math.round(val)
    : Math.round((targetUnitPrice * Math.min(99, val)) / 100);
  return Math.max(0, Math.min(targetUnitPrice, rawDisc));
}

// Nhận diện sản phẩm tươi sống thuộc 4 danh mục: Rau củ, Trái cây, Thịt, Cá & Hải sản
function isFreshPerishableProduct(prod) {
  if (!prod) return { isFresh: false, categoryName: '' };
  const cat = (prod.category || '').toLowerCase();
  const catVi = (prod.categoryVi || '').toLowerCase();
  const name = (prod.name || '').toLowerCase();
  const combined = `${cat} ${catVi} ${name}`;

  // Loại trừ đồ uống đóng chai, bánh kẹo, gia vị & đồ khô, sữa
  const excluded = [
    'beverages', 'thức uống', 'nước ép',
    'bakery', 'bánh mỳ', 'bánh ngọt',
    'pantry', 'gia vị', 'đồ khô', 'hạt & ngũ cốc',
    'dairy'
  ];
  if (excluded.some(ex => cat.includes(ex) || catVi.includes(ex))) {
    return { isFresh: false, categoryName: '' };
  }

  // 1. Rau củ
  if (/rau\s*củ|rau\s*ăn|rau\s*gia\s*vị|nấm\s*tươi|củ\s*quả|vegetable/i.test(combined)) {
    return { isFresh: true, categoryName: 'Rau củ tươi' };
  }
  // 2. Trái cây
  if (/trái\s*cây|hoa\s*quả|fruit/i.test(combined)) {
    return { isFresh: true, categoryName: 'Trái cây tươi' };
  }
  // 3. Thịt
  if (/thịt|meat|thịt\s*bò|thịt\s*heo|thịt\s*gà|gia\s*cầm/i.test(combined)) {
    return { isFresh: true, categoryName: 'Thịt tươi sống' };
  }
  // 4. Cá & hải sản
  if (/cá\s*&?\s*hải\s*sản|hải\s*sản|seafood|thủy\s*hải\s*sản/i.test(combined)) {
    return { isFresh: true, categoryName: 'Cá & hải sản tươi' };
  }

  return { isFresh: false, categoryName: '' };
}

async function handleFlashSaleOrderConfirmed(order) {
  if (!order || !Array.isArray(order.items)) return;
  for (const item of order.items) {
    if (!item.quantity || item.quantity <= 0) continue;
    const orConditions = [];
    if (mongoose.Types.ObjectId.isValid(item.product)) {
      orConditions.push({ product: new mongoose.Types.ObjectId(item.product) });
      orConditions.push({ _id: new mongoose.Types.ObjectId(item.product) });
    }
    if (item.product) orConditions.push({ slug: item.product });
    if (item.productName) orConditions.push({ name: item.productName });

    if (orConditions.length === 0) continue;

    const flashSale = await FlashSale.findOne({
      isActive: true,
      $or: orConditions,
    });

    if (flashSale) {
      const currentSold = flashSale.soldQuantity || 0;
      const total = flashSale.totalQuantity || 0;
      const maxAdd = Math.max(0, total - currentSold);
      const toAdd = Math.min(item.quantity, maxAdd);
      if (toAdd > 0) {
        flashSale.soldQuantity = currentSold + toAdd;
        await flashSale.save();
      }
    }
  }
}

async function handleFlashSaleOrderCancelled(order) {
  if (!order || !Array.isArray(order.items)) return;
  for (const item of order.items) {
    if (!item.quantity || item.quantity <= 0) continue;
    const orConditions = [];
    if (mongoose.Types.ObjectId.isValid(item.product)) {
      orConditions.push({ product: new mongoose.Types.ObjectId(item.product) });
      orConditions.push({ _id: new mongoose.Types.ObjectId(item.product) });
    }
    if (item.product) orConditions.push({ slug: item.product });
    if (item.productName) orConditions.push({ name: item.productName });

    if (orConditions.length === 0) continue;

    const flashSale = await FlashSale.findOne({
      $or: orConditions,
    });

    if (flashSale) {
      const currentSold = flashSale.soldQuantity || 0;
      flashSale.soldQuantity = Math.max(0, currentSold - item.quantity);
      await flashSale.save();
    }
  }
}

// POST /api/orders – khách vãng lai hoặc user đã đăng nhập.
router.post(
  '/',
  optionalAuth,
  [
    body('items').isArray({ min: 1 }).withMessage('Đơn hàng phải có ít nhất 1 sản phẩm.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const orderData = { ...req.body };
      delete orderData.user;
      delete orderData.status;
      delete orderData.orderCode;
      delete orderData.paymentStatus;
      delete orderData.paymentExpiresAt;
      delete orderData.paidAt;
      delete orderData.paymentReference;

      // 1. Validate giỏ hàng rỗng
      if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
        return res.status(400).json({ success: false, message: 'Giỏ hàng rỗng, vui lòng chọn ít nhất 1 sản phẩm.' });
      }

      // 2. Validate từng sản phẩm và tự tính lại subtotal từ database (lấy priceNumber của Product, không tin client)
      let serverSubtotal = 0;
      let totalComboSaving = 0;
      let totalAddonSaving = 0;
      const finalItems = [];
      const regularEntries = [];
      const addonEntries = [];
      const detectedNonRefundableItems = [];

      for (const item of orderData.items) {
        const qty = Number(item.quantity);
        if (!Number.isInteger(qty) || qty <= 0) {
          return res.status(400).json({
            success: false,
            message: `Số lượng của sản phẩm "${item.productName || 'trong giỏ'}" không hợp lệ, phải là số nguyên dương.`
          });
        }
        item.quantity = qty;

        // Tìm sản phẩm trong DB bằng ObjectId, slug hoặc tên
        let prod = null;
        if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
          prod = await Product.findById(item.product);
        }
        if (!prod && item.product) {
          prod = await Product.findOne({ slug: item.product });
        }
        if (!prod && item.productName) {
          prod = await Product.findOne({ name: item.productName });
        }

        if (!prod || prod.isActive === false || (prod.isCombo && (prod.comboStatus === 'paused' || prod.comboStatus === 'hidden'))) {
          return res.status(400).json({
            success: false,
            message: `Sản phẩm "${item.productName || item.product || 'trong đơn hàng'}" không tồn tại hoặc đã ngừng kinh doanh.`
          });
        }

        // Lấy giá chuẩn từ database (trường số priceNumber, KHÔNG parse chuỗi)
        const priceNum = typeof prod.priceNumber === 'number' ? prod.priceNumber : Number(prod.priceNumber || 0);

        if (prod.isCombo) {
          const popProd = await Product.findById(prod._id).populate(
            'comboItems.product',
            'name price priceNumber image weight unit slug stock isActive'
          );
          if (!popProd || !Array.isArray(popProd.comboItems) || popProd.comboItems.length === 0) {
            return res.status(400).json({
              success: false,
              message: `Combo "${prod.name}" chưa có danh sách sản phẩm thành phần hợp lệ.`,
            });
          }

          const comboSubItems = [];
          let comboItemsSum = 0;
          for (const ci of popProd.comboItems) {
            if (!ci.product || ci.product.isActive === false) {
              return res.status(400).json({
                success: false,
                message: `Sản phẩm thành phần trong Combo "${prod.name}" đã ngừng kinh doanh.`,
              });
            }
            const ciPrice = typeof ci.product.priceNumber === 'number' ? ci.product.priceNumber : Number(ci.product.priceNumber || 0);
            const singleQty = Math.max(1, Number(ci.quantity) || 1);
            const lineTotal = ciPrice * singleQty;
            comboItemsSum += lineTotal;
            comboSubItems.push({
              product: ci.product._id ? String(ci.product._id) : '',
              slug: ci.product.slug || '',
              name: ci.product.name,
              image: ci.product.image || '',
              price: ci.product.price || `${ciPrice.toLocaleString('vi-VN')}đ`,
              priceNumber: ciPrice,
              quantity: singleQty,
              lineTotal,
              unit: ci.product.unit || '',
              weight: ci.product.weight || '',
            });
          }

          const comboRetail = comboItemsSum > 0
            ? comboItemsSum
            : (prod.originalPriceNumber && prod.originalPriceNumber > priceNum ? prod.originalPriceNumber : priceNum);
          const saving = Math.max(0, (comboRetail - priceNum) * qty);
          totalComboSaving += saving;
          serverSubtotal += priceNum * qty;

          // Kiểm tra thành phần tươi sống trong Combo
          const comboFreshCheck = isFreshPerishableProduct(prod);
          let comboIsFresh = comboFreshCheck.isFresh;
          const matchedComponents = [];
          for (const ci of popProd.comboItems) {
            const ciFresh = isFreshPerishableProduct(ci.product);
            if (ciFresh.isFresh) {
              comboIsFresh = true;
              matchedComponents.push(ci.product.name);
            }
          }
          if (comboIsFresh) {
            const comboLabel = matchedComponents.length > 0
              ? `${prod.name} (thành phần: ${matchedComponents.join(', ')})`
              : prod.name;
            detectedNonRefundableItems.push({
              name: comboLabel,
              categoryName: comboFreshCheck.categoryName || 'Combo thực phẩm tươi sống',
              isCombo: true
            });
          }

          finalItems.push({
            product: prod._id.toString(),
            productName: prod.name,
            productImage: prod.image || item.productImage || '',
            productPrice: prod.price,
            priceNumber: priceNum,
            quantity: qty,
            selectedOption: item.selectedOption || '',
            isCombo: true,
            itemType: 'combo',
            comboItems: comboSubItems,
            originalPriceNumber: comboRetail,
            comboSaving: saving,
          });
          continue;
        }

        // Kiểm tra sản phẩm đơn lẻ / mua kèm tươi sống
        const freshCheck = isFreshPerishableProduct(prod);
        if (freshCheck.isFresh) {
          detectedNonRefundableItems.push({
            name: prod.name,
            categoryName: freshCheck.categoryName,
            isCombo: false
          });
        }

        const requestedType = item.itemType === 'addon' && item.linkedMainProduct ? 'addon' : 'regular';
        if (requestedType === 'addon') {
          addonEntries.push({
            inputItem: item,
            prod,
            prodId: prod._id.toString(),
            priceNum,
            qty,
            linkedMainKey: String(item.linkedMainProduct).trim(),
          });
        } else {
          regularEntries.push({
            inputItem: item,
            prod,
            prodId: prod._id.toString(),
            priceNum,
            qty,
          });
        }
      }

      // 2b. Xử lý chương trình "Mua kèm tiết kiệm hơn" (quy tắc: SP có giá thấp hơn nhận ưu đãi, không chồng chéo giảm giá)
      const mainByKey = new Map();
      const mainRegularQty = new Map();
      for (const reg of regularEntries) {
        mainByKey.set(reg.prodId, reg.prod);
        if (reg.prod.slug) mainByKey.set(reg.prod.slug, reg.prod);
        mainRegularQty.set(reg.prodId, (mainRegularQty.get(reg.prodId) || 0) + reg.qty);
      }

      const unclaimedMainUnits = new Map(mainRegularQty);
      const pairQuotaRemaining = new Map();
      const mainDiscountsAllocated = new Map(); // mainProdId -> Array<{ qty, unitDisc, addonProdName, discountType, discountValue }>

      // Xác thực từng sản phẩm mua kèm và sắp xếp ưu tiên mức giảm tốt nhất khi giảm giá rơi vào sản phẩm chính
      const resolvedAddons = addonEntries.map((ae) => {
        const mainProd = mainByKey.get(ae.linkedMainKey) || null;
        if (!mainProd) {
          return { ...ae, valid: false };
        }
        const mainProdId = mainProd._id.toString();
        const mainPriceNum = typeof mainProd.priceNumber === 'number' ? mainProd.priceNumber : Number(mainProd.priceNumber || 0);
        // Quy tắc bắt buộc: Giá mua kèm phải THẤP HƠN giá sản phẩm chính
        if (ae.priceNum >= mainPriceNum || ae.priceNum <= 0 || mainPriceNum <= 0) {
          return { ...ae, valid: false };
        }
        const deal = (mainProd.addOnDeals || []).find(
          (d) =>
            d &&
            d.isActive !== false &&
            String(d.product?._id || d.product) === ae.prodId &&
            Number(d.discountValue) > 0
        );
        if (!deal || mainProdId === ae.prodId) {
          return { ...ae, valid: false };
        }
        const discountTarget = 'addon';
        const potentialUnitDisc = calcDealUnitDiscount(ae.priceNum, deal);
        return {
          ...ae,
          valid: potentialUnitDisc > 0,
          mainProd,
          mainProdId,
          mainPriceNum,
          deal,
          discountTarget,
          potentialUnitDisc,
        };
      });

      // Sắp xếp Case 2 (giảm trên main) giảm dần theo mức giảm để khách nhận ưu đãi tốt nhất khi số lượng main giới hạn
      resolvedAddons.sort((a, b) => {
        if (a.discountTarget === 'main' && b.discountTarget === 'main') {
          return (b.potentialUnitDisc || 0) - (a.potentialUnitDisc || 0);
        }
        return 0;
      });

      const emittedAddonItems = [];
      for (const ae of resolvedAddons) {
        if (!ae.valid) {
          // Không có SP chính hợp lệ hoặc chương trình đã tắt -> tính giá lẻ bình thường
          emittedAddonItems.push({
            product: ae.prodId,
            productName: ae.prod.name,
            productImage: ae.prod.image || ae.inputItem.productImage || '',
            productPrice: ae.prod.price,
            priceNumber: ae.priceNum,
            originalPriceNumber: ae.priceNum,
            quantity: ae.qty,
            selectedOption: ae.inputItem.selectedOption || '',
            itemType: 'regular',
            addonSaving: 0,
            discountedByAddon: false,
          });
          continue;
        }

        const pairKey = `${ae.mainProdId}:${ae.prodId}`;
        const maxPairQuota = pairQuotaRemaining.has(pairKey)
          ? pairQuotaRemaining.get(pairKey)
          : (mainRegularQty.get(ae.mainProdId) || 0);

        if (ae.discountTarget === 'addon') {
          const pairedQty = Math.min(ae.qty, maxPairQuota);
          pairQuotaRemaining.set(pairKey, maxPairQuota - pairedQty);
          const unitDisc = ae.potentialUnitDisc;

          if (pairedQty > 0 && unitDisc > 0) {
            const finalUnitPrice = ae.priceNum - unitDisc;
            const saving = unitDisc * pairedQty;
            emittedAddonItems.push({
              product: ae.prodId,
              productName: ae.prod.name,
              productImage: ae.prod.image || ae.inputItem.productImage || '',
              productPrice: ae.prod.price,
              priceNumber: finalUnitPrice,
              originalPriceNumber: ae.priceNum,
              quantity: pairedQty,
              selectedOption: ae.inputItem.selectedOption || '',
              itemType: 'addon',
              linkedMainProduct: ae.mainProdId,
              linkedMainProductName: ae.mainProd.name,
              addonDiscountType: ae.deal.discountType,
              addonDiscountValue: ae.deal.discountValue,
              addonSaving: saving,
              discountedByAddon: true,
              promoNote: `Ưu đãi mua kèm cùng "${ae.mainProd.name}"`,
            });
          }
          const excessQty = ae.qty - pairedQty;
          if (excessQty > 0) {
            emittedAddonItems.push({
              product: ae.prodId,
              productName: ae.prod.name,
              productImage: ae.prod.image || ae.inputItem.productImage || '',
              productPrice: ae.prod.price,
              priceNumber: ae.priceNum,
              originalPriceNumber: ae.priceNum,
              quantity: excessQty,
              selectedOption: ae.inputItem.selectedOption || '',
              itemType: 'regular',
              addonSaving: 0,
              discountedByAddon: false,
            });
          }
        } else {
          // ae.discountTarget === 'main' (SP chính có giá thấp hơn SP mua kèm)
          const availMain = unclaimedMainUnits.get(ae.mainProdId) || 0;
          const pairedQty = Math.min(ae.qty, maxPairQuota, availMain);
          pairQuotaRemaining.set(pairKey, maxPairQuota - pairedQty);
          const unitDiscOnMain = ae.potentialUnitDisc;

          if (pairedQty > 0 && unitDiscOnMain > 0) {
            unclaimedMainUnits.set(ae.mainProdId, availMain - pairedQty);
            const allocList = mainDiscountsAllocated.get(ae.mainProdId) || [];
            allocList.push({
              qty: pairedQty,
              unitDisc: unitDiscOnMain,
              addonProdName: ae.prod.name,
              discountType: ae.deal.discountType,
              discountValue: ae.deal.discountValue,
            });
            mainDiscountsAllocated.set(ae.mainProdId, allocList);

            emittedAddonItems.push({
              product: ae.prodId,
              productName: ae.prod.name,
              productImage: ae.prod.image || ae.inputItem.productImage || '',
              productPrice: ae.prod.price,
              priceNumber: ae.priceNum,
              originalPriceNumber: ae.priceNum,
              quantity: pairedQty,
              selectedOption: ae.inputItem.selectedOption || '',
              itemType: 'addon',
              linkedMainProduct: ae.mainProdId,
              linkedMainProductName: ae.mainProd.name,
              addonDiscountType: ae.deal.discountType,
              addonDiscountValue: ae.deal.discountValue,
              addonSaving: 0,
              discountedByAddon: false,
              promoNote: `Ưu đãi mua kèm cùng "${ae.mainProd.name}"`,
            });
          }
          const excessQty = ae.qty - pairedQty;
          if (excessQty > 0) {
            emittedAddonItems.push({
              product: ae.prodId,
              productName: ae.prod.name,
              productImage: ae.prod.image || ae.inputItem.productImage || '',
              productPrice: ae.prod.price,
              priceNumber: ae.priceNum,
              originalPriceNumber: ae.priceNum,
              quantity: excessQty,
              selectedOption: ae.inputItem.selectedOption || '',
              itemType: 'regular',
              addonSaving: 0,
              discountedByAddon: false,
            });
          }
        }
      }

      // Phát sinh danh sách sản phẩm mua lẻ / sản phẩm chính (áp dụng giảm giá nếu thuộc Case 2)
      for (const reg of regularEntries) {
        let remQty = reg.qty;
        const allocList = mainDiscountsAllocated.get(reg.prodId) || [];
        for (const alloc of allocList) {
          if (remQty <= 0) break;
          if (alloc.qty <= 0) continue;
          const take = Math.min(remQty, alloc.qty);
          alloc.qty -= take;
          remQty -= take;
          const finalUnitPrice = reg.priceNum - alloc.unitDisc;
          const saving = alloc.unitDisc * take;
          finalItems.push({
            product: reg.prodId,
            productName: reg.prod.name,
            productImage: reg.prod.image || reg.inputItem.productImage || '',
            productPrice: reg.prod.price,
            priceNumber: finalUnitPrice,
            originalPriceNumber: reg.priceNum,
            quantity: take,
            selectedOption: reg.inputItem.selectedOption || '',
            itemType: 'regular',
            addonDiscountType: alloc.discountType,
            addonDiscountValue: alloc.discountValue,
            addonSaving: saving,
            discountedByAddon: true,
            promoNote: `Ưu đãi mua kèm cùng "${alloc.addonProdName}"`,
          });
          serverSubtotal += finalUnitPrice * take;
          totalAddonSaving += saving;
        }
        if (remQty > 0) {
          finalItems.push({
            product: reg.prodId,
            productName: reg.prod.name,
            productImage: reg.prod.image || reg.inputItem.productImage || '',
            productPrice: reg.prod.price,
            priceNumber: reg.priceNum,
            originalPriceNumber: reg.priceNum,
            quantity: remQty,
            selectedOption: reg.inputItem.selectedOption || '',
            itemType: 'regular',
            addonSaving: 0,
            discountedByAddon: false,
          });
          serverSubtotal += reg.priceNum * remQty;
        }
      }

      for (const ai of emittedAddonItems) {
        finalItems.push(ai);
        serverSubtotal += ai.priceNumber * ai.quantity;
        totalAddonSaving += ai.addonSaving || 0;
      }

      orderData.items = finalItems;
      orderData.subtotal = serverSubtotal;
      orderData.comboDiscount = totalComboSaving;
      orderData.addonDiscount = totalAddonSaving;

      if (req.user) {
        orderData.user       = req.user._id;
        orderData.guestName  = orderData.guestName  || req.user.name;
        orderData.guestEmail = orderData.guestEmail || req.user.email;
        orderData.guestPhone = orderData.guestPhone || req.user.phone || '';
      } else {
        // Tự động liên kết tài khoản khách hàng nếu SĐT hoặc Email đã tồn tại
        const lookupOr = [];
        if (orderData.guestPhone) lookupOr.push({ phone: orderData.guestPhone.trim() });
        if (orderData.guestEmail) lookupOr.push({ email: orderData.guestEmail.trim().toLowerCase() });
        if (lookupOr.length > 0) {
          try {
            const matchedCustomer = await User.findOne({ $or: lookupOr, role: 'customer' });
            if (matchedCustomer) {
              orderData.user = matchedCustomer._id;
              if (!orderData.guestName && matchedCustomer.name) {
                orderData.guestName = matchedCustomer.name;
              }
            }
          } catch (_) {}
        }
      }

      // 3. Tính toán và xác thực phí vận chuyển từ server (theo nấc khoảng cách + giá trị đơn hàng thực tế)
      let finalShippingFee = 0;
      let shippingDiscount = 0;
      let distanceKm = 0;
      let estimatedDeliveryTime = orderData.estimatedDeliveryTime || '30 phút (lấy tại kho)';

      if (orderData.shippingMethod === 'delivery') {
        const coords = orderData.shippingCoordinates;
        if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
          // Xác định hạng thành viên để áp dụng quyền lợi Freeship
          let userLoyaltyTier = orderData.loyaltyTier || '';
          if (req.user) {
            userLoyaltyTier = req.user.tier || (tierFor ? tierFor(req.user.points, req.user.totalSpent) : '') || 'bronze';
          }

          const shipRes = await calculateShipping(coords.lat, coords.lng, serverSubtotal, null, userLoyaltyTier);
          if (!shipRes.supported) {
            return res.status(400).json({
              success: false,
              message: shipRes.message || 'Khu vực giao hàng vượt quá bán kính 20km cho phép đối với nông sản & thực phẩm tươi.',
            });
          }
          finalShippingFee = shipRes.finalFee;
          shippingDiscount = shipRes.discount;
          distanceKm = shipRes.distanceKm;
          estimatedDeliveryTime = orderData.deliveryTimeSlot || orderData.estimatedDeliveryTime || shipRes.estimatedDeliveryTime;

          // Điều chỉnh theo loại hình giao hàng
          if (orderData.deliveryType === 'instant') {
            // Giao ngay : Phí cơ bản theo khoảng cách + 10.000đ hỏa tốc
            finalShippingFee += 10000;
          } else if (orderData.deliveryType === 'standard') {
            // Giao tiết kiệm (trong 24h): Giá gốc 15.000đ (+ phụ thu giao xa nếu >10km)
            const stdBase = 15000 + (shipRes.farSurcharge || 0);
            if (shippingDiscount >= shipRes.baseFee) {
              finalShippingFee = 0;
              shippingDiscount = stdBase;
            } else {
              finalShippingFee = Math.max(0, stdBase - shippingDiscount);
            }
          }

          orderData.shippingDetails = {
            baseFee: shipRes.baseFee,
            farSurcharge: shipRes.farSurcharge || 0,
            isFarDelivery: Boolean(shipRes.isFarDelivery),
            discount: shippingDiscount,
            discountReason: shipRes.discountReason,
            finalFee: finalShippingFee,
            distanceKm: shipRes.distanceKm,
            loyaltyTier: userLoyaltyTier,
            durationMin: shipRes.durationMin,
            tierLabel: shipRes.tierLabel,
            discountReason: shipRes.discountReason,
          };

          // Tự động gán kho/chi nhánh gần nhất phụ trách soạn hàng & xuất kho (O2O Smart Routing)
          if (shipRes.warehouse?.id && (!orderData.warehouseId || orderData.warehouseId === 'store-thuduc')) {
            orderData.warehouseId = shipRes.warehouse.id;
            orderData.storeId = shipRes.warehouse.id;
          }
        } else {
          // Fallback nếu không có tọa độ GPS: tính phí chuẩn 20.000đ và xét bậc thang
          const baseFee = orderData.deliveryType === 'instant' ? 30000 : (orderData.deliveryType === 'standard' ? 15000 : 20000);
          const autoDisc = serverSubtotal >= 300000 ? (baseFee <= 25000 ? baseFee : 25000) : (serverSubtotal >= 150000 ? 10000 : 0);
          finalShippingFee = Math.max(0, baseFee - autoDisc);
          shippingDiscount = autoDisc;
          estimatedDeliveryTime = orderData.deliveryTimeSlot || orderData.estimatedDeliveryTime || 'Trong ngày (xe bảo quản lạnh)';

          // Tự động phân bổ kho phụ trách theo tên Quận / Huyện trong địa chỉ nhận hàng
          if (!orderData.warehouseId || orderData.warehouseId === 'store-thuduc') {
            const addrLower = (orderData.shippingAddress || '').toLowerCase();
            if (addrLower.includes('tân bình')) orderData.warehouseId = 'store-tanbinh';
            else if (addrLower.includes('quận 1') || addrLower.includes('q1') || addrLower.includes('q.1')) orderData.warehouseId = 'store-q1';
            else if (addrLower.includes('quận 7') || addrLower.includes('q7') || addrLower.includes('q.7')) orderData.warehouseId = 'store-q7';
            else if (addrLower.includes('bình thạnh')) orderData.warehouseId = 'store-binhthanh';
            else if (addrLower.includes('gò vấp')) orderData.warehouseId = 'store-govap';
            else if (addrLower.includes('bình tân')) orderData.warehouseId = 'store-binhtan';
            else if (addrLower.includes('dĩ an')) orderData.warehouseId = 'store-dian';
            else orderData.warehouseId = 'store-thuduc';
          }
        }
      } else if (orderData.shippingMethod === 'pickup') {
        finalShippingFee = 0;
        shippingDiscount = 0;
        estimatedDeliveryTime = orderData.estimatedDeliveryTime || (orderData.pickupStore?.name ? `Nhận tại: ${orderData.pickupStore.name}` : '30 phút (lấy tại cửa hàng)');
      }

      orderData.subtotal = serverSubtotal;
      orderData.shippingDistanceKm = distanceKm;
      orderData.estimatedDeliveryTime = estimatedDeliveryTime;
      orderData.pickupStore = orderData.pickupStore || null;
      orderData.deliveryTimeSlot = orderData.deliveryTimeSlot || '';
      orderData.deliveryType = orderData.deliveryType || '';
      const payableGoods = serverSubtotal;
      orderData.estimatedPoints = Math.floor(payableGoods / 1000);

      // 4. Khuyến mãi kép: Cho phép áp dụng song song 1 Voucher Đơn Hàng + 1 Voucher Miễn Phí Vận Chuyển
      let appliedOrderVoucher = null;
      let appliedShipVoucher = null;

      // 4a. Mã giảm giá đơn hàng / sản phẩm
      const customerPhone = orderData.guestPhone || req.user?.phone || '';
      const customerEmail = orderData.guestEmail || req.user?.email || '';
      const orderVoucherInput = orderData.voucherCode ? String(orderData.voucherCode).trim() : '';
      if (orderVoucherInput) {
        appliedOrderVoucher = await evaluateVoucher(orderVoucherInput, {
          subtotal: payableGoods,
          items: orderData.items,
          userId: req.user?._id,
          customerPhone,
          customerEmail,
          paymentMethod: orderData.paymentMethod,
          expectedVoucherType: 'ORDER_DISCOUNT',
        });
        if (!appliedOrderVoucher.valid) {
          return res.status(400).json({ success: false, message: appliedOrderVoucher.message });
        }
      }

      // 4b. Mã miễn phí / hỗ trợ vận chuyển (Freeship)
      const shipVoucherInput = orderData.shippingVoucherCode ? String(orderData.shippingVoucherCode).trim() : '';
      let shippingVoucherDiscount = 0;
      if (shipVoucherInput) {
        appliedShipVoucher = await evaluateVoucher(shipVoucherInput, {
          subtotal: payableGoods,
          items: orderData.items,
          userId: req.user?._id,
          customerPhone,
          customerEmail,
          paymentMethod: orderData.paymentMethod,
          expectedVoucherType: 'SHIPPING_DISCOUNT',
        });
        if (!appliedShipVoucher.valid) {
          return res.status(400).json({ success: false, message: appliedShipVoucher.message });
        }
        // Giảm trừ phí ship còn lại (tối đa bằng đúng phí ship, không âm)
        const voucherMaxDeduct = appliedShipVoucher.voucher.discountType === 'percentage'
          ? Math.floor((finalShippingFee * appliedShipVoucher.voucher.discountValue) / 100)
          : appliedShipVoucher.voucher.discountValue;
        shippingVoucherDiscount = Math.max(0, Math.min(voucherMaxDeduct, finalShippingFee));
        finalShippingFee -= shippingVoucherDiscount;
        shippingDiscount += shippingVoucherDiscount;
      }

      orderData.voucherCode = appliedOrderVoucher ? appliedOrderVoucher.voucher.code : '';
      orderData.discount    = appliedOrderVoucher ? appliedOrderVoucher.discount : 0;
      orderData.shippingVoucherCode = appliedShipVoucher ? appliedShipVoucher.voucher.code : '';
      orderData.shippingVoucherDiscount = shippingVoucherDiscount;
      orderData.shippingFee = finalShippingFee;
      orderData.shippingDiscount = shippingDiscount;

      // Hỗ trợ BOPIS (Buy Online, Pick-up In-Store): Miễn phí ship, khóa giữ hàng tối đa 24h tại quầy
      const isBopis = req.body.shippingMethod === 'pickup' || req.body.isBopis === true;
      if (isBopis) {
        orderData.shippingMethod = 'pickup';
        orderData.isBopis = true;
        orderData.shippingFee = 0;
        orderData.shippingDiscount = 0;
        orderData.pickupExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
        const pickupTarget = req.body.pickupStoreId || req.body.pickupStore?.id || req.body.storeId || orderData.warehouseId || 'store-thuduc';
        orderData.warehouseId = pickupTarget;
        orderData.storeId = pickupTarget;
        orderData.pickupStoreId = pickupTarget;
        if (!orderData.pickupStore || !orderData.pickupStore.name) {
          orderData.pickupStore = req.body.pickupStore || { id: pickupTarget, name: 'Chi nhánh Evergreen Mart' };
        }
      } else {
        const shipTarget = req.body.warehouseId || req.body.storeId || orderData.warehouseId || 'store-thuduc';
        orderData.warehouseId = shipTarget;
        orderData.storeId = shipTarget;
      }

      // 5. Server tự tính lại total: total = subtotal - discount + finalShippingFee
      orderData.total = Math.max(0, payableGoods - orderData.discount + (isBopis ? 0 : finalShippingFee));
      orderData.paymentStatus = 'unpaid';
      orderData.paymentExpiresAt = orderData.paymentMethod === 'bank_transfer'
        ? new Date(Date.now() + QR_PAYMENT_TTL_MS)
        : null;
      orderData.paidAt = null;
      orderData.paymentReference = '';
      orderData.inventoryDeducted = true;
      orderData.inventoryRestored = false;
      orderData.hasNonRefundableItems = detectedNonRefundableItems.length > 0;

      // Xử lý đơn Telesales / Tạo tại quầy bởi Nhân viên
      const isStaffUser = req.user && ['admin', 'manager', 'staff', 'sales', 'cskh', 'warehouse'].includes(req.user.role);
      const isTelesales = isStaffUser && (req.body.orderSource === 'telesales' || req.body.orderSource === 'pos');
      if (isTelesales) {
        orderData.orderSource = req.body.orderSource;
        orderData.createdByStaff = `${req.user.name || req.user.username} (${req.user.role})`;
        if (req.body.warehouseId || req.body.storeId) {
          orderData.warehouseId = req.body.warehouseId || req.body.storeId;
        }
        if (req.body.paymentStatus === 'paid') {
          orderData.paymentStatus = 'paid';
          orderData.paidAt = new Date();
        }
        if (req.body.status && ['pending', 'confirmed', 'delivered'].includes(req.body.status)) {
          orderData.status = req.body.status;
        }
      } else {
        orderData.orderSource = 'online';
      }
      orderData.nonRefundableAccepted = Boolean(orderData.nonRefundableAccepted || req.body.nonRefundableAccepted);
      orderData.nonRefundableItems = detectedNonRefundableItems;

      // 6. Kiểm tra & khấu trừ tồn kho nguyên tử (atomic) trên các sản phẩm vật lý để chống bán vượt khi nhiều khách đặt cùng lúc
      // Gom tổng số lượng cần dùng theo từng Product ID (bao gồm cả sản phẩm lẻ/mua kèm, gói combo và thành phần của mọi Combo trong giỏ)
      const requiredStockMap = new Map(); // prodId -> { totalQty, productName, reasons: string[] }
      for (const item of orderData.items) {
        if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
          const pid = String(item.product);
          const prev = requiredStockMap.get(pid) || { totalQty: 0, productName: item.productName, reasons: [] };
          prev.totalQty += item.quantity;
          prev.reasons.push(item.isCombo ? `Gói combo "${item.productName}"` : (item.itemType === 'addon' ? 'SP mua kèm' : 'SP mua lẻ'));
          requiredStockMap.set(pid, prev);
        }
        if (item.isCombo && Array.isArray(item.comboItems)) {
          for (const ci of item.comboItems) {
            if (!ci.product || !mongoose.Types.ObjectId.isValid(ci.product)) continue;
            const pid = String(ci.product);
            const need = Math.max(1, Number(ci.quantity) || 1) * item.quantity;
            const prev = requiredStockMap.get(pid) || { totalQty: 0, productName: ci.name, reasons: [] };
            prev.totalQty += need;
            prev.reasons.push(`Thành phần combo "${item.productName}" x${item.quantity}`);
            requiredStockMap.set(pid, prev);
          }
        }
      }

      const sortedRequiredEntries = Array.from(requiredStockMap.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      );

      // 5.5 Kiểm tra định mức chống đầu cơ gom hàng số lượng lớn (Anti-Hoarding Quota)
      const userPhone = req.user?.phone || orderData.guestPhone || '';
      const userId = req.user?._id;
      const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);

      for (const [pid, reqInfo] of sortedRequiredEntries) {
        const prod = await Product.findById(pid).select('name maxPurchaseQuotaPerDay').lean();
        if (prod && prod.maxPurchaseQuotaPerDay > 0) {
          const quota = prod.maxPurchaseQuotaPerDay;
          if (reqInfo.totalQty > quota) {
            return res.status(400).json({
              success: false,
              message: `Sản phẩm "${prod.name}" đang trợ giá sốc, giới hạn mỗi khách tối đa ${quota} phần/ngày. Bạn đang đặt ${reqInfo.totalQty} phần, vượt quá định mức cho phép!`,
            });
          }

          const pastFilter = {
            createdAt: { $gte: oneDayAgo },
            status: { $ne: 'cancelled' },
            $or: [
              ...(userId ? [{ user: userId }] : []),
              ...(userPhone ? [{ guestPhone: userPhone }] : []),
            ],
          };

          if (pastFilter.$or.length > 0) {
            const pastOrders = await Order.find(pastFilter).select('items').lean();
            let pastQty = 0;
            for (const po of pastOrders) {
              for (const it of po.items || []) {
                if (String(it.product) === pid) {
                  pastQty += it.quantity;
                }
              }
            }
            if (pastQty + reqInfo.totalQty > quota) {
              return res.status(400).json({
                success: false,
                message: `Sản phẩm "${prod.name}" giới hạn tối đa ${quota} phần/ngày. Bạn đã mua ${pastQty} phần trong 24h qua, không thể mua thêm ${reqInfo.totalQty} phần!`,
              });
            }
          }
        }
      }

      // 5.6 Kiểm tra tồn kho khả dụng tại Chi nhánh được chỉ định (O2O Store Check)
      const targetStoreId = orderData.warehouseId || orderData.pickupStoreId || orderData.storeId || req.body.warehouseId || req.body.pickupStoreId || null;
      const isStoreSpecific = Boolean(targetStoreId && targetStoreId !== 'all' && targetStoreId !== 'ALL');

      if (isStoreSpecific) {
        for (const [pid, reqInfo] of sortedRequiredEntries) {
          const storeInv = await StoreInventory.findOne({ storeId: targetStoreId, productId: pid }).lean();
          if (storeInv) {
            const phys = storeInv.physicalStock ?? 0;
            const resv = storeInv.reservedStock ?? 0;
            const buff = storeInv.safetyBuffer ?? 0;
            const availInStore = Math.max(0, phys - resv - buff);
            if (availInStore < reqInfo.totalQty) {
              const storeName = storeInv.storeName || targetStoreId;
              const prodLabel = reqInfo.productName || 'Sản phẩm';
              return res.status(400).json({
                success: false,
                message: `Chi nhánh [${storeName}] hiện chỉ còn ${availInStore} "${prodLabel}" khả dụng cho kênh Online (yêu cầu ${reqInfo.totalQty}, đệm an toàn quầy POS: ${buff}). Vui lòng chọn chi nhánh khác hoặc giảm số lượng.`
              });
            }
          }
        }
      }

      const deductedReservations = []; // Array<{ pid, qty, oldStock, newStock, productName, reasons }>

      for (const [pid, reqInfo] of sortedRequiredEntries) {
        const prevDoc = await Product.findOneAndUpdate(
          {
            _id: new mongoose.Types.ObjectId(pid),
            isActive: { $ne: false },
            $expr: {
              $gte: [
                { $subtract: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$safetyBuffer', 0] }] },
                reqInfo.totalQty,
              ],
            },
          },
          { $inc: { stock: -reqInfo.totalQty } },
          { new: false }
        );

        if (!prevDoc) {
          // Hoàn lại ngay các sản phẩm đã tạm trừ trong cùng request nếu có 1 thành phần thiếu hàng
          for (const r of deductedReservations) {
            await Product.findByIdAndUpdate(r.pid, { $inc: { stock: r.qty } });
          }
          const curProd = await Product.findById(pid).select('name stock safetyBuffer isActive').lean();
          const stock = curProd?.stock ?? 0;
          const buffer = curProd?.safetyBuffer ?? 0;
          const avail = Math.max(0, stock - buffer);
          const prodLabel = curProd?.name || reqInfo.productName || 'Sản phẩm';
          const viaCombo = reqInfo.reasons.some((rs) => rs.startsWith('Combo '));
          const msg = avail <= 0 && stock > 0
            ? `Sản phẩm "${prodLabel}" hiện đã đạt ngưỡng giữ hàng tại quầy siêu thị (còn ${stock} sản phẩm dự trữ an toàn cho khách mua trực tiếp).`
            : viaCombo
            ? `Sản phẩm thành phần "${prodLabel}" (${reqInfo.reasons.join(', ')}) không đủ tồn kho khả dụng online (cần ${reqInfo.totalQty}, khả dụng online ${avail}).`
            : `Sản phẩm "${prodLabel}" không đủ tồn kho khả dụng online (cần ${reqInfo.totalQty}, khả dụng online ${avail}).`;
          return res.status(400).json({
            success: false,
            message: msg,
          });
        }

        const oldStock = Math.max(0, Number(prevDoc.stock ?? 0));
        deductedReservations.push({
          pid,
          qty: reqInfo.totalQty,
          oldStock,
          newStock: Math.max(0, oldStock - reqInfo.totalQty),
          productName: prevDoc.name || reqInfo.productName,
          reasons: reqInfo.reasons,
        });
      }

      let order = null;
      try {
        orderData.statusHistory = [{
          status: orderData.status || 'pending',
          updatedBy: isStaffUser ? `${req.user.name || req.user.username} (${req.user.role})` : (orderData.guestName || (req.user ? req.user.name : 'Khách hàng')),
          role: req.user?.role || 'Customer',
          note: isTelesales ? `Nhân viên tạo đơn ${orderData.orderSource === 'telesales' ? 'Telesales' : 'tại quầy'}` : 'Đặt hàng thành công trên hệ thống',
          updatedAt: new Date(),
        }];
        order = await Order.create(orderData);
        // O2O: Tự động tăng reservedStock (tồn kho tạm giữ) tại cửa hàng được giao đơn
        const assignedStoreId = order.warehouseId || order.pickupStore?.id || order.pickupStoreId || order.storeId || req.body.warehouseId || req.body.pickupStore?.id || req.body.pickupStoreId || req.body.storeId || 'store-thuduc';
        for (const r of deductedReservations) {
          await StoreInventory.findOneAndUpdate(
            { storeId: assignedStoreId, productId: r.pid },
            { $inc: { physicalStock: -r.qty, reservedStock: r.qty } },
            { upsert: false }
          );
          await Product.findByIdAndUpdate(r.pid, { $inc: { reservedStock: r.qty } });

          // Kế toán: Ghi nhận nhật ký giữ hàng cho đơn đặt online
          InventoryLog.create({
            product: r.pid,
            productName: r.productName,
            type: 'order_confirmed',
            storeId: assignedStoreId,
            referenceId: order.orderCode || String(order._id),
            delta: -r.qty,
            oldStock: r.oldStock,
            newStock: r.newStock,
            reason: `Đơn hàng [${order.orderCode || order._id}]: Tạm giữ ${r.qty} sản phẩm tại kho để đóng gói giao hàng`,
            note: r.reasons ? r.reasons.join(', ') : '',
          }).catch(() => {});
        }

        // Tự động đồng bộ địa chỉ giao hàng vào Sổ địa chỉ (User.addresses) của khách hàng
        if (order.user) {
          try {
            const customer = await User.findById(order.user);
            if (customer) {
              const addrText = String(order.shippingAddress || '').trim();
              if (addrText && order.shippingMethod !== 'pickup') {
                if (!Array.isArray(customer.addresses)) customer.addresses = [];
                const coords = order.shippingCoordinates || {};
                const exists = customer.addresses.some(
                  (a) => a.address && (a.address === addrText || addrText.includes(a.address))
                );
                if (!exists) {
                  // Đặt địa chỉ vừa mua hàng làm mặc định trong Sổ địa chỉ
                  customer.addresses = customer.addresses.map((a) => ({
                    ...a.toObject(),
                    isDefault: false,
                  }));
                  customer.addresses.push({
                    label: 'Địa chỉ nhận hàng',
                    fullName: order.guestName || customer.name || 'Khách hàng',
                    phone: order.guestPhone || customer.phone || '',
                    address: addrText,
                    city: 'TP. Hồ Chí Minh',
                    province: '',
                    ward: '',
                    lat: typeof coords.lat === 'number' ? coords.lat : null,
                    lng: typeof coords.lng === 'number' ? coords.lng : null,
                    isDefault: true,
                  });
                  await customer.save();
                }
              }
            }
          } catch (addrErr) {
            console.error('Lỗi tự động lưu sổ địa chỉ từ đơn hàng:', addrErr);
          }
        }
        // Đánh dấu giỏ hàng đã chuyển đổi thành công (Converted)
        const sessId = req.sessionID || req.headers['x-session-id'];
        Cart.updateMany(
          {
            $or: [
              ...(req.user?._id ? [{ customerId: req.user._id }] : []),
              ...(sessId ? [{ sessionId: sessId }] : []),
            ],
            status: 'Active',
          },
          { $set: { status: 'Converted', convertedOrderId: order._id, lastUpdatedAt: new Date() } }
        ).catch(() => {});
        if (appliedOrderVoucher) await consumeVoucher(appliedOrderVoucher, req.user?._id, order._id);
        if (appliedShipVoucher) await consumeVoucher(appliedShipVoucher, req.user?._id, order._id);
      } catch (createErr) {
        for (const r of deductedReservations) {
          await Product.findByIdAndUpdate(r.pid, { $inc: { stock: r.qty } });
        }
        throw createErr;
      }

      // Ghi nhận lịch sử trừ kho cho từng sản phẩm vật lý đã xuất
      for (const r of deductedReservations) {
        const viaCombo = r.reasons.some((rs) => rs.startsWith('Combo '));
        await InventoryLog.create({
          product: new mongoose.Types.ObjectId(r.pid),
          productName: r.productName,
          type: 'order_confirmed',
          storeId: assignedStoreId,
          referenceId: order.orderCode || String(order._id),
          delta: -r.qty,
          oldStock: r.oldStock,
          newStock: r.newStock,
          reason: viaCombo
            ? `Đơn hàng ${order.orderCode} (${r.reasons.join('; ')})`
            : `Đơn hàng ${order.orderCode}`,
          note: viaCombo ? 'Trừ kho thành phần Combo khi đặt hàng' : 'Trừ kho khi tạo đơn hàng',
          updatedBy: req.user?._id || null,
        });
      }

      // Thông báo thời gian thực cho nhân viên Sales / Admin khi có đơn hàng mới
      sendRealtimeNotification({
        recipientRole: 'sales',
        title: `Đơn hàng mới #${order.orderCode}`,
        body: `Khách hàng ${order.customerName} vừa đặt đơn hàng trị giá ${order.total.toLocaleString('vi-VN')}đ.`,
        type: 'order',
        path: '/admin/orders',
        orderId: order._id,
      });

      // Cảnh báo tồn kho thời gian thực cho Thủ kho / Admin nếu chạm ngưỡng cảnh báo
      for (const r of deductedReservations) {
        if (r.newStock <= 5) {
          sendRealtimeNotification({
            recipientRole: 'warehouse',
            title: `Cảnh báo tồn kho thấp: ${r.productName}`,
            body: `Sản phẩm "${r.productName}" vừa chạm ngưỡng cảnh báo, chỉ còn ${r.newStock} sản phẩm trong kho!`,
            type: 'inventory',
            path: '/admin/inventory',
          });
        }
      }

      // Gửi email xác nhận đặt hàng thành công tự động bất đồng bộ
      sendOrderConfirmationEmail(order);

      // 5. Tạo link VietQR nếu phương thức là bank_transfer
      const vietQr = order.paymentMethod === 'bank_transfer'
        ? buildVietQrPayload(order)
        : { qrUrl: null, bankInfo: null };

      if (typeof clearDashboardCache === 'function') clearDashboardCache();
      if (typeof clearCache === 'function') clearCache();

      res.status(201).json({
        success: true,
        orderCode: order.orderCode,
        total: order.total,
        paymentStatus: order.paymentStatus,
        paymentExpiresAt: order.paymentExpiresAt,
        qrUrl: vietQr.qrUrl,
        data: {
          orderCode: order.orderCode,
          _id: order._id,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          paymentExpiresAt: order.paymentExpiresAt,
          discount: order.discount,
          comboDiscount: order.comboDiscount || 0,
          addonDiscount: order.addonDiscount || 0,
          total: order.total,
          qrUrl: vietQr.qrUrl,
          bankInfo: vietQr.bankInfo,
        },
      });
    } catch (err) { next(err); }
  }
);

async function attachComboDetailsToOrders(orders) {
  if (!orders) return orders;
  const isArray = Array.isArray(orders);
  const list = isArray ? orders : [orders];

  for (const o of list) {
    if (!o || !Array.isArray(o.items)) continue;

    for (const it of o.items) {
      if (!it) continue;

      // Ưu tiên giữ nguyên snapshot comboItems đã lưu tại thời điểm đặt hàng (Admin sửa Combo sau đó không làm đổi đơn hàng cũ)
      if (Array.isArray(it.comboItems) && it.comboItems.length > 0) {
        it.isCombo = true;
        const basePrice = typeof it.priceNumber === 'number' ? it.priceNumber : Number(it.priceNumber || 0);
        const subSum = it.comboItems.reduce(
          (sum, ci) => sum + (Number(ci.priceNumber) || 0) * Math.max(1, Number(ci.quantity) || 1),
          0
        );
        if (!it.originalPriceNumber && subSum > basePrice) {
          it.originalPriceNumber = subSum;
        }
        if (!it.comboSaving && it.originalPriceNumber > basePrice) {
          it.comboSaving = Math.max(0, (it.originalPriceNumber - basePrice) * (it.quantity || 1));
        }
        continue;
      }

      // Chỉ fallback truy vấn Product đối với các đơn hàng cũ trước khi có snapshot comboItems
      if (!it.isCombo) continue;

      let prod = null;
      if (it.product && mongoose.Types.ObjectId.isValid(it.product)) {
        prod = await Product.findById(it.product)
          .populate('comboItems.product', 'name price priceNumber image weight unit slug')
          .lean();
      }
      if (!prod && it.productName) {
        prod = await Product.findOne({ name: it.productName })
          .populate('comboItems.product', 'name price priceNumber image weight unit slug')
          .lean();
      }

      if (prod && prod.isCombo && Array.isArray(prod.comboItems) && prod.comboItems.length > 0) {
        const comboSubItems = [];
        let subSum = 0;
        for (const ci of prod.comboItems) {
          const subP = ci.product || ci;
          const priceNum = typeof subP.priceNumber === 'number' ? subP.priceNumber : Number(subP.priceNumber || 0);
          const singleQty = ci.quantity || 1;
          subSum += priceNum * singleQty;
          comboSubItems.push({
            product: subP._id ? String(subP._id) : '',
            name: subP.name || 'Sản phẩm thành phần',
            image: subP.image || '',
            price: subP.price || '',
            priceNumber: priceNum,
            quantity: singleQty,
            unit: subP.unit || '',
            weight: subP.weight || '',
          });
        }
        it.comboItems = comboSubItems;
        const basePrice = typeof it.priceNumber === 'number' ? it.priceNumber : Number(it.priceNumber || 0);
        const retail = subSum > basePrice ? subSum : basePrice;
        if (!it.originalPriceNumber) it.originalPriceNumber = retail;
        if (!it.comboSaving) it.comboSaving = Math.max(0, (retail - basePrice) * (it.quantity || 1));
      }
    }
  }

  return orders;
}


// ── O2O: GIẢI PHÓNG RESERVED STOCK VÀ HOÀN TẤT XUẤT KHO KHI GIAO HÀNG THÀNH CÔNG ──
async function releaseAndDeductStoreInventory(order) {
  if (!order || !Array.isArray(order.items)) return;
  const storeId = order.warehouseId || order.pickupStore?.id || order.pickupStoreId || order.storeId || 'store-thuduc';

  for (const item of order.items) {
    if (item.product) {
      const pid = String(item.product);
      const qty = item.quantity;
      await StoreInventory.findOneAndUpdate(
        { storeId, productId: pid },
        { $inc: { reservedStock: -qty } }
      );
      await Product.findByIdAndUpdate(pid, { $inc: { reservedStock: -qty } });
    }
    if (item.isCombo && Array.isArray(item.comboItems) && item.comboItems.length > 0) {
      for (const ci of item.comboItems) {
        const pid = ci.product ? String(ci.product) : '';
        if (!pid) continue;
        const qty = Math.max(1, Number(ci.quantity) || 1) * item.quantity;
        await StoreInventory.findOneAndUpdate(
          { storeId, productId: pid },
          { $inc: { reservedStock: -qty } }
        );
        await Product.findByIdAndUpdate(pid, { $inc: { reservedStock: -qty } });
      }
    }
  }
}

async function restoreOrderInventoryOnce(orderId, updatedBy = null) {
  if (!orderId) return false;
  // Khóa nguyên tử cờ inventoryRestored để đảm bảo chỉ hoàn kho đúng 1 lần duy nhất
  const lockedOrder = await Order.findOneAndUpdate(
    { _id: orderId, inventoryRestored: { $ne: true } },
    { $set: { inventoryRestored: true } },
    { new: true }
  );
  if (!lockedOrder || !Array.isArray(lockedOrder.items)) return false;

  const restoreMap = new Map(); // prodId -> { totalQty, productName, reasons: string[] }
  for (const item of lockedOrder.items) {
    if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
      const pid = String(item.product);
      const prev = restoreMap.get(pid) || { totalQty: 0, productName: item.productName, reasons: [] };
      prev.totalQty += item.quantity;
      restoreMap.set(pid, prev);
    }
    if (item.isCombo && Array.isArray(item.comboItems) && item.comboItems.length > 0) {
      for (const ci of item.comboItems) {
        const pid = ci.product ? String(ci.product) : '';
        if (!pid || !mongoose.Types.ObjectId.isValid(pid)) continue;
        const addQty = Math.max(1, Number(ci.quantity) || 1) * item.quantity;
        const prev = restoreMap.get(pid) || { totalQty: 0, productName: ci.name || 'SP thành phần', reasons: [] };
        prev.totalQty += addQty;
        prev.reasons.push(`Combo "${item.productName}" x${item.quantity}`);
        restoreMap.set(pid, prev);
      }
    }
  }

  for (const [pid, info] of restoreMap.entries()) {
    const prevDoc = await Product.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(pid) },
      { $inc: { stock: info.totalQty } },
      { new: false }
    );
    if (!prevDoc) continue;
    const targetStoreId = lockedOrder.warehouseId || lockedOrder.storeId || 'default';
    await StoreInventory.findOneAndUpdate(
      { storeId: targetStoreId, productId: pid },
      { $inc: { reservedStock: -info.totalQty, physicalStock: info.totalQty } }
    );
    await Product.findByIdAndUpdate(pid, { $inc: { reservedStock: -info.totalQty } });

    const oldStock = Math.max(0, Number(prevDoc.stock ?? 0));
    const newStock = oldStock + info.totalQty;
    await InventoryLog.create({
      product: prevDoc._id,
      productName: prevDoc.name || info.productName,
      type: 'order_cancel',
      delta: info.totalQty,
      oldStock,
      newStock,
      reason: info.reasons.length > 0
        ? `Hủy đơn ${lockedOrder.orderCode} (${info.reasons.join('; ')})`
        : `Hủy đơn ${lockedOrder.orderCode}`,
      note: 'Hoàn tồn tự động đúng 1 lần khi đơn hàng bị hủy',
      updatedBy: updatedBy || null,
    });
  }

  return true;
}

// GET /api/orders - admin & sales & support: all orders with filters
router.get('/', protect, staffOnly, cacheMiddleware(10), async (req, res, next) => {
  try {
    const { status, paymentMethod, paymentStatus, shippingMethod, page = 1, limit = 20, search, startDate, endDate, user, userId, warehouseId, storeId } = req.query;
    const filterConditions = [];
    if (user || userId) filterConditions.push({ user: user || userId });
    if (status && status !== 'all') filterConditions.push({ status });
    if (paymentMethod && paymentMethod !== 'all') filterConditions.push({ paymentMethod });
    if (paymentStatus && paymentStatus !== 'all') {
      if (paymentStatus === 'unpaid') {
        filterConditions.push({ paymentStatus: { $in: ['pending', 'unpaid'] } });
      } else {
        filterConditions.push({ paymentStatus });
      }
    }
    if (shippingMethod && shippingMethod !== 'all') filterConditions.push({ shippingMethod });

    // Scope đơn hàng theo đúng chi nhánh của Store Manager
    const scopedStore = getScopedStoreId(req) || warehouseId || storeId;
    let storeScopeFilter = {};
    if (scopedStore && scopedStore !== 'all' && scopedStore !== 'ALL') {
      storeScopeFilter = { warehouseId: scopedStore };
      filterConditions.push(storeScopeFilter);
    }

    if (search) {
      filterConditions.push({
        $or: [
          { orderCode: { $regex: search, $options: 'i' } },
          { guestName:  { $regex: search, $options: 'i' } },
          { guestEmail: { $regex: search, $options: 'i' } },
          { guestPhone: { $regex: search, $options: 'i' } },
        ]
      });
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filterConditions.push({ createdAt: { $gte: start, $lte: end } });
    }

    const finalFilter = filterConditions.length > 0 ? { $and: filterConditions } : {};

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total, statusAgg, allTotal, pendingQrTotal] = await Promise.all([
      Order.find(finalFilter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
        .populate('user', 'name email phone').lean(),
      Order.countDocuments(finalFilter),
      Order.aggregate([
        ...(Object.keys(storeScopeFilter).length > 0 ? [{ $match: storeScopeFilter }] : []),
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Order.countDocuments(storeScopeFilter),
      Order.countDocuments({
        ...storeScopeFilter,
        paymentMethod: 'bank_transfer',
        paymentStatus: { $in: ['pending', 'unpaid'] },
        status: { $nin: ['cancelled', 'delivered'] },
      }),
    ]);

    const statusCounts = { all: allTotal, pendingQr: pendingQrTotal };
    for (const item of statusAgg) {
      if (item._id) {
        statusCounts[item._id] = item.count;
      }
    }

    await Promise.all(orders.map((o) => expireUnpaidQrOrderIfNeeded(o)));
    await attachComboDetailsToOrders(orders);
    res.json({
      success: true,
      total,
      page: Number(page),
      data: orders,
      statusCounts,
      scopedStore: scopedStore || 'all'
    });
  } catch (err) { next(err); }
});

// GET /api/orders/pending-qr - Lấy danh sách các đơn hàng VietQR đang chờ duyệt thanh toán khẩn cấp (thông báo tức thì cho nhân viên)
router.get('/pending-qr', protect, staffOnly, async (req, res, next) => {
  try {
    const filter = {
      paymentMethod: 'bank_transfer',
      paymentStatus: { $in: ['pending', 'unpaid'] },
      status: 'pending',
    };
    if (req.user && req.user.role !== 'admin' && req.user.assignedStore && req.user.assignedStore !== 'all') {
      filter.$or = [
        { warehouseId: req.user.assignedStore },
        { pickupStoreId: req.user.assignedStore },
      ];
    }
    const orders = await Order.find(filter)
      .select('orderCode guestName guestPhone total paymentMethod paymentStatus status paymentExpiresAt createdAt warehouseId pickupStoreId items shippingAddress shippingMethod')
      .sort({ createdAt: -1 })
      .lean();

    const validOrders = [];
    for (const ord of orders) {
      await expireUnpaidQrOrderIfNeeded(ord);
      if (ord.status === 'pending' && (ord.paymentStatus || 'unpaid') === 'unpaid') {
        validOrders.push(ord);
      }
    }

    res.json({
      success: true,
      count: validOrders.length,
      data: validOrders,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/track/:code - public order tracking
router.get('/track/:code', async (req, res, next) => {
  try {
    const order = await Order.findOne(buildOrderLookupQuery(req.params.code))
      .populate('items.product', 'name image')
      .lean();
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await expireUnpaidQrOrderIfNeeded(order);
    await attachComboDetailsToOrders(order);
    attachPaymentQrMetadata(order);
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// GET /api/orders/:code/payment-status - kiểm tra trạng thái thanh toán VietQR (dùng cho polling màn hình QR)
router.get('/:code/payment-status', async (req, res, next) => {
  try {
    const order = await Order.findOne(buildOrderLookupQuery(req.params.code)).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    await expireUnpaidQrOrderIfNeeded(order);
    const qrPayload =
      order.paymentMethod === 'bank_transfer' &&
      (order.paymentStatus || 'unpaid') === 'unpaid' &&
      order.status === 'pending'
        ? buildVietQrPayload(order)
        : { qrUrl: null, bankInfo: null };

    res.json({
      success: true,
      data: {
        _id: order._id,
        orderCode: order.orderCode,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus || 'unpaid',
        paymentExpiresAt: order.paymentExpiresAt || null,
        paidAt: order.paidAt || null,
        total: order.total,
        qrUrl: qrPayload.qrUrl,
        bankInfo: qrPayload.bankInfo,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/orders/webhook/vietqr - Webhook nhận biến động giao dịch từ SePay / Casso

// POST /api/orders/webhook/vnpay - Webhook tiếp nhận IPN từ cổng VNPay (Kiểm tra HMAC-SHA512)
router.post('/webhook/vnpay', async (req, res, next) => {
  try {
    const vnpParams = { ...req.body, ...req.query };
    const secureHash = vnpParams.vnp_SecureHash || '';
    delete vnpParams.vnp_SecureHash;
    delete vnpParams.vnp_SecureHashType;

    // Sắp xếp params theo thứ tự alphabet
    const sortedKeys = Object.keys(vnpParams).sort();
    const signData = sortedKeys.map(k => `${k}=${encodeURIComponent(vnpParams[k]).replace(/%20/g, '+')}`).join('&');

    const vnpSecret = process.env.VNPAY_HASH_SECRET || 'vnpay_secret_key';
    const hmac = crypto.createHmac('sha512', vnpSecret);
    const calculatedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash && secureHash.toLowerCase() !== calculatedHash.toLowerCase()) {
      return res.status(400).json({ RspCode: '97', Message: 'Invalid Checksum' });
    }

    const orderCode = vnpParams.vnp_TxnRef;
    const responseCode = vnpParams.vnp_ResponseCode; // '00' là thành công

    const order = await Order.findOne({ orderCode });
    if (!order) {
      return res.status(404).json({ RspCode: '01', Message: 'Order not found' });
    }

    if (responseCode === '00') {
      order.paymentStatus = 'paid';
      order.paidAt = new Date();
      order.paymentReference = vnpParams.vnp_TransactionNo || 'VNPAY_TXN';
      if (order.status === 'pending') order.status = 'confirmed';
      if (!order.statusHistory) order.statusHistory = [];
      order.statusHistory.push({
        status: order.status,
        updatedBy: 'Cổng thanh toán VNPay',
        role: 'Gateway',
        note: `Thanh toán trực tuyến thành công qua VNPay (Mã GD: ${vnpParams.vnp_TransactionNo || ''})`,
        updatedAt: new Date(),
      });
      await order.save();
      return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    } else {
      // Thanh toán thất bại hoặc hủy -> Hủy đơn và hoàn tồn kho
      order.paymentStatus = 'unpaid';
      order.status = 'cancelled';
      if (!order.statusHistory) order.statusHistory = [];
      order.statusHistory.push({
        status: 'cancelled',
        updatedBy: 'Cổng thanh toán VNPay',
        role: 'Gateway',
        note: `Giao dịch VNPay thất bại hoặc bị hủy (Response code: ${responseCode})`,
        updatedAt: new Date(),
      });
      await order.save();
      await restoreOrderInventoryOnce(order._id, null);
      await restoreOrderVoucherOnce(order);
      await handleFlashSaleOrderCancelled(order);
      return res.status(200).json({ RspCode: '00', Message: 'Order Cancelled due to failed payment' });
    }
  } catch (err) { next(err); }
});

// POST /api/orders/webhook/momo - Webhook tiếp nhận IPN từ ví MoMo (Kiểm tra HMAC-SHA256)
router.post('/webhook/momo', async (req, res, next) => {
  try {
    const { partnerCode, orderId, requestId, amount, orderInfo, orderType, transId, resultCode, message, payType, responseTime, extraData, signature } = req.body;

    const rawSignature = `accessKey=${process.env.MOMO_ACCESS_KEY || ''}&amount=${amount}&extraData=${extraData || ''}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType || ''}&partnerCode=${partnerCode}&payType=${payType || ''}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
    const secretKey = process.env.MOMO_SECRET_KEY || 'momo_secret_key';
    const computedSignature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

    if (signature && signature !== computedSignature && process.env.NODE_ENV === 'production') {
      return res.status(400).json({ message: 'Invalid MoMo Signature' });
    }

    const order = await Order.findOne({ $or: [{ orderCode: orderId }, { _id: mongoose.Types.ObjectId.isValid(orderId) ? orderId : null }] });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (Number(resultCode) === 0) {
      order.paymentStatus = 'paid';
      order.paidAt = new Date();
      order.paymentReference = String(transId || 'MOMO_TXN');
      if (order.status === 'pending') order.status = 'confirmed';
      if (!order.statusHistory) order.statusHistory = [];
      order.statusHistory.push({
        status: order.status,
        updatedBy: 'Ví điện tử MoMo',
        role: 'Gateway',
        note: `Thanh toán trực tuyến thành công qua ví MoMo (Mã GD: ${transId})`,
        updatedAt: new Date(),
      });
      await order.save();
    } else {
      order.paymentStatus = 'unpaid';
      order.status = 'cancelled';
      if (!order.statusHistory) order.statusHistory = [];
      order.statusHistory.push({
        status: 'cancelled',
        updatedBy: 'Ví điện tử MoMo',
        role: 'Gateway',
        note: `Giao dịch MoMo thất bại (Result code: ${resultCode} - ${message})`,
        updatedAt: new Date(),
      });
      await order.save();
      await restoreOrderInventoryOnce(order._id, null);
      await restoreOrderVoucherOnce(order);
      await handleFlashSaleOrderCancelled(order);
    }

    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/webhook/vietqr', async (req, res, next) => {
  try {
    const webhookSecret = (process.env.VIETQR_WEBHOOK_SECRET || '').trim();
    if (webhookSecret) {
      const authHeader = String(req.headers.authorization || '');
      const headerSecret = String(req.headers['x-webhook-secret'] || '');
      const bearerToken = authHeader.replace(/^(Apikey|Bearer)\s+/i, '').trim();
      if (headerSecret !== webhookSecret && bearerToken !== webhookSecret) {
        return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
      }
    }

    const bodyData = req.body || {};
    const rawContent = String(bodyData.content || bodyData.description || bodyData.addInfo || '');
    const transferAmount = Number(bodyData.transferAmount ?? bodyData.amount ?? 0);
    const reference = String(bodyData.referenceCode || bodyData.id || bodyData.transactionId || '');

    const codeMatch = rawContent.match(/XL-?\d{5,8}/i);
    if (!codeMatch) {
      return res.json({ success: false, message: 'Không tìm thấy mã đơn hàng trong nội dung chuyển khoản.' });
    }

    const order = await Order.findOne(buildOrderLookupQuery(codeMatch[0]));
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng khớp mã.' });
    }

    await expireUnpaidQrOrderIfNeeded(order);
    if (order.status === 'cancelled' || order.paymentStatus === 'expired') {
      return res.status(400).json({ success: false, message: 'Đơn hàng đã hết hạn hoặc bị hủy.' });
    }
    if (order.paymentStatus === 'paid') {
      return res.json({ success: true, message: 'Đơn hàng đã được thanh toán trước đó.', data: order });
    }
    if (transferAmount < Number(order.total || 0)) {
      return res.status(400).json({
        success: false,
        message: `Số tiền chuyển (${transferAmount}) nhỏ hơn tổng đơn hàng (${order.total}).`,
      });
    }

    const updated = await markQrOrderAsPaid(order, { reference, autoConfirm: true });
    res.json({ success: true, message: 'Xác nhận thanh toán tự động thành công.', data: updated });
  } catch (err) { next(err); }
});

// POST /api/orders/:code/confirm-payment - Admin/nhân viên xác nhận đã nhận tiền chuyển khoản VietQR
router.post('/:code/confirm-payment', protect, staffOnly, async (req, res, next) => {
  try {
    const userRole = (req.user?.role || req.session?.employee?.role || '').toLowerCase();
    if (userRole === 'warehouse') {
      return res.status(403).json({
        success: false,
        message: 'Nhân viên kho không có thẩm quyền đối soát và duyệt thanh toán ngân hàng VietQR.'
      });
    }

    const order = await Order.findOne(buildOrderLookupQuery(req.params.code));
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    await expireUnpaidQrOrderIfNeeded(order);
    if (order.status === 'cancelled' || order.paymentStatus === 'expired') {
      return res.status(400).json({ success: false, message: 'Đơn hàng đã hết hạn thanh toán hoặc đã bị hủy.' });
    }

    const updated = await markQrOrderAsPaid(order, {
      reference: String(req.body?.reference || 'ADMIN_CONFIRMED'),
      autoConfirm: true,
    });

    res.json({
      success: true,
      message: 'Xác nhận thanh toán thành công.',
      data: updated,
    });
  } catch (err) { next(err); }
});

// GET /api/orders/my-orders & GET /api/orders/my - get current user's orders
const handleMyOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const userId = req.user._id;
    const userEmail = req.user.email;
    const rawPhone = String(req.user.phone || '').trim().replace(/[\s\-.()]/g, '');
    const normPhone = rawPhone.startsWith('+84')
      ? '0' + rawPhone.slice(3)
      : rawPhone.startsWith('84') && rawPhone.length >= 11
      ? '0' + rawPhone.slice(2)
      : rawPhone;
    const phoneVariants = normPhone && /^0\d{9}$/.test(normPhone)
      ? Array.from(new Set([normPhone, '+84' + normPhone.slice(1), '84' + normPhone.slice(1)]))
      : [];

    const filter = {
      $or: [
        { user: userId },
        ...(userEmail ? [{ user: null, guestEmail: userEmail }, { user: { $exists: false }, guestEmail: userEmail }] : []),
        ...(phoneVariants.length > 0 ? [
          { user: null, guestPhone: { $in: phoneVariants } },
          { user: { $exists: false }, guestPhone: { $in: phoneVariants } },
        ] : [])
      ]
    };
    if (status && status !== 'all') filter.status = status;
    if (search) filter.orderCode = { $regex: search, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Order.countDocuments(filter),
    ]);
    await Promise.all(orders.map((o) => expireUnpaidQrOrderIfNeeded(o)));
    await attachComboDetailsToOrders(orders);
    res.json({ success: true, total, page: Number(page), data: orders });
  } catch (err) { next(err); }
};

router.get('/my-orders', protect, handleMyOrders);
router.get('/my', protect, handleMyOrders);

// GET /api/orders/export/excel - Xuất báo cáo đơn hàng Excel (.xlsx) cho kế toán đối soát
router.get('/export/excel', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate, status, paymentMethod, search } = req.query;
    const filter = {};

    const scopedStore = getScopedStoreId(req);
    if (scopedStore && scopedStore !== 'all' && scopedStore !== 'ALL') {
      filter.warehouseId = scopedStore;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    if (search) {
      filter.$or = [
        { orderCode: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { guestPhone: { $regex: search, $options: 'i' } },
        { guestEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).populate('user', 'name email phone').lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Xanh Lá Mart';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Báo Cáo Đơn Hàng', {
      views: [{ showGridLines: true }],
    });

    sheet.columns = [
      { header: 'MÃ ĐƠN HÀNG', key: 'orderCode', width: 16 },
      { header: 'THỜI GIAN ĐẶT', key: 'createdAt', width: 22 },
      { header: 'KHÁCH HÀNG', key: 'customerName', width: 24 },
      { header: 'SỐ ĐIỆN THOẠI', key: 'phone', width: 16 },
      { header: 'ĐỊA CHỈ GIAO HÀNG', key: 'address', width: 36 },
      { header: 'CHI TIẾT MÓN', key: 'itemsSummary', width: 38 },
      { header: 'TIỀN HÀNG (VNĐ)', key: 'goodsAmount', width: 18 },
      { header: 'GIẢM GIÁ (VNĐ)', key: 'discount', width: 16 },
      { header: 'PHÍ SHIP (VNĐ)', key: 'shippingFee', width: 16 },
      { header: 'TỔNG CỘNG (VNĐ)', key: 'total', width: 18 },
      { header: 'HÌNH THỨC TT', key: 'paymentMethod', width: 22 },
      { header: 'TRẠNG THÁI TT', key: 'paymentStatus', width: 18 },
      { header: 'TRẠNG THÁI ĐƠN', key: 'status', width: 20 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E4226' }, // Xanh Lá Dark Green
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const statusMap = {
      pending: 'Chờ xử lý',
      confirmed: 'Đã xác nhận',
      preparing: 'Đang chuẩn bị',
      shipping: 'Đang giao',
      delivered: 'Giao thành công',
      cancelled: 'Đã hủy',
    };
    const paymentStatusMap = {
      unpaid: 'Chưa thanh toán',
      paid: 'Đã thanh toán',
      refunded: 'Đã hoàn tiền',
      expired: 'Đã hết hạn',
    };

    orders.forEach((o) => {
      const itemsText = (o.items || [])
        .map((it) => `${it.productName || it.name || 'SP'} x${it.quantity}`)
        .join(', ');
      const goods = (o.total || 0) + (o.discount || 0) - (o.shippingFee || 0);

      const row = sheet.addRow({
        orderCode: o.orderCode,
        createdAt: new Date(o.createdAt).toLocaleString('vi-VN'),
        customerName: o.guestName || o.customerName || (o.user ? o.user.name : '') || 'Khách vãng lai',
        phone: o.guestPhone || o.customerPhone || (o.user ? o.user.phone : '') || '',
        address: o.shippingAddress || (o.pickupStore ? (o.pickupStore.name || o.pickupStore.address) : '') || 'Nhận tại quầy',
        itemsSummary: itemsText,
        goodsAmount: Math.max(0, goods),
        discount: o.discount || 0,
        shippingFee: o.shippingFee || 0,
        total: o.total || 0,
        paymentMethod: o.paymentMethod === 'bank_transfer' ? 'Chuyển khoản VietQR' : 'Tiền mặt (COD)',
        paymentStatus: paymentStatusMap[o.paymentStatus] || o.paymentStatus || 'Chưa thanh toán',
        status: statusMap[o.status] || o.status,
      });

      row.height = 22;
      [7, 8, 9, 10].forEach((colIdx) => {
        const cell = row.getCell(colIdx);
        cell.numFmt = '#,##0"đ"';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      });
      [1, 2, 4, 11, 12, 13].forEach((colIdx) => {
        row.getCell(colIdx).alignment = { horizontal: 'center', vertical: 'middle' };
      });
      [3, 5, 6].forEach((colIdx) => {
        row.getCell(colIdx).alignment = { horizontal: 'left', vertical: 'middle' };
      });
    });

    const filename = `XanhLa_BaoCaoDonHang_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// GET /api/orders/export/csv - Xuất tệp CSV UTF-8 with BOM
router.get('/export/csv', protect, staffOnly, async (req, res, next) => {
  try {
    const { startDate, endDate, status, paymentMethod, search } = req.query;
    const filter = {};

    const scopedStore = getScopedStoreId(req);
    if (scopedStore && scopedStore !== 'all' && scopedStore !== 'ALL') {
      filter.warehouseId = scopedStore;
    }

    if (status && status !== 'all') filter.status = status;
    if (paymentMethod && paymentMethod !== 'all') filter.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    if (search) {
      filter.$or = [
        { orderCode: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
      ];
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

    const header = ['Mã đơn hàng', 'Thời gian đặt', 'Khách hàng', 'SĐT', 'Địa chỉ', 'Tiền hàng', 'Giảm giá', 'Phí ship', 'Tổng cộng', 'Phương thức thanh toán', 'Trạng thái'];
    const rows = orders.map(o => [
      `"${o.orderCode}"`,
      `"${new Date(o.createdAt).toLocaleString('vi-VN')}"`,
      `"${o.customerName || ''}"`,
      `"${o.guestPhone || o.customerPhone || ''}"`,
      `"${(o.shippingAddress || '').replace(/"/g, '""')}"`,
      o.total + (o.discount || 0) - (o.shippingFee || 0),
      o.discount || 0,
      o.shippingFee || 0,
      o.total || 0,
      `"${o.paymentMethod === 'bank_transfer' ? 'Chuyển khoản VietQR' : 'COD'}"`,
      `"${o.status}"`,
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const filename = `XanhLa_BaoCao_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) { next(err); }
});

// GET /api/orders/:code - get order by code (authenticated)
router.get('/:code', protect, async (req, res, next) => {
  try {
    const order = await Order.findOne(buildOrderLookupQuery(req.params.code)).populate('user', 'name email phone').lean();
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await expireUnpaidQrOrderIfNeeded(order);
    await attachComboDetailsToOrders(order);
    attachPaymentQrMetadata(order);
    
    const isOwner = (order.user && (order.user._id?.toString() === req.user.id || order.user.toString() === req.user.id)) ||
                    (!order.user && order.guestEmail === req.user.email);
    const userRole = (req.user?.role || '').toLowerCase();
    const isStaff = ['admin', 'manager', 'sales', 'warehouse'].includes(userRole);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn hàng này.' });
    }

    const scopedStore = getScopedStoreId(req);
    if (!isOwner && scopedStore && scopedStore !== 'all' && order.warehouseId !== scopedStore) {
      return res.status(403).json({
        success: false,
        message: `Bạn chỉ có quyền xem đơn hàng thuộc chi nhánh [${scopedStore}].`
      });
    }

    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// GET /api/orders/:id - admin / manager / staff
router.get('/:id', protect, staffOnly, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email').lean();
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const scopedStore = getScopedStoreId(req);
    if (scopedStore && scopedStore !== 'all' && order.warehouseId !== scopedStore) {
      return res.status(403).json({
        success: false,
        message: `Bạn chỉ có quyền xem đơn hàng thuộc chi nhánh [${scopedStore}].`
      });
    }

    await attachComboDetailsToOrders(order);
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// PUT/POST /api/orders/:id/cancel - cancel order (customer or admin)
const handleCancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      const rawCode = String(id).trim();
      const normalizedCode = rawCode.replace(/^XL-?/i, 'XL-');
      const noHyphenCode = rawCode.replace(/^XL-?/i, 'XL');
      order = await Order.findOne({
        $or: [
          { orderCode: rawCode },
          { orderCode: normalizedCode },
          { orderCode: noHyphenCode },
          { orderCode: rawCode.toUpperCase() }
        ]
      });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    // Kiểm tra quyền: nếu đơn hàng thuộc về một tài khoản, yêu cầu người đặt hoặc admin
    if (order.user) {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để thực hiện thao tác này.' });
      }
      const orderUserId = (order.user._id || order.user).toString();
      const currentUserId = req.user._id.toString();
      const isOwner = orderUserId === currentUserId;
      if (!isOwner && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy đơn hàng này.' });
      }
    } else if (req.user && req.user.role !== 'admin' && order.guestEmail && order.guestEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy đơn hàng này.' });
    }

    // Kiểm tra điều kiện hợp lệ trước khi hủy
    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Đơn hàng này đã được hủy trước đó.' });
    }

    const isUnpaidPendingQr =
      order.paymentMethod === 'bank_transfer' &&
      (order.paymentStatus || 'unpaid') === 'unpaid' &&
      order.status === 'pending';

    // Cho phép hủy trực tuyến khi đơn ở bước Chờ xử lý ('pending') hoặc Đã xác nhận ('confirmed').
    // Khi đã bước vào Đang chuẩn bị hàng ('preparing') hoặc Đang giao ('shipping') thì không thể hủy nữa.
    const cancellableStatuses = ['pending', 'confirmed'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng đã bước vào khâu chuẩn bị đóng gói xuất kho hoặc đang giao, không thể hủy lúc này.'
      });
    }

    // Cập nhật trạng thái thành 'cancelled'
    const oldStatus = order.status;
    order.status = 'cancelled';
    if (isUnpaidPendingQr) {
      order.paymentStatus = 'expired';
    }
    if (reason && typeof reason === 'string' && reason.trim()) {
      order.note = order.note ? `${order.note} | Lý do hủy: ${reason.trim()}` : `Lý do hủy: ${reason.trim()}`;
    }
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: 'cancelled',
      updatedBy: req.user?.name || order.guestName || 'Khách hàng',
      role: req.user?.role || 'Customer',
      note: reason ? `Khách hủy đơn: ${reason.trim()}` : 'Khách hủy đơn trực tuyến',
      updatedAt: new Date(),
    });
    await order.save();

    if (oldStatus === 'confirmed') {
      await handleFlashSaleOrderCancelled(order);
    }
    await restoreOrderInventoryOnce(order._id, req.user?._id || null);
    await restoreOrderVoucherOnce(order);

    if (typeof clearDashboardCache === 'function') {
      clearDashboardCache();
    }

    res.json({
      success: true,
      message: 'Hủy đơn hàng thành công.',
      data: order
    });
  } catch (err) {
    next(err);
  }
};

router.put('/:id/cancel', optionalAuth, handleCancelOrder);
router.post('/:id/cancel', optionalAuth, handleCancelOrder);

// PUT /api/orders/:id/status - admin / manager / staff
router.put('/:id/status', protect, staffOnly, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending','confirmed','preparing','shipping','delivered','cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
    }

    const currentOrder = await Order.findById(req.params.id);
    if (!currentOrder) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    const scopedStore = getScopedStoreId(req);
    if (scopedStore && scopedStore !== 'all' && currentOrder.warehouseId !== scopedStore) {
      return res.status(403).json({
        success: false,
        message: `Bạn chỉ có quyền quản lý đơn hàng thuộc chi nhánh [${scopedStore}]. Đơn hàng này thuộc kho [${currentOrder.warehouseId}].`
      });
    }

    // Phân quyền theo vai trò: Nhân viên kho (warehouse) chỉ được tiếp nhận đóng gói và giao hàng
    const userRole = (req.user?.role || req.session?.employee?.role || '').toLowerCase();
    if (userRole === 'warehouse') {
      const validWarehouseTransitions = [
        { from: 'confirmed', to: 'preparing' }, // Tiếp nhận đóng gói
        { from: 'preparing', to: 'shipping' },  // Bàn giao xuất kho cho shipper
      ];
      const isAllowed = validWarehouseTransitions.some(t => t.from === currentOrder.status && t.to === status);
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          message: 'Nhân viên kho chỉ có quyền thao tác "Chuẩn bị hàng" (từ Đã xác nhận) hoặc "Bắt đầu giao" (từ Đang chuẩn bị). Nghiệp vụ Xác nhận đơn, Hoàn tất và Hủy đơn thuộc thẩm quyền của Nhân viên Bán hàng (Sales) hoặc Quản lý.'
        });
      }
    }

    // Chặn nghiêm ngặt: Đơn thanh toán VietQR bắt buộc phải xác nhận thanh toán (Duyệt QR) trước khi xử lý
    if (
      currentOrder.paymentMethod === 'bank_transfer' &&
      currentOrder.paymentStatus !== 'paid' &&
      ['confirmed', 'preparing', 'shipping', 'delivered'].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng thanh toán VietQR chưa nhận được tiền. Vui lòng bấm "Duyệt QR" để xác nhận thanh toán trước khi xử lý hoặc giao hàng!'
      });
    }

    const previousStatus = currentOrder.status;
    currentOrder.status = status;
    if (!currentOrder.statusHistory) currentOrder.statusHistory = [];
    const updaterName = req.user?.name || req.session?.employee?.name || 'Nhân viên kinh doanh';
    const updaterRole = req.user?.role || req.session?.employee?.role || 'Sales';
    currentOrder.statusHistory.push({
      status,
      updatedBy: updaterName,
      role: updaterRole,
      note: req.body.note || `Chuyển trạng thái sang ${status}`,
      updatedAt: new Date(),
    });
    if (status === 'cancelled' && currentOrder.paymentMethod === 'bank_transfer' && currentOrder.paymentStatus === 'unpaid') {
      currentOrder.paymentStatus = 'expired';
    }
    await currentOrder.save();

    // Flash sale soldQuantity updates
    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      await handleFlashSaleOrderConfirmed(currentOrder);
    }
    if (status === 'cancelled' && previousStatus === 'confirmed') {
      await handleFlashSaleOrderCancelled(currentOrder);
    }

    // If order was cancelled from active state, return items (including Combo components) to inventory exactly once
    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      await restoreOrderInventoryOnce(currentOrder._id, req.user?._id || null);
      await restoreOrderVoucherOnce(currentOrder);
      if (currentOrder.pointsAwarded) {
        await rollbackOrderPoints(currentOrder._id, 'hủy đơn hàng');
      }
    }

    if (status === 'delivered') {
      await creditOrderPoints(currentOrder._id);
      await releaseAndDeductStoreInventory(currentOrder);
    }

    // Xóa Cache Dashboard chủ động khi trạng thái đơn đổi (đặc biệt khi giao thành công hoặc hủy)
    if (typeof clearDashboardCache === 'function') {
      clearDashboardCache();
    }

    // Bắn thông báo thời gian thực cho Khách hàng khi trạng thái đơn hàng thay đổi
    let targetRecipient = currentOrder.user;
    if (!targetRecipient && (currentOrder.guestPhone || currentOrder.guestEmail)) {
      const foundUser = await User.findOne({
        $or: [
          currentOrder.guestPhone ? { phone: currentOrder.guestPhone } : null,
          currentOrder.guestEmail ? { email: currentOrder.guestEmail } : null,
        ].filter(Boolean)
      }).select('_id');
      if (foundUser) targetRecipient = foundUser._id;
    }

    if (targetRecipient) {
      const statusLabels = {
        pending: 'Chờ xử lý',
        confirmed: 'Đã xác nhận',
        preparing: 'Đang chuẩn bị hàng',
        shipping: 'Đang giao hàng',
        delivered: 'Đã giao thành công',
        cancelled: 'Đã hủy',
      };
      sendRealtimeNotification({
        recipient: targetRecipient,
        title: `Cập nhật đơn hàng #${currentOrder.orderCode}`,
        body: `Đơn hàng của bạn đã chuyển sang trạng thái: "${statusLabels[status] || status}".`,
        type: 'order',
        path: '/account?tab=orders',
        orderId: currentOrder._id,
      });
    }

    res.json({ success: true, data: currentOrder });
  } catch (err) { next(err); }
});

// POST /api/orders/:id/boris-return - Buy Online, Return In-Store (Khách đổi trả tại quầy siêu thị)
router.post('/:id/boris-return', protect, staffOnly, verifyStoreAccess, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { storeId = 'store-thuduc', items = [], refundAmount = 0, note = '' } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách sản phẩm đổi trả không được để trống' });
    }

    const processedReturns = [];
    for (const item of items) {
      const pid = item.productId || item.product;
      const qty = Number(item.quantity) || 1;
      const condition = item.condition || 'intact'; // 'intact' = còn nguyên tem mác, 'damaged' = lỗi/hỏng

      let storeInv = await StoreInventory.findOne({ storeId, productId: pid });
      const prod = await Product.findById(pid).select('name slug priceNumber');

      if (!storeInv && prod) {
        storeInv = new StoreInventory({
          storeId,
          productId: pid,
          sku: prod.slug,
          physicalStock: 0,
          safetyBuffer: 2,
        });
      }

      if (storeInv) {
        if (condition === 'intact') {
          storeInv.physicalStock += qty;
          await storeInv.save();
          await Product.findByIdAndUpdate(pid, { $inc: { stock: qty } });

          await InventoryLog.create({
            product: pid,
            productName: prod?.name || 'Sản phẩm',
            type: 'import',
            storeId,
            referenceId: order.orderCode || String(order._id),
            delta: qty,
            oldStock: storeInv.physicalStock - qty,
            newStock: storeInv.physicalStock,
            reason: `BORIS - Khách đổi trả tại quầy [Đơn ${order.orderCode}]. Hàng nguyên tem, tái nhập bán tiếp`,
            note,
            updatedBy: req.user._id,
          });
        } else {
          storeInv.damagedStock = (storeInv.damagedStock || 0) + qty;
          await storeInv.save();

          await InventoryLog.create({
            product: pid,
            productName: prod?.name || 'Sản phẩm',
            type: 'adjustment',
            storeId,
            referenceId: order.orderCode || String(order._id),
            delta: 0,
            oldStock: storeInv.physicalStock,
            newStock: storeInv.physicalStock,
            reason: `BORIS - Khách đổi trả hàng lỗi/hỏng tại quầy [Đơn ${order.orderCode}]. Nhập kho hàng hỏng`,
            note,
            updatedBy: req.user._id,
          });
        }

        processedReturns.push({
          productId: pid,
          productName: prod?.name,
          quantity: qty,
          condition,
          storePhysicalStock: storeInv.physicalStock,
        });
      }
    }

    order.statusHistory.push({
      status: 'boris_returned',
      updatedBy: req.user.name || 'Nhân viên cửa hàng',
      role: req.user.role || 'Staff',
      note: `Khách đổi trả tại chi nhánh [${storeId}]. Hoàn tiền: ${Number(refundAmount).toLocaleString('vi-VN')}đ. ${note}`,
      updatedAt: new Date(),
    });
    await order.save();

    // Thu hồi điểm tích lũy tương ứng nếu đơn hàng này đã từng được cộng điểm
    if (order.user && order.pointsAwarded) {
      await rollbackOrderPoints(order._id, 'đổi trả hàng tại quầy (BORIS)');
    }

    AuditLog.create({
      actor: req.user._id,
      actorName: req.user.name || 'Staff',
      actorEmail: req.user.email || '',
      actorRole: req.user.role || 'staff',
      action: 'BORIS_RETURN_PROCESSED',
      category: 'ORDER',
      targetType: 'Order',
      targetId: order.orderCode || String(order._id),
      details: `Xử lý đổi trả hàng tại quầy [${storeId}] cho đơn hàng ${order.orderCode}. Số mặt hàng: ${processedReturns.length}`,
    }).catch(() => {});

    res.json({
      success: true,
      message: `Đã xử lý đổi trả tại chi nhánh [${storeId}] thành công.`,
      orderCode: order.orderCode,
      returns: processedReturns,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/cod-settlement - Bảng kê đối soát nộp tiền COD của Tài xế xe lạnh
router.get('/cod-settlement', protect, staffOnly, async (req, res, next) => {
  try {
    const scopedStore = getScopedStoreId(req);
    const filter = {
      paymentMethod: 'cod',
      status: 'delivered',
    };
    if (scopedStore && scopedStore !== 'all') {
      filter.$or = [{ warehouseId: scopedStore }, { pickupStoreId: scopedStore }];
    }

    const [unsettledOrders, settledTodayOrders] = await Promise.all([
      Order.find({ ...filter, codSettled: { $ne: true } })
        .select('orderCode guestName guestPhone total shippingAddress warehouseId updatedAt shipperName shipperPhone')
        .sort({ updatedAt: -1 })
        .lean(),
      Order.find({
        ...filter,
        codSettled: true,
        codSettledAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      })
        .select('orderCode guestName total codSettledAt codSettledBy warehouseId')
        .sort({ codSettledAt: -1 })
        .lean(),
    ]);

    const totalUnsettledAmount = unsettledOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalSettledToday = settledTodayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    res.json({
      success: true,
      data: {
        totalUnsettledAmount,
        unsettledCount: unsettledOrders.length,
        unsettledOrders,
        totalSettledToday,
        settledTodayCount: settledTodayOrders.length,
        settledTodayOrders,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/orders/cod-settle - Thủ quỹ / Quản lý xác nhận tài xế đã nộp đủ tiền mặt COD vào két
router.post('/cod-settle', protect, staffOnly, async (req, res, next) => {
  try {
    const { orderIds = [] } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 đơn hàng để chốt nộp tiền.' });
    }

    const updater = req.user?.name || req.user?.email || 'Thu quỹ chi nhánh';
    const now = new Date();

    const result = await Order.updateMany(
      {
        _id: { $in: orderIds },
        paymentMethod: 'cod',
        status: 'delivered',
        codSettled: { $ne: true },
      },
      {
        $set: {
          codSettled: true,
          codSettledAt: now,
          codSettledBy: updater,
          paymentStatus: 'paid',
          paidAt: now,
        },
      }
    );

    AuditLog.create({
      actor: req.user._id,
      actorName: updater,
      actorEmail: req.user.email || '',
      actorRole: req.user.role || 'staff',
      action: 'COD_CASH_SETTLED',
      category: 'FINANCE',
      targetType: 'Order',
      targetId: orderIds.join(','),
      details: `Chốt đối soát thu tiền COD vào két thành công cho ${result.modifiedCount} đơn hàng`,
    }).catch(() => {});

    res.json({
      success: true,
      message: `Đã đối soát và xác nhận nộp đủ tiền mặt cho ${result.modifiedCount} đơn hàng vào két.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) { next(err); }
});

module.exports = router;
