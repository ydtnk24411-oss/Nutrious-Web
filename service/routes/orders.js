const router = require('express').Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const Order  = require('../models/Order');
const Product = require('../models/Product');
const FlashSale = require('../models/FlashSale');
const InventoryLog = require('../models/InventoryLog');
const { protect, optionalAuth, adminOnly, staffOnly, hasRole } = require('../middleware/auth');
const { validate }           = require('../middleware/validate');
const { evaluateVoucher, consumeVoucher } = require('../utils/voucher');
const { creditOrderPoints }   = require('../utils/loyalty');
const { calculateShipping }   = require('../utils/shippingCalculator');

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
  const isUnpaidQrPending =
    order.paymentMethod === 'bank_transfer' &&
    (order.paymentStatus || 'unpaid') === 'unpaid' &&
    order.status === 'pending' &&
    order.paymentExpiresAt &&
    Date.now() > new Date(order.paymentExpiresAt).getTime();

  if (!isUnpaidQrPending) return order;

  const expiredNote = order.note
    ? `${order.note} | Tự động hủy do quá thời gian thanh toán VietQR (15 phút)`
    : 'Tự động hủy do quá thời gian thanh toán VietQR (15 phút)';

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'unpaid', status: 'pending' },
    { $set: { paymentStatus: 'expired', status: 'cancelled', note: expiredNote } },
    { new: true }
  ).lean();

  if (updated) {
    await restoreOrderInventoryOnce(order._id, null);
    order.paymentStatus = 'expired';
    order.status = 'cancelled';
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
      }

      // 3. Tính toán và xác thực phí vận chuyển từ server (theo nấc khoảng cách + giá trị đơn hàng thực tế)
      let finalShippingFee = 0;
      let shippingDiscount = 0;
      let distanceKm = 0;
      let estimatedDeliveryTime = orderData.estimatedDeliveryTime || '30 phút (lấy tại kho)';

      if (orderData.shippingMethod === 'delivery') {
        const coords = orderData.shippingCoordinates;
        if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
          const shipRes = await calculateShipping(coords.lat, coords.lng, serverSubtotal);
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
            // Giao ngay 🛵: Phí cơ bản theo khoảng cách (đã gồm phụ thu giao xa nếu >10km) + 10.000đ hỏa tốc
            finalShippingFee += 10000;
          } else if (orderData.deliveryType === 'standard') {
            // Giao tiết kiệm (trong 24h): Giá gốc 15.000đ (+ phụ thu giao xa nếu >10km), áp dụng hỗ trợ ship theo đơn hàng
            const stdBase = 15000 + (shipRes.farSurcharge || 0);
            const autoDisc = serverSubtotal >= 300000
              ? Math.min(25000, stdBase)
              : (serverSubtotal >= 150000 ? Math.min(10000, stdBase) : 0);
            finalShippingFee = Math.max(0, stdBase - autoDisc);
            shippingDiscount = autoDisc;
          }

          orderData.shippingDetails = {
            baseFee: shipRes.baseFee,
            farSurcharge: shipRes.farSurcharge || 0,
            isFarDelivery: Boolean(shipRes.isFarDelivery),
            discount: shippingDiscount,
            finalFee: finalShippingFee,
            distanceKm: shipRes.distanceKm,
            durationMin: shipRes.durationMin,
            tierLabel: shipRes.tierLabel,
            discountReason: shipRes.discountReason,
          };
        } else {
          // Fallback nếu không có tọa độ GPS: tính phí chuẩn 20.000đ và xét bậc thang
          const baseFee = orderData.deliveryType === 'instant' ? 30000 : (orderData.deliveryType === 'standard' ? 15000 : 20000);
          const autoDisc = serverSubtotal >= 300000 ? (baseFee <= 25000 ? baseFee : 25000) : (serverSubtotal >= 150000 ? 10000 : 0);
          finalShippingFee = Math.max(0, baseFee - autoDisc);
          shippingDiscount = autoDisc;
          estimatedDeliveryTime = orderData.deliveryTimeSlot || orderData.estimatedDeliveryTime || 'Trong ngày (xe bảo quản lạnh)';
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
      const orderVoucherInput = orderData.voucherCode ? String(orderData.voucherCode).trim() : '';
      if (orderVoucherInput) {
        appliedOrderVoucher = await evaluateVoucher(orderVoucherInput, payableGoods, req.user?._id);
        if (!appliedOrderVoucher.valid) {
          return res.status(400).json({ success: false, message: appliedOrderVoucher.message });
        }
      }

      // 4b. Mã miễn phí / hỗ trợ vận chuyển (Freeship)
      const shipVoucherInput = orderData.shippingVoucherCode ? String(orderData.shippingVoucherCode).trim() : '';
      let shippingVoucherDiscount = 0;
      if (shipVoucherInput) {
        appliedShipVoucher = await evaluateVoucher(shipVoucherInput, payableGoods, req.user?._id);
        if (!appliedShipVoucher.valid) {
          return res.status(400).json({ success: false, message: appliedShipVoucher.message });
        }
        // Giảm trừ phí ship còn lại
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

      // 5. Server tự tính lại total: total = subtotal - discount + finalShippingFee
      orderData.total = Math.max(0, payableGoods - orderData.discount + finalShippingFee);
      orderData.paymentStatus = 'unpaid';
      orderData.paymentExpiresAt = orderData.paymentMethod === 'bank_transfer'
        ? new Date(Date.now() + QR_PAYMENT_TTL_MS)
        : null;
      orderData.paidAt = null;
      orderData.paymentReference = '';
      orderData.inventoryDeducted = true;
      orderData.inventoryRestored = false;
      orderData.hasNonRefundableItems = detectedNonRefundableItems.length > 0;
      orderData.nonRefundableAccepted = Boolean(orderData.nonRefundableAccepted || req.body.nonRefundableAccepted);
      orderData.nonRefundableItems = detectedNonRefundableItems;

      // 6. Kiểm tra & khấu trừ tồn kho nguyên tử (atomic) trên các sản phẩm vật lý để chống bán vượt khi nhiều khách đặt cùng lúc
      // Gom tổng số lượng cần dùng theo từng Product ID (bao gồm cả sản phẩm lẻ/mua kèm và thành phần của mọi Combo trong giỏ)
      const requiredStockMap = new Map(); // prodId -> { totalQty, productName, reasons: string[] }
      for (const item of orderData.items) {
        if (item.isCombo && Array.isArray(item.comboItems)) {
          for (const ci of item.comboItems) {
            if (!ci.product || !mongoose.Types.ObjectId.isValid(ci.product)) continue;
            const pid = String(ci.product);
            const need = Math.max(1, Number(ci.quantity) || 1) * item.quantity;
            const prev = requiredStockMap.get(pid) || { totalQty: 0, productName: ci.name, reasons: [] };
            prev.totalQty += need;
            prev.reasons.push(`Combo "${item.productName}" x${item.quantity}`);
            requiredStockMap.set(pid, prev);
          }
        } else if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
          const pid = String(item.product);
          const prev = requiredStockMap.get(pid) || { totalQty: 0, productName: item.productName, reasons: [] };
          prev.totalQty += item.quantity;
          prev.reasons.push(item.itemType === 'addon' ? 'SP mua kèm' : 'SP mua lẻ');
          requiredStockMap.set(pid, prev);
        }
      }

      const sortedRequiredEntries = Array.from(requiredStockMap.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      );
      const deductedReservations = []; // Array<{ pid, qty, oldStock, newStock, productName, reasons }>

      for (const [pid, reqInfo] of sortedRequiredEntries) {
        const prevDoc = await Product.findOneAndUpdate(
          {
            _id: new mongoose.Types.ObjectId(pid),
            isCombo: { $ne: true },
            isActive: { $ne: false },
            stock: { $gte: reqInfo.totalQty },
          },
          { $inc: { stock: -reqInfo.totalQty } },
          { new: false }
        );

        if (!prevDoc) {
          // Hoàn lại ngay các sản phẩm đã tạm trừ trong cùng request nếu có 1 thành phần thiếu hàng
          for (const r of deductedReservations) {
            await Product.findByIdAndUpdate(r.pid, { $inc: { stock: r.qty } });
          }
          const curProd = await Product.findById(pid).select('name stock isActive').lean();
          const avail = Math.max(0, Number(curProd?.stock ?? 0));
          const prodLabel = curProd?.name || reqInfo.productName || 'Sản phẩm';
          const viaCombo = reqInfo.reasons.some((rs) => rs.startsWith('Combo '));
          return res.status(400).json({
            success: false,
            message: viaCombo
              ? `Sản phẩm thành phần "${prodLabel}" (${reqInfo.reasons.join(', ')}) không đủ tồn kho (cần ${reqInfo.totalQty}, hiện còn ${avail}).`
              : `Sản phẩm "${prodLabel}" không đủ tồn kho (cần ${reqInfo.totalQty}, hiện còn ${avail}).`,
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
        order = await Order.create(orderData);
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

      // 5. Tạo link VietQR nếu phương thức là bank_transfer
      const vietQr = order.paymentMethod === 'bank_transfer'
        ? buildVietQrPayload(order)
        : { qrUrl: null, bankInfo: null };

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
    } else if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
      const pid = String(item.product);
      const prev = restoreMap.get(pid) || { totalQty: 0, productName: item.productName, reasons: [] };
      prev.totalQty += item.quantity;
      restoreMap.set(pid, prev);
    }
  }

  for (const [pid, info] of restoreMap.entries()) {
    const prevDoc = await Product.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(pid), isCombo: { $ne: true } },
      { $inc: { stock: info.totalQty } },
      { new: false }
    );
    if (!prevDoc) continue;
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

// GET /api/orders — admin & sales & support: all orders with filters
router.get('/', protect, staffOnly, async (req, res, next) => {
  try {
    const { status, paymentMethod, page = 1, limit = 20, search, startDate, endDate, user, userId } = req.query;
    const filter = {};
    if (user || userId) filter.user = user || userId;
    if (status && status !== 'all') filter.status = status;
    if (paymentMethod && paymentMethod !== 'all') filter.paymentMethod = paymentMethod;

    if (search) {
      filter.$or = [
        { orderCode: { $regex: search, $options: 'i' } },
        { guestName:  { $regex: search, $options: 'i' } },
        { guestEmail: { $regex: search, $options: 'i' } },
        { guestPhone: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
        .populate('user', 'name email phone').lean(),
      Order.countDocuments(filter),
    ]);
    await Promise.all(orders.map((o) => expireUnpaidQrOrderIfNeeded(o)));
    await attachComboDetailsToOrders(orders);
    res.json({ success: true, total, page: Number(page), data: orders });
  } catch (err) { next(err); }
});

// GET /api/orders/track/:code — public order tracking
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

// GET /api/orders/:code/payment-status — kiểm tra trạng thái thanh toán VietQR (dùng cho polling màn hình QR)
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

// POST /api/orders/webhook/vietqr — Webhook nhận biến động giao dịch từ SePay / Casso
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

// POST /api/orders/:code/confirm-payment — Admin/nhân viên xác nhận đã nhận tiền chuyển khoản VietQR
router.post('/:code/confirm-payment', protect, staffOnly, async (req, res, next) => {
  try {
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

// GET /api/orders/my — get current user's orders
router.get('/my', protect, async (req, res, next) => {
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
});

// GET /api/orders/:code — get order by code (authenticated)
router.get('/:code', protect, async (req, res, next) => {
  try {
    const order = await Order.findOne(buildOrderLookupQuery(req.params.code)).populate('user', 'name email phone').lean();
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await expireUnpaidQrOrderIfNeeded(order);
    await attachComboDetailsToOrders(order);
    attachPaymentQrMetadata(order);
    
    const isOwner = (order.user && (order.user._id?.toString() === req.user.id || order.user.toString() === req.user.id)) ||
                    (!order.user && order.guestEmail === req.user.email);
    if (!isOwner && req.user.role !== 'admin' && req.user.role !== 'sales') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn hàng này.' });
    }
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// GET /api/orders/:id — admin
router.get('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email').lean();
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await attachComboDetailsToOrders(order);
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// PUT/POST /api/orders/:id/cancel — cancel order (customer or admin)
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

    // Kiểm tra quy chế hàng tươi sống: Không hỗ trợ hủy đơn đối với khách hàng sau khi đặt COD / đã thanh toán,
    // NHƯNG cho phép hủy đơn VietQR khi chưa thanh toán (paymentStatus === 'unpaid' && status === 'pending') để đổi phương thức hoặc quay lại
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'manager');
    const isUnpaidPendingQr =
      order.paymentMethod === 'bank_transfer' &&
      (order.paymentStatus || 'unpaid') === 'unpaid' &&
      order.status === 'pending';
    if (!isAdmin && order.hasNonRefundableItems && !isUnpaidPendingQr) {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng có chứa sản phẩm tươi sống (Rau củ, Trái cây, Thịt, Cá & Hải sản) không hỗ trợ hủy theo quy chế bảo đảm tươi mới của Evergreen Mart.'
      });
    }

    const cancellableStatuses = ['pending', 'confirmed'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng đang trong quá trình chuẩn bị hoặc giao hàng, không thể hủy lúc này.'
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
    await order.save();

    if (oldStatus === 'confirmed') {
      await handleFlashSaleOrderCancelled(order);
    }
    await restoreOrderInventoryOnce(order._id, req.user?._id || null);

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

// PUT /api/orders/:id/status — admin
router.put('/:id/status', protect, adminOnly, async (req, res, next) => {
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

    const previousStatus = currentOrder.status;
    currentOrder.status = status;
    if (
      currentOrder.paymentMethod === 'bank_transfer' &&
      ['confirmed', 'preparing', 'shipping', 'delivered'].includes(status) &&
      currentOrder.paymentStatus !== 'paid'
    ) {
      currentOrder.paymentStatus = 'paid';
      currentOrder.paidAt = currentOrder.paidAt || new Date();
      currentOrder.paymentReference = currentOrder.paymentReference || 'ADMIN_STATUS_CONFIRMED';
    } else if (status === 'cancelled' && currentOrder.paymentMethod === 'bank_transfer' && currentOrder.paymentStatus === 'unpaid') {
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
    }

    if (status === 'delivered') {
      await creditOrderPoints(currentOrder._id);
    }

    res.json({ success: true, data: currentOrder });
  } catch (err) { next(err); }
});

module.exports = router;
