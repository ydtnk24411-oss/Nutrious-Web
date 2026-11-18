const User = require('../models/User');
const Order = require('../models/Order');
const PointTransaction = require('../models/PointTransaction');
const LoyaltyConfig = require('../models/LoyaltyConfig');

const CONFIG_CACHE_TTL_MS = 60000;
let cachedConfig = null;
let cachedAt = 0;

/**
 * Đọc cấu hình hạng thành viên & quà đổi điểm từ MongoDB (cache 60s).
 */
async function getLoyaltyConfig() {
  if (cachedConfig && Date.now() - cachedAt < CONFIG_CACHE_TTL_MS) {
    return cachedConfig;
  }
  const doc = await LoyaltyConfig.findOne({ key: 'main' }).lean();
  cachedConfig = doc || { tiers: [], rewards: [] };
  cachedAt = Date.now();
  return cachedConfig;
}

const tierFor = (points = 0, totalSpent = 0, tiers = []) => {
  if (!Array.isArray(tiers) || tiers.length === 0) return 'bronze';
  const sorted = [...tiers].sort((a, b) => (b.minPoints || 0) - (a.minPoints || 0));
  const matched = sorted.find((t) => points >= (t.minPoints || 0) && totalSpent >= (t.minSpent || 0));
  return matched ? matched.tier : sorted[sorted.length - 1].tier;
};

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

  const points = order.estimatedPoints || Math.floor((order.subtotal || order.total) / 1000);
  const user = await User.findByIdAndUpdate(
    order.user,
    { $inc: { points, totalSpent: order.total } },
    { new: true }
  );
  if (!user) return null;

  const { tiers } = await getLoyaltyConfig();
  const tier = tierFor(user.points, user.totalSpent, tiers);
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

/**
 * Đồng bộ tổng chi tiêu, tích điểm và hạng thành viên chính xác 100% theo các đơn hàng thực tế
 */
async function syncUserLoyalty(userId) {
  if (!userId) return null;
  const user = await User.findById(userId);
  if (!user) return null;

  const uncreditedOrders = await Order.find({
    user: user._id,
    status: { $ne: 'cancelled' },
    pointsAwarded: { $ne: true },
    $or: [
      { paymentStatus: 'paid' },
      { status: 'delivered' },
    ],
  });

  for (const ord of uncreditedOrders) {
    await creditOrderPoints(ord._id);
  }

  const orderStats = await Order.aggregate([
    { $match: { user: user._id, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: '$total' },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  const actualSpent = orderStats[0]?.totalSpent || 0;
  const [freshUser, loyaltyCfg] = await Promise.all([
    User.findById(userId),
    getLoyaltyConfig(),
  ]);
  if (!freshUser) return null;

  const currentPoints = freshUser.points || 0;
  const correctTier = tierFor(currentPoints, actualSpent, loyaltyCfg.tiers);

  if (freshUser.totalSpent !== actualSpent || freshUser.tier !== correctTier) {
    freshUser.totalSpent = actualSpent;
    freshUser.tier = correctTier;
    await freshUser.save();
  }

  return freshUser;
}

/**
 * Thu hồi điểm và khấu trừ chi tiêu khi đơn hàng bị hủy hoặc hoàn trả (BORIS / Refund).
 */
async function rollbackOrderPoints(orderId, reason = 'Hủy/hoàn trả đơn hàng') {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, user: { $ne: null }, pointsAwarded: true, pointsRollbacked: { $ne: true } },
    { $set: { pointsRollbacked: true } },
    { new: true }
  );
  if (!order) return null;

  const points = order.estimatedPoints || Math.floor((order.subtotal || order.total) / 1000);
  const user = await User.findById(order.user);
  if (!user) return null;

  const newPoints = Math.max(0, (user.points || 0) - points);
  const newSpent = Math.max(0, (user.totalSpent || 0) - (order.total || 0));
  const { tiers } = await getLoyaltyConfig();
  const newTier = tierFor(newPoints, newSpent, tiers);

  user.points = newPoints;
  user.totalSpent = newSpent;
  user.tier = newTier;
  await user.save();

  await PointTransaction.create({
    user: user._id,
    type: 'redeemed',
    amount: -points,
    description: `Thu hồi điểm do ${reason} #${order.orderCode}`,
    order: order.orderCode,
    balanceAfter: user.points,
  });

  return { pointsDeducted: points, newBalance: user.points, newTier };
}

module.exports = { getLoyaltyConfig, tierFor, creditOrderPoints, syncUserLoyalty, rollbackOrderPoints };
