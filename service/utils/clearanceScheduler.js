const StoreInventory = require('../models/StoreInventory');
const Product = require('../models/Product');

/**
 * Tự động kích hoạt chương trình xả hàng cuối ngày cho các mặt hàng tươi sống
 * @param {number} discountPercent - Tỷ lệ giảm giá (mặc định 0.3 = 30%)
 * @param {string} [targetStoreId] - Chi nhánh cụ thể (hoặc undefined cho toàn chuỗi)
 */
async function triggerEndOfDayClearance(discountPercent = 0.3, targetStoreId = null) {
  try {
    // 1. Lọc các sản phẩm tươi sống, rau củ quả, thịt cá, hải sản cần bán trong ngày
    const freshCategoriesRegex = /rau|củ|quả|thịt|cá|tôm|mực|hải sản|trái cây|nấm|tươi|salad/i;
    const freshProducts = await Product.find({
      isActive: { $ne: false },
      $or: [
        { category: freshCategoriesRegex },
        { categoryVi: freshCategoriesRegex },
        { name: freshCategoriesRegex },
      ],
    }).select('_id name slug priceNumber').lean();

    if (freshProducts.length === 0) {
      return { success: true, count: 0, message: 'Không tìm thấy sản phẩm tươi sống nào cần xả kho.' };
    }

    const prodMap = new Map();
    freshProducts.forEach((p) => prodMap.set(String(p._id), p));
    const prodIds = freshProducts.map((p) => p._id);

    const filter = {
      productId: { $in: prodIds },
      physicalStock: { $gte: 3 }, // Chỉ xả những mặt hàng còn tồn trên kệ từ 3 đơn vị trở lên
    };
    if (targetStoreId && targetStoreId !== 'all') {
      filter.storeId = targetStoreId;
    }

    const inventories = await StoreInventory.find(filter);

    // Bổ sung các lô hàng cận date (hết hạn trong 24h tới) theo thuật toán FEFO
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const expiringBatchesInv = await StoreInventory.find({
      'batches': {
        $elemMatch: {
          quantity: { $gt: 0 },
          expDate: { $lte: tomorrow },
        },
      },
      physicalStock: { $gte: 1 },
      ...(targetStoreId && targetStoreId !== 'all' ? { storeId: targetStoreId } : {}),
    });

    const combinedInvs = [...inventories];
    for (const eb of expiringBatchesInv) {
      if (!combinedInvs.some(ci => String(ci._id) === String(eb._id))) {
        combinedInvs.push(eb);
      }
    }

    let updatedCount = 0;

    for (const inv of combinedInvs) {
      let prod = prodMap.get(String(inv.productId));
      if (!prod) {
        prod = await Product.findById(inv.productId).select('priceNumber').lean();
      }
      if (!prod || !prod.priceNumber) continue;

      // Tính giá xả hàng làm tròn đến 1.000đ
      const clearancePrice = Math.max(1000, Math.round((prod.priceNumber * (1 - discountPercent)) / 1000) * 1000);

      // Chỉ cập nhật nếu chưa có giá xả hàng hoặc giá mới thấp hơn
      if (!inv.storeDiscountPrice || inv.storeDiscountPrice > clearancePrice) {
        inv.storeDiscountPrice = clearancePrice;
        await inv.save();
        updatedCount++;
      }
    }

    console.log(`[ClearanceScheduler] Đã kích hoạt xả hàng cuối ngày cho ${updatedCount} mặt hàng tươi sống.`);
    return {
      success: true,
      updatedCount,
      targetStoreId: targetStoreId || 'ALL_STORES',
      discountPercent: `${Math.round(discountPercent * 100)}%`,
    };
  } catch (err) {
    console.error('[ClearanceScheduler] Lỗi khi kích hoạt xả hàng:', err);
    throw err;
  }
}

/**
 * Tự động hoàn nguyên (xóa giá xả hàng) vào đầu ngày mới
 */
async function resetClearancePrices(targetStoreId = null) {
  try {
    const filter = { storeDiscountPrice: { $ne: null } };
    if (targetStoreId && targetStoreId !== 'all') {
      filter.storeId = targetStoreId;
    }

    const result = await StoreInventory.updateMany(filter, {
      $set: { storeDiscountPrice: null }
    });

    console.log(`[ClearanceScheduler] Đã hoàn nguyên giá chuẩn cho ${result.modifiedCount} mặt hàng đón đợt hàng mới.`);
    return {
      success: true,
      resetCount: result.modifiedCount,
      targetStoreId: targetStoreId || 'ALL_STORES',
    };
  } catch (err) {
    console.error('[ClearanceScheduler] Lỗi khi reset giá xả hàng:', err);
    throw err;
  }
}

/**
 * Khởi động tiến trình kiểm tra tự động chạy ngầm mỗi phút
 */
let schedulerInterval = null;
let lastTriggeredDate = null;
let lastResetDate = null;

function initClearanceScheduler() {
  if (schedulerInterval) return;

  console.log('[ClearanceScheduler] Tiến trình Tự Động Xả Hàng Cuối Ngày đã được khởi động.');

  schedulerInterval = setInterval(async () => {
    try {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const todayDateStr = now.toISOString().slice(0, 10);

      // 1. Đúng 18:00 mỗi ngày: Tự động bật xả hàng cuối ngày (-30%)
      if (hour === 18 && minute === 0 && lastTriggeredDate !== todayDateStr) {
        lastTriggeredDate = todayDateStr;
        console.log(`[ClearanceScheduler] 18:00 - Tự động kích hoạt Giờ vàng xả hàng ngày ${todayDateStr}...`);
        await triggerEndOfDayClearance(0.3);
      }

      // 2. Đúng 05:00 sáng mỗi ngày: Tự động reset về giá gốc đón hàng mới
      if (hour === 5 && minute === 0 && lastResetDate !== todayDateStr) {
        lastResetDate = todayDateStr;
        console.log(`[ClearanceScheduler] 05:00 - Tự động hoàn nguyên giá gốc cho ngày mới ${todayDateStr}...`);
        await resetClearancePrices();
      }
    } catch (schedErr) {
      console.error('[ClearanceScheduler] Lỗi trong nhịp kiểm tra scheduler:', schedErr);
    }
  }, 60000); // Kiểm tra mỗi 60 giây
}

module.exports = {
  triggerEndOfDayClearance,
  resetClearancePrices,
  initClearanceScheduler,
};
