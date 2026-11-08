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

function calcDealUnitDiscount(targetUnitPrice, deal) {
  if (!deal || deal.isActive === false) return 0;
  const val = Number(deal.discountValue) || 0;
  if (val <= 0 || targetUnitPrice <= 0) return 0;
  const rawDisc = deal.discountType === 'fixed'
    ? Math.round(val)
    : Math.round((targetUnitPrice * Math.min(99, val)) / 100);
  return Math.max(0, Math.min(targetUnitPrice, rawDisc));
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

        if (!prod || prod.isActive === false) {
          return res.status(400).json({
            success: false,
            message: `Sản phẩm "${item.productName || item.product || 'trong đơn hàng'}" không tồn tại hoặc đã ngừng kinh doanh.`
          });
        }

        // Lấy giá chuẩn từ database (trường số priceNumber, KHÔNG parse chuỗi)
        const priceNum = typeof prod.priceNumber === 'number' ? prod.priceNumber : Number(prod.priceNumber || 0);

        if (prod.isCombo) {
          const popProd = await Product.findById(prod._id).populate('comboItems.product', 'name price priceNumber image weight unit slug');
          const comboSubItems = [];
          let comboItemsSum = 0;
          if (popProd && Array.isArray(popProd.comboItems) && popProd.comboItems.length > 0) {
            for (const ci of popProd.comboItems) {
              if (!ci.product) continue;
              const ciPrice = typeof ci.product.priceNumber === 'number' ? ci.product.priceNumber : Number(ci.product.priceNumber || 0);
              const singleQty = ci.quantity || 1;
              comboItemsSum += ciPrice * singleQty;
              comboSubItems.push({
                product: ci.product._id ? String(ci.product._id) : '',
                name: ci.product.name,
                image: ci.product.image || '',
                price: ci.product.price || '',
                priceNumber: ciPrice,
                quantity: singleQty,
                unit: ci.product.unit || '',
                weight: ci.product.weight || '',
              });
            }
          }
          const comboRetail = prod.originalPriceNumber && prod.originalPriceNumber > priceNum
            ? prod.originalPriceNumber
            : (comboItemsSum > priceNum ? comboItemsSum : priceNum);
          const saving = Math.max(0, (comboRetail - priceNum) * qty);
          totalComboSaving += saving;
          serverSubtotal += priceNum * qty;

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
        const discountTarget = ae.priceNum <= mainPriceNum ? 'addon' : 'main';
        const potentialUnitDisc = discountTarget === 'addon'
          ? calcDealUnitDiscount(ae.priceNum, deal)
          : calcDealUnitDiscount(mainPriceNum, deal);
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
              promoNote: `Mua kèm cùng "${ae.mainProd.name}" (áp dụng giảm giá cho SP giá thấp hơn)`,
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
              promoNote: `Mua kèm cùng "${ae.mainProd.name}" (ưu đãi áp dụng cho "${ae.mainProd.name}" do có giá thấp hơn)`,
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
            promoNote: `Được giảm giá Mua kèm khi mua cùng "${alloc.addonProdName}" (SP có giá thấp hơn)`,
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

      // 3. Tính toán và xác thực phí vận chuyển từ server (không tin tưởng giá trị gửi từ client)
      let finalShippingFee = 0;
      let shippingDiscount = 0;
      let distanceKm = 0;
      let estimatedDeliveryTime = '30 phút (lấy tại kho)';

      if (orderData.shippingMethod === 'delivery') {
        const coords = orderData.shippingCoordinates;
        if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
          const shipRes = await calculateShipping(coords.lat, coords.lng, serverSubtotal);
          if (!shipRes.supported) {
            return res.status(400).json({
              success: false,
              message: shipRes.message || 'Khu vực giao hàng vượt quá bán kính 10km cho phép đối với nông sản & thực phẩm tươi.',
            });
          }
          finalShippingFee = shipRes.finalFee;
          shippingDiscount = shipRes.discount;
          distanceKm = shipRes.distanceKm;
          estimatedDeliveryTime = shipRes.estimatedDeliveryTime;
          orderData.shippingDetails = {
            baseFee: shipRes.baseFee,
            discount: shipRes.discount,
            finalFee: shipRes.finalFee,
            distanceKm: shipRes.distanceKm,
            durationMin: shipRes.durationMin,
            tierLabel: shipRes.tierLabel,
            discountReason: shipRes.discountReason,
          };
        } else {
          finalShippingFee = Number(orderData.shippingFee) || 20000;
          estimatedDeliveryTime = 'Trong ngày (xe bảo quản lạnh)';
        }
      }

      orderData.subtotal = serverSubtotal;
      orderData.shippingFee = finalShippingFee;
      orderData.shippingDiscount = shippingDiscount;
      orderData.shippingDistanceKm = distanceKm;
      orderData.estimatedDeliveryTime = estimatedDeliveryTime;
      const payableGoods = serverSubtotal;
      orderData.estimatedPoints = Math.floor(payableGoods / 1000);

      // 4. Voucher (kiểm tra với giá trị hàng hóa sau khi đã áp dụng combo saving)
      let applied = null;
      const code = orderData.voucherCode ? String(orderData.voucherCode).trim() : '';
      if (code) {
        applied = await evaluateVoucher(code, payableGoods, req.user?._id);
        if (!applied.valid) {
          return res.status(400).json({ success: false, message: applied.message });
        }
      }
      orderData.voucherCode = applied ? applied.voucher.code : '';
      orderData.discount    = applied ? applied.discount : 0;

      // 5. Server tự tính lại total: total = subtotal - comboDiscount - discount + finalShippingFee
      orderData.total = Math.max(0, payableGoods - orderData.discount + finalShippingFee);

      const order = await Order.create(orderData);
      if (applied) await consumeVoucher(applied, req.user?._id, order._id);

      // Khấu trừ số lượng tồn kho tự động
      for (const item of order.items) {
        if (item.product) {
          const prod = await Product.findById(item.product);
          if (prod) {
            const oldStock = prod.stock ?? 0;
            const newStock = Math.max(0, oldStock - item.quantity);
            prod.stock = newStock;
            await prod.save();

            await InventoryLog.create({
              product: prod._id,
              productName: prod.name,
              type: 'order_confirmed',
              delta: -item.quantity,
              oldStock,
              newStock,
              reason: `Đơn hàng ${order.orderCode}`,
              note: 'Trừ kho khi tạo đơn hàng',
              updatedBy: req.user?._id || null,
            });

            // Nếu là combo, đồng thời trừ kho cho các sản phẩm thành phần
            if (item.isCombo && Array.isArray(item.comboItems)) {
              for (const ci of item.comboItems) {
                if (ci.product) {
                  const subProd = await Product.findById(ci.product);
                  if (subProd) {
                    const subQty = (ci.quantity || 1) * item.quantity;
                    const oldSubStock = subProd.stock ?? 0;
                    subProd.stock = Math.max(0, oldSubStock - subQty);
                    await subProd.save();
                    await InventoryLog.create({
                      product: subProd._id,
                      productName: subProd.name,
                      type: 'order_confirmed',
                      delta: -subQty,
                      oldStock: oldSubStock,
                      newStock: subProd.stock,
                      reason: `Đơn hàng ${order.orderCode} (trong combo ${item.productName})`,
                      note: 'Trừ kho thành phần combo',
                      updatedBy: req.user?._id || null,
                    });
                  }
                }
              }
            }
          }
        }
      }

      // 5. Tạo link VietQR nếu phương thức là bank_transfer
      const bankId = (process.env.BANK_ID || 'MB').trim();
      const accountNo = (process.env.ACCOUNT_NO || '0962299122').trim();
      const accountName = (process.env.ACCOUNT_NAME || 'VY TAM NHU').trim();

      let qrUrl = null;
      if (order.paymentMethod === 'bank_transfer') {
        const encodedAccountName = encodeURIComponent(accountName);
        qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${order.total}&addInfo=${encodeURIComponent(order.orderCode)}&accountName=${encodedAccountName}`;
      }

      res.status(201).json({
        success: true,
        orderCode: order.orderCode,
        total: order.total,
        qrUrl,
        data: {
          orderCode: order.orderCode,
          _id: order._id,
          discount: order.discount,
          comboDiscount: order.comboDiscount || 0,
          addonDiscount: order.addonDiscount || 0,
          total: order.total,
          qrUrl,
          bankInfo: order.paymentMethod === 'bank_transfer' ? {
            bankId,
            accountNo,
            accountName,
          } : null,
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
    let addedComboSaving = 0;

    for (const it of o.items) {
      if (!it) continue;
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

      if (it.isCombo || (prod && prod.isCombo)) {
        it.isCombo = true;
        const comboSubItems = [];
        let subSum = 0;
        const sourceComboItems = (prod && Array.isArray(prod.comboItems) && prod.comboItems.length > 0)
          ? prod.comboItems
          : (Array.isArray(it.comboItems) ? it.comboItems : []);

        for (const ci of sourceComboItems) {
          const subP = ci.product || ci;
          const priceNum = typeof subP.priceNumber === 'number' ? subP.priceNumber : Number(subP.priceNumber || 0);
          const singleQty = ci.quantity || 1;
          subSum += priceNum * singleQty;
          comboSubItems.push({
            product: subP._id ? String(subP._id) : (subP.product ? String(subP.product) : ''),
            name: subP.name || 'Sản phẩm thành phần',
            image: subP.image || '',
            price: subP.price || '',
            priceNumber: priceNum,
            quantity: singleQty,
            unit: subP.unit || '',
            weight: subP.weight || '',
          });
        }

        if (comboSubItems.length > 0) {
          it.comboItems = comboSubItems;
        }

        const basePrice = typeof it.priceNumber === 'number' ? it.priceNumber : Number(it.priceNumber || 0);
        const retail = (prod && prod.originalPriceNumber && prod.originalPriceNumber > basePrice)
          ? prod.originalPriceNumber
          : (subSum > basePrice ? subSum : basePrice);
        const saving = Math.max(0, (retail - basePrice) * (it.quantity || 1));

        if (!it.comboSaving) it.comboSaving = saving;
        if (!it.originalPriceNumber) it.originalPriceNumber = retail;
        addedComboSaving += saving;
      }
    }
  }

  return orders;
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
    await attachComboDetailsToOrders(orders);
    res.json({ success: true, total, page: Number(page), data: orders });
  } catch (err) { next(err); }
});

// GET /api/orders/track/:code — public order tracking
router.get('/track/:code', async (req, res, next) => {
  try {
    const rawCode = String(req.params.code).trim();
    const normalizedCode = rawCode.replace(/^XL-?/i, 'XL-');
    const noHyphenCode = rawCode.replace(/^XL-?/i, 'XL');
    const order = await Order.findOne({
      $or: [
        { orderCode: rawCode },
        { orderCode: normalizedCode },
        { orderCode: noHyphenCode },
        { orderCode: rawCode.toUpperCase() }
      ]
    }).populate('items.product', 'name image').lean();
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await attachComboDetailsToOrders(order);
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// GET /api/orders/my — get current user's orders
router.get('/my', protect, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const userId = req.user._id;
    const userEmail = req.user.email;
    const filter = {
      $or: [
        { user: userId },
        ...(userEmail ? [{ user: null, guestEmail: userEmail }, { user: { $exists: false }, guestEmail: userEmail }] : [])
      ]
    };
    if (status && status !== 'all') filter.status = status;
    if (search) filter.orderCode = { $regex: search, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Order.countDocuments(filter),
    ]);
    await attachComboDetailsToOrders(orders);
    res.json({ success: true, total, page: Number(page), data: orders });
  } catch (err) { next(err); }
});

// GET /api/orders/:code — get order by code (authenticated)
router.get('/:code', protect, async (req, res, next) => {
  try {
    const rawCode = String(req.params.code).trim();
    const normalizedCode = rawCode.replace(/^XL-?/i, 'XL-');
    const noHyphenCode = rawCode.replace(/^XL-?/i, 'XL');
    const order = await Order.findOne({
      $or: [
        { orderCode: rawCode },
        { orderCode: normalizedCode },
        { orderCode: noHyphenCode },
        { orderCode: rawCode.toUpperCase() }
      ]
    }).populate('user', 'name email phone').lean();
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    await attachComboDetailsToOrders(order);
    
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
    if (reason && typeof reason === 'string' && reason.trim()) {
      order.note = order.note ? `${order.note} | Lý do hủy: ${reason.trim()}` : `Lý do hủy: ${reason.trim()}`;
    }
    await order.save();

    if (oldStatus === 'confirmed') {
      await handleFlashSaleOrderCancelled(order);
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
    await currentOrder.save();

    // Flash sale soldQuantity updates
    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      await handleFlashSaleOrderConfirmed(currentOrder);
    }
    if (status === 'cancelled' && previousStatus === 'confirmed') {
      await handleFlashSaleOrderCancelled(currentOrder);
    }

    // If order was cancelled from active state, return items to inventory
    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      for (const item of currentOrder.items) {
        if (item.product) {
          const prod = await Product.findById(item.product);
          if (prod) {
            const oldStock = prod.stock ?? 0;
            const newStock = oldStock + item.quantity;
            prod.stock = newStock;
            await prod.save();

            await InventoryLog.create({
              product: prod._id,
              productName: prod.name,
              type: 'order_cancel',
              delta: item.quantity,
              oldStock,
              newStock,
              reason: `Hủy đơn ${currentOrder.orderCode}`,
              note: `Hoàn tồn tự động do đơn hàng bị hủy`,
              updatedBy: req.user?._id || null,
            });
          }
        }
      }
    }

    if (status === 'delivered') {
      await creditOrderPoints(currentOrder._id);
    }

    res.json({ success: true, data: currentOrder });
  } catch (err) { next(err); }
});

module.exports = router;
