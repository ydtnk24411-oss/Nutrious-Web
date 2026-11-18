const Order = require('../models/Order');
const Product = require('../models/Product');
const StoreInventory = require('../models/StoreInventory');
const InventoryLog = require('../models/InventoryLog');
const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const FlashSale = require('../models/FlashSale');
const mongoose = require('mongoose');
const { sendRealtimeNotification } = require('../routes/notifications');

/**
 * Tự động hủy đơn hàng VietQR đã quá hạn thanh toán 15 phút và hoàn trả tồn kho ngay lập tức
 */
async function sweepExpiredVietQrOrders() {
  try {
    const now = new Date();
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    const expiredOrders = await Order.find({
      paymentMethod: 'bank_transfer',
      paymentStatus: { $in: ['unpaid', 'pending'] },
      status: 'pending',
      $or: [
        { paymentExpiresAt: { $lte: now } },
        { createdAt: { $lte: fifteenMinsAgo } },
      ],
    }).limit(50);

    if (expiredOrders.length === 0) return 0;

    let cancelledCount = 0;
    for (const ord of expiredOrders) {
      // Khóa nguyên tử trạng thái đơn
      const locked = await Order.findOneAndUpdate(
        {
          _id: ord._id,
          paymentStatus: { $in: ['unpaid', 'pending'] },
          status: 'pending',
          inventoryRestored: { $ne: true },
        },
        {
          $set: {
            status: 'cancelled',
            paymentStatus: 'expired',
            inventoryRestored: true,
            note: (ord.note ? `${ord.note} | ` : '') + 'Hệ thống tự động hủy đơn do quá hạn 15 phút chưa chuyển khoản VietQR',
          },
          $push: {
            statusHistory: {
              status: 'cancelled',
              updatedBy: 'Hệ thống tự động (Cron)',
              role: 'System',
              note: 'Tự động hủy đơn do quá hạn 15 phút chưa nhận được thanh toán VietQR',
              updatedAt: now,
            },
          },
        },
        { new: true }
      );

      if (!locked) continue;

      // 1. Hoàn trả tồn kho vật lý và giải phóng reservedStock
      const targetStoreId = locked.warehouseId || locked.storeId || 'store-thuduc';
      const restoreMap = new Map();

      for (const item of locked.items || []) {
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
          { $inc: { stock: info.totalQty, reservedStock: -info.totalQty } },
          { new: false }
        );

        await StoreInventory.findOneAndUpdate(
          { storeId: targetStoreId, productId: pid },
          { $inc: { physicalStock: info.totalQty, reservedStock: -info.totalQty } }
        );

        if (prevDoc) {
          const oldStock = Math.max(0, Number(prevDoc.stock ?? 0));
          const newStock = oldStock + info.totalQty;
          InventoryLog.create({
            product: prevDoc._id,
            productName: prevDoc.name || info.productName,
            type: 'order_cancel',
            delta: info.totalQty,
            oldStock,
            newStock,
            storeId: targetStoreId,
            reason: `Tự động hủy đơn VietQR quá hạn #${locked.orderCode} - Hoàn kho`,
            note: 'Tự động hoàn tồn bởi scheduler',
          }).catch(() => {});
        }
      }

      // 2. Hoàn lại lượt dùng Voucher nếu có
      if (locked.voucherCode) {
        Voucher.updateOne({ code: locked.voucherCode }, { $inc: { usedCount: -1 } }).catch(() => {});
        if (locked.user) {
          UserVoucher.updateOne(
            { user: locked.user, voucherCode: locked.voucherCode },
            { $set: { isUsed: false, usedAt: null } }
          ).catch(() => {});
        }
      }

      // 3. Thông báo cho khách hàng
      if (locked.user) {
        sendRealtimeNotification({
          recipient: locked.user,
          title: `Đơn hàng #${locked.orderCode} đã bị hủy`,
          body: 'Đơn hàng thanh toán VietQR của bạn đã tự động hủy do quá hạn 15 phút chưa nhận được chuyển khoản. Tồn kho đã được hoàn lại.',
          type: 'order',
          path: '/account?tab=orders',
          orderId: locked._id,
        });
      }

      cancelledCount++;
      console.log(`[OrderExpiryScheduler] [OK] Đã tự động hủy đơn VietQR quá hạn #${locked.orderCode} và hoàn tồn kho cho chi nhánh [${targetStoreId}].`);
    }

    return cancelledCount;
  } catch (err) {
    console.error('[OrderExpiryScheduler] Lỗi khi quét đơn VietQR quá hạn:', err);
    return 0;
  }
}

let expiryTimer = null;
function startOrderExpiryScheduler(intervalMs = 30000) {
  if (expiryTimer) return;
  // Quét ngay lập tức khi khởi động server
  sweepExpiredVietQrOrders().catch(() => {});
  // Quét định kỳ mỗi 30 giây
  expiryTimer = setInterval(() => {
    sweepExpiredVietQrOrders().catch(() => {});
  }, intervalMs);
  console.log('[OrderExpiryScheduler] [OK] Đã kích hoạt tiến trình tự động hủy đơn VietQR quá hạn 15 phút (chu kỳ 30s).');
}

module.exports = {
  sweepExpiredVietQrOrders,
  startOrderExpiryScheduler,
};
