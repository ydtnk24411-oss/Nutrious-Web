const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const Order = require('../models/Order');

/**
 * Kiểm tra xem voucher có nằm trong khung giờ vàng hoặc ngày trong tuần quy định không.
 * Giờ tính theo múi giờ Việt Nam (Asia/Ho_Chi_Minh).
 */
function checkVoucherTimeWindow(voucher) {
  if (!voucher) return { valid: true };

  const now = new Date();
  const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(vnTimeStr);

  // 1. Kiểm tra ngày trong tuần (0: Chủ Nhật, 1: Thứ Hai, ..., 6: Thứ Bảy)
  if (Array.isArray(voucher.activeDaysOfWeek) && voucher.activeDaysOfWeek.length > 0) {
    const currentDay = vnDate.getDay();
    if (!voucher.activeDaysOfWeek.includes(currentDay)) {
      const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      const allowedDays = voucher.activeDaysOfWeek.map(d => dayNames[d]).join(', ');
      return {
        valid: false,
        reason: 'DAY_MISMATCH',
        message: `Mã chỉ áp dụng vào các ngày: ${allowedDays}.`,
      };
    }
  }

  // 2. Kiểm tra khung giờ trong ngày (start - end: "HH:mm")
  if (voucher.activeTimeWindow && voucher.activeTimeWindow.start && voucher.activeTimeWindow.end) {
    const currentHour = vnDate.getHours();
    const currentMinute = vnDate.getMinutes();
    const currentMins = currentHour * 60 + currentMinute;

    const [startH, startM] = voucher.activeTimeWindow.start.split(':').map(Number);
    const [endH, endM] = voucher.activeTimeWindow.end.split(':').map(Number);
    const startMins = startH * 60 + (startM || 0);
    const endMins = endH * 60 + (endM || 0);

    if (currentMins < startMins || currentMins > endMins) {
      return {
        valid: false,
        reason: 'TIME_WINDOW_MISMATCH',
        timeWindow: voucher.activeTimeWindow,
        message: `Mã chỉ áp dụng trong khung giờ vàng từ ${voucher.activeTimeWindow.start} đến ${voucher.activeTimeWindow.end}.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Xác định xem voucher có phải loại dùng 1 lần cho mỗi khách hàng hay không:
 * - Voucher chào mừng thành viên mới (WELCOME...)
 * - Voucher giới hạn 1 lần/khách (maxUsagePerUser === 1 hoặc isFirstOrderOnly === true)
 */
function isSingleUseVoucher(voucher) {
  if (!voucher) return false;
  if (voucher.isFirstOrderOnly || voucher.maxUsagePerUser === 1) return true;
  const code = String(voucher.code || '').trim().toUpperCase();
  if (code.startsWith('WELCOME')) return true;
  const desc = `${voucher.name || ''} ${voucher.description || ''}`.toLowerCase();
  return desc.includes('đơn hàng đầu tiên') || desc.includes('thành viên mới');
}

/**
 * Lọc các sản phẩm hợp lệ trong giỏ hàng theo điều kiện danh mục/sản phẩm/không giảm giá (excludeSaleItems).
 * Trả về tổng tiền hợp lệ (eligibleSubtotal) và số lượng món hợp lệ.
 */
function calculateEligibleItemsAndSubtotal(voucher, items, fallbackSubtotal) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      eligibleSubtotal: Number(fallbackSubtotal) || 0,
      hasApplicableFilter: false,
      eligibleItemsCount: 0,
    };
  }

  const hasCatFilter = Array.isArray(voucher.applicableCategories) && voucher.applicableCategories.length > 0;
  const hasProdFilter = Array.isArray(voucher.applicableProductIds) && voucher.applicableProductIds.length > 0;
  const excludeSale = Boolean(voucher.excludeSaleItems);

  if (!hasCatFilter && !hasProdFilter && !excludeSale) {
    const sub = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
    return {
      eligibleSubtotal: sub > 0 ? sub : (Number(fallbackSubtotal) || 0),
      hasApplicableFilter: false,
      eligibleItemsCount: items.length,
    };
  }

  let eligibleSubtotal = 0;
  let eligibleCount = 0;

  const targetCats = hasCatFilter ? voucher.applicableCategories.map(c => String(c).trim().toLowerCase()) : [];
  const targetProds = hasProdFilter ? voucher.applicableProductIds.map(p => String(p)) : [];

  for (const it of items) {
    // 1. Kiểm tra excludeSaleItems
    if (excludeSale) {
      const orig = Number(it.originalPrice) || 0;
      const curr = Number(it.price) || 0;
      if (it.isFlashSale || (orig > curr && orig > 0)) {
        continue;
      }
    }

    // 2. Kiểm tra targetProds
    const itProdId = it.product ? String(it.product._id || it.product) : '';
    if (hasProdFilter && (!itProdId || !targetProds.includes(itProdId))) {
      continue;
    }

    // 3. Kiểm tra targetCats
    if (hasCatFilter) {
      const cat = String(it.category || it.categoryVi || it.categorySlug || '').toLowerCase();
      const matchCat = targetCats.some(tc => cat.includes(tc) || tc.includes(cat));
      if (!matchCat) {
        continue;
      }
    }

    const itemTotal = (Number(it.price) || 0) * (Number(it.quantity) || 1);
    eligibleSubtotal += itemTotal;
    eligibleCount++;
  }

  return {
    eligibleSubtotal,
    hasApplicableFilter: true,
    eligibleItemsCount: eligibleCount,
  };
}

/**
 * Kiểm tra voucher cho một giỏ hàng và tính số tiền giảm theo chuẩn kế toán.
 * Hỗ trợ tham số linh hoạt:
 * - evaluateVoucher(code, subtotal, userId, customerPhone, customerEmail)
 * - evaluateVoucher(code, { subtotal, items, userId, customerPhone, customerEmail, paymentMethod, expectedVoucherType })
 */
async function evaluateVoucher(code, subtotalOrOptions, userIdArg, customerPhoneArg, customerEmailArg) {
  const fail = (message, extra = {}) => ({ valid: false, message, discount: 0, eligibleSubtotal: 0, ...extra });

  let subtotal = 0;
  let items = [];
  let userId = userIdArg;
  let customerPhone = customerPhoneArg;
  let customerEmail = customerEmailArg;
  let paymentMethod = null;
  let expectedVoucherType = null;

  if (typeof subtotalOrOptions === 'object' && subtotalOrOptions !== null) {
    subtotal = Number(subtotalOrOptions.subtotal) || 0;
    items = subtotalOrOptions.items || [];
    userId = subtotalOrOptions.userId || userId;
    customerPhone = subtotalOrOptions.customerPhone || customerPhone;
    customerEmail = subtotalOrOptions.customerEmail || customerEmail;
    paymentMethod = subtotalOrOptions.paymentMethod || null;
    expectedVoucherType = subtotalOrOptions.expectedVoucherType || null;
  } else {
    subtotal = Number(subtotalOrOptions) || 0;
  }

  const cleanCode = String(code || '').trim().toUpperCase();
  const voucher = await Voucher.findOne({
    code: cleanCode,
    isActive: true,
  });
  if (!voucher) return fail('Mã voucher không tồn tại hoặc đã bị vô hiệu hoá.');

  // 1. Kiểm tra thời hạn hiệu lực (startDate - endDate)
  const now = new Date();
  if (now < voucher.startDate || now > voucher.endDate) {
    return fail('Voucher chưa đến hạn hoặc đã hết hạn.');
  }

  // 2. Kiểm tra khung giờ vàng / chu kỳ thời gian (activeTimeWindow, activeDaysOfWeek)
  const timeCheck = checkVoucherTimeWindow(voucher);
  if (!timeCheck.valid) {
    return fail(timeCheck.message, { reason: timeCheck.reason, timeWindow: timeCheck.timeWindow });
  }

  // 3. Kiểm tra tổng số lượng kho (pool limit)
  if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
    return fail('Voucher đã hết lượt sử dụng.');
  }

  // 4. Kiểm tra quyền áp dụng cho voucher riêng tư / cá nhân hóa (isPublic: false, assignedCustomerIds)
  const userVoucher = userId
    ? await UserVoucher.findOne({ user: userId, voucher: voucher._id })
    : null;

  if (userVoucher && userVoucher.status === 'expired') {
    return fail('Voucher của bạn đã hết hạn.');
  }

  if (voucher.pointsRequired > 0 && !userVoucher) {
    return fail(
      userId
        ? 'Voucher này cần được đổi điểm / thu thập trước khi sử dụng.'
        : 'Vui lòng đăng nhập và thu thập voucher này trước khi sử dụng.'
    );
  }

  if (voucher.isPublic === false || (Array.isArray(voucher.assignedCustomerIds) && voucher.assignedCustomerIds.length > 0)) {
    if (!userId) {
      return fail('Mã voucher này là ưu đãi riêng tư. Vui lòng đăng nhập tài khoản để sử dụng.');
    }
    const isAssigned = voucher.assignedCustomerIds && voucher.assignedCustomerIds.some(
      id => String(id) === String(userId)
    );
    if (!isAssigned && !userVoucher) {
      return fail('Mã ưu đãi này chỉ dành riêng cho khách hàng được chỉ định.');
    }
  }

  // 5. Kiểm tra ràng buộc phương thức thanh toán (requiredPaymentMethod)
  if (voucher.requiredPaymentMethod && paymentMethod) {
    const reqPm = String(voucher.requiredPaymentMethod).trim().toLowerCase();
    const curPm = String(paymentMethod).trim().toLowerCase();
    if (reqPm === 'online') {
      if (curPm === 'cod') {
        return fail('Mã ưu đãi này chỉ áp dụng cho thanh toán trực tuyến (Chuyển khoản VietQR / Online).');
      }
    } else if (reqPm !== curPm) {
      const pmLabel = reqPm === 'bank_transfer' ? 'Chuyển khoản VietQR' : reqPm.toUpperCase();
      return fail(`Mã ưu đãi chỉ áp dụng khi thanh toán bằng ${pmLabel}.`);
    }
  }

  // 6. Kiểm tra quy tắc cộng dồn / loại voucher (Voucher Stacking)
  const actualVoucherType = voucher.voucherType || (
    cleanCode === 'FREESHIP' || /freeship|vận chuyển|giao hàng|phí ship/i.test(`${voucher.name} ${voucher.description}`)
      ? 'SHIPPING_DISCOUNT'
      : 'ORDER_DISCOUNT'
  );
  if (expectedVoucherType && actualVoucherType !== expectedVoucherType) {
    return fail(
      expectedVoucherType === 'SHIPPING_DISCOUNT'
        ? 'Mã này là voucher giảm tiền hàng, vui lòng áp dụng ở ô Mã giảm giá đơn hàng.'
        : 'Mã này là voucher vận chuyển, vui lòng áp dụng ở ô Voucher vận chuyển.'
    );
  }

  // Chuẩn bị điều kiện tìm kiếm lịch sử đơn hàng của khách hàng
  const orderConditions = [];
  if (userId) {
    orderConditions.push({ user: userId });
  }
  if (customerPhone) {
    const rawPhone = String(customerPhone).trim();
    const phoneVariants = [
      rawPhone,
      rawPhone.startsWith('0') ? `+84${rawPhone.slice(1)}` : rawPhone,
      rawPhone.startsWith('+84') ? `0${rawPhone.slice(3)}` : rawPhone,
    ];
    orderConditions.push({ guestPhone: { $in: phoneVariants } });
  }
  if (customerEmail) {
    orderConditions.push({ guestEmail: String(customerEmail).trim().toLowerCase() });
  }

  // 7. PHÂN BIỆT RÕ: isFirstOrderOnly (Đơn đầu tiên) vs maxUsagePerUser (Trần số lần/người)
  const isFirstOrder = Boolean(voucher.isFirstOrderOnly || cleanCode.startsWith('WELCOME'));
  if (isFirstOrder) {
    if (userVoucher && userVoucher.status === 'used') {
      return fail('Bạn đã sử dụng ưu đãi chào mừng thành viên mới rồi.');
    }

    // Điều kiện bắt buộc: số lượng đơn hàng hợp lệ trước đó của khách phải bằng 0 (status !== 'cancelled')
    if (orderConditions.length > 0) {
      const priorValidOrdersCount = await Order.countDocuments({
        $or: orderConditions,
        status: { $ne: 'cancelled' },
      });
      if (priorValidOrdersCount > 0) {
        return fail('Mã ưu đãi này chỉ áp dụng cho đơn hàng đầu tiên của khách hàng mới.');
      }
    }
  }

  // 8. Kiểm soát đầu cơ: maxUsagePerUser
  const userCap = Number(voucher.maxUsagePerUser) || 0;
  if (userCap > 0 && orderConditions.length > 0) {
    const usedByCustomerCount = await Order.countDocuments({
      $and: [
        { $or: orderConditions },
        { status: { $ne: 'cancelled' } },
        {
          $or: [
            { voucherCode: cleanCode },
            { shippingVoucherCode: cleanCode },
          ],
        },
      ],
    });
    if (usedByCustomerCount >= userCap) {
      return fail(
        userCap === 1
          ? 'Mã voucher này chỉ áp dụng 1 lần cho mỗi khách hàng (đã được sử dụng ở đơn trước).'
          : `Bạn đã đạt giới hạn sử dụng voucher này (${userCap} lần).`
      );
    }
  }

  // 9. Tính toán trên nhóm sản phẩm hợp lệ (Danh mục, Sản phẩm, Exclude Sale)
  const { eligibleSubtotal, hasApplicableFilter, eligibleItemsCount } = calculateEligibleItemsAndSubtotal(voucher, items, subtotal);
  if (hasApplicableFilter && eligibleSubtotal <= 0) {
    return fail('Đơn hàng không có sản phẩm nào thuộc danh mục/nhóm hàng áp dụng voucher này.');
  }

  // 10. Đối chiếu giá trị tối thiểu (minOrderValue tính trên tiền hàng hợp lệ, không cộng phí ship)
  if (voucher.minOrderValue && eligibleSubtotal < voucher.minOrderValue) {
    return fail(`Giá trị sản phẩm hợp lệ tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ.`);
  }

  // 11. Thứ tự tính toán chiết khấu chuẩn kế toán (chặn âm tiền)
  let discount = 0;
  if (voucher.discountType === 'percentage') {
    discount = Math.floor((eligibleSubtotal * voucher.discountValue) / 100);
    if (voucher.maxDiscountValue) {
      discount = Math.min(discount, voucher.maxDiscountValue);
    }
  } else {
    discount = voucher.discountValue;
  }
  discount = Math.max(0, Math.min(discount, eligibleSubtotal));

  return {
    valid: true,
    discount,
    eligibleSubtotal,
    eligibleItemsCount,
    voucher,
    userVoucher,
    voucherType: actualVoucherType,
  };
}

/** Đánh dấu voucher đã dùng cho đơn hàng và cập nhật bộ đếm. */
async function consumeVoucher({ voucher, userVoucher }, userId, orderId) {
  if (voucher?._id) {
    await Voucher.updateOne({ _id: voucher._id }, { $inc: { usedCount: 1 } });
  }

  if (!userId) return;

  const singleUse = isSingleUseVoucher(voucher);

  if (userVoucher) {
    if (singleUse || userVoucher.pointsRequired > 0) {
      await UserVoucher.updateOne(
        { _id: userVoucher._id, status: 'available' },
        { $set: { status: 'used', usedAt: new Date(), orderId } }
      );
    }
  } else if (voucher?._id && singleUse) {
    await UserVoucher.create({
      user: userId, voucher: voucher._id, status: 'used', usedAt: new Date(), orderId,
    });
  }
}

/**
 * Tự động hoàn lại lượt sử dụng voucher khi đơn hàng bị hủy (status: 'cancelled').
 * - Giảm usedCount của voucher trong kho (-1)
 * - Mở khóa lại UserVoucher của khách để có thể áp dụng lại
 */
async function restoreOrderVoucherOnce(order) {
  if (!order) return;

  // 1. Hoàn trả voucher giảm tiền hàng
  if (order.voucherCode) {
    const code = String(order.voucherCode).trim().toUpperCase();
    await Voucher.updateOne(
      { code, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } }
    );
    if (order.user) {
      await UserVoucher.updateMany(
        { user: order.user, orderId: order._id },
        { $set: { status: 'available', usedAt: null, orderId: null } }
      );
    }
  }

  // 2. Hoàn trả voucher vận chuyển (Freeship)
  if (order.shippingVoucherCode) {
    const shipCode = String(order.shippingVoucherCode).trim().toUpperCase();
    await Voucher.updateOne(
      { code: shipCode, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } }
    );
    if (order.user) {
      await UserVoucher.updateMany(
        { user: order.user, orderId: order._id },
        { $set: { status: 'available', usedAt: null, orderId: null } }
      );
    }
  }
}

module.exports = {
  evaluateVoucher,
  consumeVoucher,
  restoreOrderVoucherOnce,
  isSingleUseVoucher,
  checkVoucherTimeWindow,
  calculateEligibleItemsAndSubtotal,
};
