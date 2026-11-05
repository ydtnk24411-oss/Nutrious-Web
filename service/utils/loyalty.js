const User = require('../models/User');
const Order = require('../models/Order');
const PointTransaction = require('../models/PointTransaction');

// Hạng thành viên: cần ĐỦ cả điểm lẫn tổng chi tiêu (giống chính sách hiển thị ở frontend)
const TIERS = [
  { tier: 'platinum', minPoints: 15000, minSpent: 30000000 },
  { tier: 'gold',     minPoints: 5000,  minSpent: 10000000 },
  { tier: 'silver',   minPoints: 1000,  minSpent: 2000000 },
  { tier: 'bronze',   minPoints: 0,     minSpent: 0 },
];

const tierFor = (points = 0, totalSpent = 0) =>
  (TIERS.find((t) => points >= t.minPoints && totalSpent >= t.minSpent) || TIERS[TIERS.length - 1]).tier;

// Quà đổi điểm – server quyết định số điểm cần thiết
const REWARDS = [
  { id: 'r1', name: 'Voucher 50.000đ',    pointsRequired: 500,  type: 'voucher',  value: 50000 },
  { id: 'r2', name: 'Miễn phí giao hàng', pointsRequired: 300,  type: 'shipping', value: 25000 },
  { id: 'r3', name: 'Voucher 100.000đ',   pointsRequired: 1000, type: 'voucher',  value: 100000 },
  { id: 'r4', name: 'Giỏ quà sinh nhật',  pointsRequired: 2000, type: 'gift' },
];

/**
 * Cộng điểm cho chủ đơn hàng khi đơn được giao (delivered).
 * Dùng cờ pointsAwarded + cập nhật nguyên tử để mỗi đơn chỉ được cộng đúng 1 lần.
 */
async function creditOrderPoints(orderId) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, user: { $ne: null }, pointsAwarded: { $ne: true } },
    { $set: { pointsAwarded: true } },
    { new: true }
  );
  if (!order) return null;

  const points = order.estimatedPoints || Math.floor(order.subtotal / 1000);
  const user = await User.findByIdAndUpdate(
    order.user,
    { $inc: { points, totalSpent: order.total } },
    { new: true }
  );
  if (!user) return null;

  const tier = tierFor(user.points, user.totalSpent);
  if (tier !== user.tier) await User.updateOne({ _id: user._id }, { $set: { tier } });

  await PointTransaction.create({
    user: user._id,
    type: 'earned',
    amount: points,
    description: `Tích điểm từ đơn hàng ${order.orderCode}`,
    order: order.orderCode,
    balanceAfter: user.points,
  });
  return { points, balance: user.points };
}

module.exports = { TIERS, REWARDS, tierFor, creditOrderPoints };

