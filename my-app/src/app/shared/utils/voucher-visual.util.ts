import { Voucher } from '../models/xanh-la.models';

export type VoucherThemeKey =
  | 'forest-emerald'
  | 'harvest-gold'
  | 'orchard-olive'
  | 'warm-terracotta'
  | 'lagoon-teal'
  | 'deep-pine';

export interface VoucherCardVisual {
  themeKey: VoucherThemeKey;
  categoryLabel: string;
  stubTag: string;
  discountDisplay: string;
  minOrderShort: string;
  isShipping: boolean;
  categoriesLabel: string;
  paymentLabel: string;
}

export interface VoucherConditionRow {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface VoucherConditionSection {
  id: string;
  icon: string;
  title: string;
  rows: VoucherConditionRow[];
}

const THEME_ROTATION: VoucherThemeKey[] = [
  'forest-emerald',
  'harvest-gold',
  'orchard-olive',
  'warm-terracotta',
  'lagoon-teal',
  'deep-pine',
];

const CATEGORY_MAP: Record<string, string> = {
  vegetables: 'Rau củ hữu cơ',
  'rau củ': 'Rau củ hữu cơ',
  'rau-cu': 'Rau củ hữu cơ',
  fruits: 'Trái cây tươi',
  'trái cây': 'Trái cây tươi',
  'trai-cay': 'Trái cây tươi',
  meat: 'Thịt sạch & Hải sản',
  seafood: 'Cá & Hải sản tươi',
  'thịt': 'Thịt sạch & Hải sản',
  dairy: 'Sữa & Thực phẩm mát',
  beverages: 'Đồ uống lành mạnh',
  pantry: 'Thực phẩm khô & Gia vị',
  bakery: 'Bánh & Đồ ăn vặt',
};

const WEEKDAY_LABELS = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** Định dạng tiền rút gọn cho badge trên thẻ voucher (vd: 150000 -> "150K", 0 -> "0đ"). */
export function formatShortCurrency(amount?: number): string {
  const val = Number(amount) || 0;
  if (val <= 0) return '0đ';
  if (val >= 1000 && val % 1000 === 0) {
    return `${val / 1000}K`;
  }
  return `${val.toLocaleString('vi-VN')}đ`;
}

/** Định dạng tiền đầy đủ chuẩn Việt Nam (vd: 150000 -> "150.000đ"). */
export function formatFullCurrency(amount?: number): string {
  return `${(Number(amount) || 0).toLocaleString('vi-VN')}đ`;
}

/** Chuẩn hóa chuỗi ngày (ISO hoặc DD/MM/YYYY) thành DD/MM/YYYY an toàn. */
export function formatVoucherDateVi(raw?: string): string {
  const text = String(raw || '').trim();
  if (!text) return 'Đang cập nhật';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [d, m, y] = text.split('/');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  const dt = new Date(text);
  if (Number.isNaN(dt.getTime())) return text;
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Kiểm tra xem voucher thuộc nhóm miễn/hỗ trợ phí giao hàng hay giảm tiền hàng. */
export function isShippingVoucher(v: Voucher): boolean {
  if (v.voucherType === 'SHIPPING_DISCOUNT') return true;
  const code = (v.code || '').toUpperCase();
  return code.startsWith('FREESHIP') || v.type === 'freeship';
}

/** Chuyển danh sách slug danh mục thành nhãn Tiếng Việt không trùng lặp. */
export function resolveCategoryLabels(cats?: string[]): string[] {
  if (!Array.isArray(cats) || cats.length === 0) return [];
  const unique = new Set<string>();
  for (const c of cats) {
    const key = String(c || '').trim().toLowerCase();
    if (!key) continue;
    unique.add(CATEGORY_MAP[key] || c.trim());
  }
  return Array.from(unique);
}

/** Chuyển mã phương thức thanh toán thành tên hiển thị rõ ràng. */
export function formatPaymentMethodLabel(method?: string | null): string {
  if (!method) return 'Tất cả phương thức (COD, VietQR, Online)';
  const m = method.trim().toLowerCase();
  if (m === 'bank_transfer') return 'Chuyển khoản ngân hàng / VietQR';
  if (m === 'online') return 'Thanh toán trực tuyến (VietQR / Chuyển khoản)';
  if (m === 'cod') return 'Thanh toán khi nhận hàng (COD)';
  return method.toUpperCase();
}

/** Xây dựng cấu hình giao diện, màu nền hài hòa logo Evergreen Mart & nhãn cho từng thẻ voucher. */
export function buildVoucherVisual(v: Voucher, index = 0): VoucherCardVisual {
  const code = (v.code || '').toUpperCase();
  const hay = `${code} ${v.name || ''} ${v.description || ''}`.toLowerCase();
  const shipping = isShippingVoucher(v);
  const categories = resolveCategoryLabels(v.applicableCategories);

  let discountDisplay: string;
  if (shipping) {
    discountDisplay = v.type === 'percentage' ? `${v.value}%` : 'FREE';
  } else if (v.type === 'percentage') {
    discountDisplay = `${v.value}%`;
  } else {
    discountDisplay = formatShortCurrency(v.value);
  }

  let themeKey: VoucherThemeKey = THEME_ROTATION[index % THEME_ROTATION.length];
  let categoryLabel = 'Ưu Đãi Evergreen';
  let stubTag = code.slice(0, 10) || 'VOUCHER';

  if (v.requiredPaymentMethod === 'bank_transfer' || code.includes('ONLINE') || hay.includes('vietqr')) {
    themeKey = 'forest-emerald';
    categoryLabel = 'Thanh toán Online';
    stubTag = 'VIETQR';
  } else if (shipping) {
    themeKey = 'lagoon-teal';
    categoryLabel = 'Vận Chuyển 2 Giờ';
    stubTag = 'GIAO 2H';
  } else if (v.isFirstOrderOnly || code.startsWith('WELCOME')) {
    themeKey = 'harvest-gold';
    categoryLabel = 'Độc quyền Tân thủ';
    stubTag = 'KHÁCH MỚI';
  } else if (code.includes('GREEN') || hay.includes('nilon') || hay.includes('môi trường')) {
    themeKey = 'orchard-olive';
    categoryLabel = 'Bảo vệ môi trường';
    stubTag = 'THỨ 4 XANH';
  } else if (categories.some((c) => c.includes('Trái cây')) || code.includes('FRUIT') || code === 'XANHLA20') {
    themeKey = 'warm-terracotta';
    categoryLabel = 'Trái Cây Tươi';
    stubTag = 'TRÁI CÂY';
  } else if (categories.some((c) => c.includes('Thịt')) || code.includes('MEAT')) {
    themeKey = 'warm-terracotta';
    categoryLabel = 'Thịt Sạch & Hải Sản';
    stubTag = 'THỊT & CÁ';
  } else if (categories.some((c) => c.includes('Rau củ')) || code === 'XANHLA30') {
    themeKey = 'orchard-olive';
    categoryLabel = 'Rau Củ Hữu Cơ';
    stubTag = 'RAU CỦ';
  } else if (code.includes('DRINK')) {
    themeKey = 'lagoon-teal';
    categoryLabel = 'Đồ Uống Lành Mạnh';
    stubTag = 'ĐỒ UỐNG';
  } else if (code.includes('DRY')) {
    themeKey = 'harvest-gold';
    categoryLabel = 'Thực Phẩm Khô & Hạt';
    stubTag = 'NGŨ CỐC';
  } else if (v.activeTimeWindow?.start || code.includes('MORNING')) {
    themeKey = 'harvest-gold';
    categoryLabel = v.activeTimeWindow?.start
      ? `Khung giờ ${v.activeTimeWindow.start} – ${v.activeTimeWindow.end}`
      : 'Đi Chợ Buổi Sáng';
    stubTag = 'ĐI CHỢ SỚM';
  } else if ((Array.isArray(v.activeDaysOfWeek) && v.activeDaysOfWeek.length > 0) || code.includes('WEEKEND')) {
    themeKey = 'warm-terracotta';
    categoryLabel = 'Flash Sale Cuối Tuần';
    stubTag = 'CUỐI TUẦN';
  } else if (code.includes('NUTRITION') || code.includes('COMBO')) {
    themeKey = 'deep-pine';
    categoryLabel = 'Thực Đơn Dinh Dưỡng';
    stubTag = 'DINH DƯỠNG';
  } else if (code.includes('BIRTHDAY')) {
    themeKey = 'harvest-gold';
    categoryLabel = 'Quà Mừng Sinh Nhật';
    stubTag = 'SINH NHẬT';
  } else if (code.includes('GOLD') || code.includes('VIP')) {
    themeKey = 'harvest-gold';
    categoryLabel = 'Thành Viên Thân Thiết';
    stubTag = 'VIP CLUB';
  } else if (code.includes('POINT')) {
    themeKey = 'forest-emerald';
    categoryLabel = 'Đổi Điểm Thưởng';
    stubTag = 'ĐỔI ĐIỂM';
  } else if (code.includes('NOV') || hay.includes('sống xanh')) {
    themeKey = 'orchard-olive';
    categoryLabel = 'Tuần Lễ Sống Xanh';
    stubTag = 'SỐNG XANH';
  } else if (code.includes('BIG') || (v.minValue || 0) >= 400000) {
    themeKey = 'deep-pine';
    categoryLabel = 'Mua Sắm Cả Tuần';
    stubTag = 'ĐƠN LỚN';
  }

  return {
    themeKey,
    categoryLabel,
    stubTag,
    discountDisplay,
    minOrderShort: (v.minValue || 0) > 0 ? `Đơn từ ${formatShortCurrency(v.minValue)}` : 'Mọi đơn hàng (từ 0đ)',
    isShipping: shipping,
    categoriesLabel: categories.length > 0 ? categories.join(', ') : 'Toàn bộ danh mục nông sản & thực phẩm',
    paymentLabel: formatPaymentMethodLabel(v.requiredPaymentMethod),
  };
}

/** Tạo danh sách điều kiện áp dụng chi tiết để hiển thị trên trang /vouchers/:code. */
export function buildVoucherConditionSections(v: Voucher): VoucherConditionSection[] {
  const visual = buildVoucherVisual(v);
  const minVal = Number(v.minValue) || 0;
  const maxVal = Number(v.maxValue) || 0;

  const discountDesc = visual.isShipping
    ? `Hỗ trợ giảm ${formatFullCurrency(v.value)} phí giao hàng xe lạnh`
    : v.type === 'percentage'
      ? `Giảm ${v.value}% trên tổng giá trị sản phẩm hợp lệ`
      : `Giảm trực tiếp ${formatFullCurrency(v.value)} vào giá trị đơn hàng`;

  const exampleOrder = Math.max(minVal, 200000);
  let exampleSaved = v.type === 'percentage'
    ? Math.round((exampleOrder * v.value) / 100)
    : Number(v.value) || 0;
  if (maxVal > 0 && exampleSaved > maxVal) {
    exampleSaved = maxVal;
  }

  const daysText = Array.isArray(v.activeDaysOfWeek) && v.activeDaysOfWeek.length > 0
    ? `Chỉ áp dụng vào: ${v.activeDaysOfWeek.map((d) => WEEKDAY_LABELS[d] ?? `Thứ ${d}`).join(', ')}`
    : 'Áp dụng tất cả các ngày trong tuần (Thứ 2 – Chủ Nhật)';

  const windowText = v.activeTimeWindow?.start && v.activeTimeWindow?.end
    ? `Khung giờ vàng từ ${v.activeTimeWindow.start} đến ${v.activeTimeWindow.end} (theo giờ Việt Nam)`
    : 'Áp dụng xuyên suốt 24/24 trong thời gian hiệu lực';

  const remaining = v.usageLimit && v.usageLimit > 0
    ? Math.max(0, v.usageLimit - (v.usedCount || 0))
    : null;

  return [
    {
      id: 'discount',
      icon: 'bi-tag-fill',
      title: 'Mức ưu đãi & Giá trị đơn hàng',
      rows: [
        { label: 'Loại ưu đãi', value: visual.isShipping ? 'Voucher hỗ trợ phí vận chuyển' : 'Voucher giảm giá đơn hàng', highlight: true },
        { label: 'Mức giảm', value: discountDesc, highlight: true },
        {
          label: 'Giá trị đơn tối thiểu',
          value: minVal > 0 ? `${formatFullCurrency(minVal)} (tính trên nhóm sản phẩm hợp lệ)` : 'Không giới hạn giá trị đơn tối thiểu (từ 0đ)',
        },
        ...(maxVal > 0
          ? [{ label: 'Mức giảm tối đa', value: `${formatFullCurrency(maxVal)} / đơn hàng` }]
          : []),
        ...(!visual.isShipping
          ? [{
              label: 'Ví dụ minh họa',
              value: `Đơn hợp lệ ${formatFullCurrency(exampleOrder)} → được giảm ${formatFullCurrency(exampleSaved)}`,
            }]
          : []),
      ],
    },
    {
      id: 'schedule',
      icon: 'bi-calendar2-check-fill',
      title: 'Thời gian & Khung giờ áp dụng',
      rows: [
        { label: 'Ngày bắt đầu', value: formatVoucherDateVi(v.startDate) },
        { label: 'Hạn sử dụng đến hết', value: formatVoucherDateVi(v.endDate), highlight: true },
        { label: 'Ngày trong tuần', value: daysText, highlight: Boolean(v.activeDaysOfWeek?.length) },
        { label: 'Khung giờ áp dụng', value: windowText, highlight: Boolean(v.activeTimeWindow?.start) },
      ],
    },
    {
      id: 'scope',
      icon: 'bi-basket2-fill',
      title: 'Phạm vi sản phẩm & Danh mục',
      rows: [
        { label: 'Danh mục áp dụng', value: visual.categoriesLabel, highlight: Boolean(v.applicableCategories?.length) },
        {
          label: 'Sản phẩm cụ thể',
          value: Array.isArray(v.applicableProductIds) && v.applicableProductIds.length > 0
            ? `Giới hạn trên ${v.applicableProductIds.length} sản phẩm chỉ định trong chương trình`
            : 'Áp dụng cho tất cả sản phẩm thuộc danh mục hợp lệ',
        },
        {
          label: 'Sản phẩm đang Flash Sale',
          value: v.excludeSaleItems
            ? 'Không áp dụng đồng thời cho sản phẩm đang chạy Flash Sale / giảm giá'
            : 'Vẫn tính cho các sản phẩm hợp lệ trên giỏ hàng theo quy định cửa hàng',
        },
      ],
    },
    {
      id: 'rules',
      icon: 'bi-shield-check',
      title: 'Đối tượng, Lượt dùng & Thanh toán',
      rows: [
        {
          label: 'Đối tượng khách hàng',
          value: v.isFirstOrderOnly
            ? 'Chỉ dành riêng cho đơn hàng đầu tiên hợp lệ (chưa từng có đơn không hủy theo tài khoản/SĐT/Email)'
            : v.isPublic === false
              ? 'Ưu đãi riêng tư dành cho khách hàng được chỉ định'
              : 'Mọi khách hàng thành viên & khách mua sắm tại Evergreen Mart',
          highlight: Boolean(v.isFirstOrderOnly),
        },
        {
          label: 'Phương thức thanh toán',
          value: visual.paymentLabel,
          highlight: Boolean(v.requiredPaymentMethod),
        },
        {
          label: 'Số lần dùng / tài khoản',
          value: v.maxUsagePerUser && v.maxUsagePerUser > 0
            ? `Tối đa ${v.maxUsagePerUser} lần cho mỗi khách hàng`
            : 'Không giới hạn số lần cho mỗi khách trong suốt thời gian khuyến mãi',
        },
        {
          label: 'Tổng lượt toàn hệ thống',
          value: v.usageLimit && v.usageLimit > 0
            ? `Còn lại ${remaining?.toLocaleString('vi-VN')} / ${v.usageLimit.toLocaleString('vi-VN')} lượt (đã dùng ${(v.usedCount || 0).toLocaleString('vi-VN')} lượt)`
            : 'Không giới hạn tổng lượt sử dụng',
        },
        ...(v.pointsRequired && v.pointsRequired > 0
          ? [{ label: 'Điểm đổi ưu đãi', value: `Cần ${v.pointsRequired.toLocaleString('vi-VN')} điểm tích lũy để lưu vào ví`, highlight: true }]
          : []),
        {
          label: 'Quy tắc cộng dồn',
          value: 'Mỗi đơn hàng được áp dụng tối đa 01 mã giảm giá đơn hàng + 01 mã hỗ trợ phí vận chuyển. Không quy đổi thành tiền mặt.',
        },
      ],
    },
  ];
}

