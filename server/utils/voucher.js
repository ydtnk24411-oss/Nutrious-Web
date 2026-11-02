const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');

/**
 * Kiểm tra voucher cho một giỏ hàng và tính số tiền giảm (server tự tính, không tin client).
 * userId có thể undefined (khách vãng lai).
 */
async function evaluateVoucher(code, subtotal, userId) {
  const fail = (message) => ({ valid: false, message, discount: 0 });

  const voucher = await Voucher.findOne({
    code: String(code || '').trim().toUpperCase(),
    isActive: true,
  });
  if (!voucher) return fail('Mã voucher không tồn tại hoặc đã bị vô hiệu hoá.');

  const now = new Date();
  if (now < voucher.startDate || now > voucher.endDate) {
    return fail('Voucher chưa đến hạn hoặc đã hết hạn.');
  }

  const userVoucher = userId
    ? await UserVoucher.findOne({ user: userId, voucher: voucher._id })
    : null;

  if (userVoucher && userVoucher.status === 'used') return fail('Bạn đã sử dụng voucher này rồi.');
  if (userVoucher && userVoucher.status === 'expired') return fail('Voucher của bạn đã hết hạn.');

  if (!userVoucher) {
    if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
      return fail('Voucher đã hết lượt sử dụng.');
    }
    if (voucher.pointsRequired > 0) {
      return fail(
        userId
          ? 'Voucher này cần được đổi điểm / thu thập trước khi sử dụng.'
          : 'Vui lòng đăng nhập và thu thập voucher này trước khi sử dụng.'
      );
    }
  }

  if (voucher.minOrderValue && subtotal < voucher.minOrderValue) {
    return fail(`Đơn hàng tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ.`);
  }

  let discount = voucher.discountType === 'percentage'
    ? (subtotal * voucher.discountValue) / 100
    : voucher.discountValue;
  if (voucher.discountType === 'percentage' && voucher.maxDiscountValue) {
    discount = Math.min(discount, voucher.maxDiscountValue);
  }
  discount = Math.max(0, Math.min(Math.floor(discount), subtotal));

  return { valid: true, discount, voucher, userVoucher };
}

/** Đánh dấu voucher đã dùng cho đơn hàng của user (nếu là khách thì bỏ qua). */
async function consumeVoucher({ voucher, userVoucher }, userId, orderId) {
  if (!userId) return;
  if (userVoucher) {
    await UserVoucher.updateOne(
      { _id: userVoucher._id, status: 'available' },
      { $set: { status: 'used', usedAt: new Date(), orderId } }
    );
  } else {
    // Voucher công khai dùng trực tiếp: ghi nhận lịch sử dùng + tăng bộ đếm
    await UserVoucher.create({
      user: userId, voucher: voucher._id, status: 'used', usedAt: new Date(), orderId,
    });
    await Voucher.updateOne({ _id: voucher._id }, { $inc: { usedCount: 1 } });
  }
}

module.exports = { evaluateVoucher, consumeVoucher };

