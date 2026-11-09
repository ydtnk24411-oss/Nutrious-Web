/**
 * EvergreenMart - Add-on Deals Relevance & Price Validation Helper
 * Quy tắc:
 * 1. Bắt buộc về giá: Giá sản phẩm mua kèm phải THẤP HƠN giá bán thực tế của sản phẩm chính.
 *    (addonPrice < mainPrice; nếu addonPrice >= mainPrice thì TUYỆT ĐỐI KHÔNG HIỂN THỊ).
 * 2. Bắt buộc về tính liên quan: Sản phẩm mua kèm phải có sự liên quan hợp lý theo nhu cầu
 *    sử dụng ẩm thực / thói quen tiêu dùng.
 * 3. Không hiển thị sản phẩm trùng với sản phẩm chính, sản phẩm ngừng kinh doanh, hết hàng hoặc combo.
 */

function getProductRole(p) {
  if (!p) return 'OTHER';
  const name = (p.name || '').toLowerCase();
  const cat = `${p.categoryVi || ''} ${p.category || ''}`.toLowerCase();

  // 1. Rau gia vị tươi & củ nêm: hành, ngò, tỏi, ớt, sả, gừng, chanh, tiêu...
  if (
    /rau gia vị/.test(cat) ||
    /hành lá|ngò rí|rau ngò|rau mùi|sả tươi|sả cây|ớt hiểm|ớt sừng|ớt tươi|tỏi lý sơn|tỏi cô đơn|tỏi tươi|tỏi củ|gừng tươi|gừng già|chanh tươi|tiêu đen|tiêu sọ|lá chanh|rau răm|húng quế|húng cây|rau thơm|thì là|rau ngổ/.test(name)
  ) {
    return 'HERB_CONDIMENT';
  }

  // 2. Muối chấm hoa quả / chấm đồ ăn
  if (/muối ớt|muối tôm|muối tiêu|muối chấm|muối bọt tiêu/.test(name)) {
    return 'DIP_SALT';
  }

  // 3. Thịt, cá, hải sản, đồ tươi mặn
  if (
    /thịt|cá & hải sản|hải sản|thịt gia cầm|thịt bò|thịt heo/.test(cat) ||
    /thịt|thăn bò|bắp bò|ba chỉ bò|sườn|ba rọi|gà ta|vịt|cá hồi|cá ba sa|cá thu|tôm sú|tôm thẻ|mực|hải sản|lạp xưởng|xúc xích|chả lụa/.test(name)
  ) {
    return 'MEAT_SEAFOOD';
  }

  // 4. Rau củ quả nấu canh, xào, luộc
  if (
    /rau củ|rau ăn lá|nấm/.test(cat) ||
    /cải|rau |xà lách|bí đỏ|bí xanh|bầu|mướp|khoai tây|khoai lang|cà rốt|củ dền|su su|bắp cải|súp lơ|bông cải|nấm|đậu hũ|cà chua|dưa leo/.test(name)
  ) {
    return 'VEGETABLE';
  }

  // 5. Gia vị nấu nướng & thực phẩm khô
  if (
    /gia vị & thực phẩm khô|gia vị/.test(cat) ||
    /nước mắm|muối|hạt nêm|tiêu|đường|bột ngọt|dầu ăn|dầu hào|nước tương|xì dầu|sốt|sa tế|tương cà|tương ớt|bột ngũ vị|bột chiên|bánh đa nem/.test(name)
  ) {
    return 'SPICE_DRY';
  }

  // 6. Trái cây tươi
  if (
    /trái cây/.test(cat) ||
    /táo|cam|chuối|nho|dâu|xoài|ổi|bơ sáp|dưa hấu|bưởi|mận|chôm chôm|thanh long|kiwi|lê|dừa|quýt|sầu riêng|đu đủ|khóm|dứa/.test(name)
  ) {
    return 'FRUIT';
  }

  // 7. Thức uống, nước giải khát
  if (
    /thức uống/.test(cat) ||
    /nước ngọt|nước giải khát|coca|pepsi|sprite|soda|trà |nước ép|khoáng|lavie|aquafina|sting|redbull|c-vitt|fanta/.test(name)
  ) {
    return 'BEVERAGE';
  }

  // 8. Bánh kẹo & đồ ăn vặt
  if (
    /bánh & đồ ăn vặt|ăn vặt/.test(cat) ||
    /bánh|snack|khoai tây sấy|xoài sấy|hạt điều|hạt dẻ|đậu phộng|rong biển|kẹo|bánh quy|kitkat|haribo|oreo|pocky|oishi|nabati/.test(name)
  ) {
    return 'SNACK';
  }

  // 9. Sữa & chế phẩm sữa mát
  if (
    /sữa/.test(cat) ||
    /sữa tươi|sữa chua|phô mai|váng sữa|bơ sữa|pudding|sương sáo|bánh flan/.test(name)
  ) {
    return 'DAIRY';
  }

  return 'OTHER';
}

/**
 * Kiểm tra tính liên quan hợp lý giữa sản phẩm chính và sản phẩm mua kèm
 */
function isAddonRelevant(mainP, addonP) {
  if (!mainP || !addonP) return false;
  const mainId = String(mainP._id || mainP.id || '');
  const addonId = String(addonP._id || addonP.id || '');
  if (mainId && addonId && mainId === addonId) return false;

  const mainRole = getProductRole(mainP);
  const addonRole = getProductRole(addonP);

  // Không cho phép sản phẩm mua kèm cùng chủng loại chính
  // (ví dụ: Thịt không mua kèm Thịt, Củ to không mua kèm Củ to)
  if (mainRole === addonRole && !['HERB_CONDIMENT'].includes(addonRole)) {
    return false;
  }

  switch (mainRole) {
    case 'MEAT_SEAFOOD':
      // Thịt / Cá / Hải sản / Lạp xưởng -> Gia vị ướp nấu, rau gia vị / ăn kèm, nước giải khát
      return ['HERB_CONDIMENT', 'SPICE_DRY', 'BEVERAGE'].includes(addonRole);

    case 'VEGETABLE':
      // Rau củ quả nấu nướng -> Rau gia vị (hành, ngò, sả, ớt...), gia vị nấu canh / tương nêm
      // Có thể đi kèm đậu hũ tươi
      return ['HERB_CONDIMENT', 'SPICE_DRY'].includes(addonRole);

    case 'FRUIT':
      // Trái cây -> Muối chấm trái cây (muối ớt, muối tôm), sữa chua, đồ uống mát
      return ['DIP_SALT', 'DAIRY', 'BEVERAGE'].includes(addonRole);

    case 'BEVERAGE':
      // Thức uống -> Đồ ăn vặt / bánh nhâm nhi
      return ['SNACK'].includes(addonRole);

    case 'SNACK':
      // Bánh kẹo & đồ ăn vặt -> Thức uống giải khát
      return ['BEVERAGE'].includes(addonRole);

    case 'DAIRY':
      // Sữa / Sữa chua -> Bánh ăn kèm, đồ ăn vặt, trái cây
      return ['SNACK', 'FRUIT', 'BEVERAGE'].includes(addonRole);

    case 'SPICE_DRY':
      // Gia vị & đồ khô -> Rau gia vị tươi, muối chấm
      return ['HERB_CONDIMENT', 'DIP_SALT'].includes(addonRole);

    default:
      return false;
  }
}

/**
 * Điều kiện bắt buộc về giá:
 * Chỉ hợp lệ nếu giá sản phẩm mua kèm THẤP HƠN giá sản phẩm chính.
 * (So sánh theo priceNumber thực tế).
 */
function isAddonPriceValid(mainP, addonP) {
  if (!mainP || !addonP) return false;
  const mainPrice = Number(mainP.priceNumber) || 0;
  const addonPrice = Number(addonP.priceNumber) || 0;
  return addonPrice > 0 && mainPrice > 0 && addonPrice < mainPrice;
}

/**
 * Kiểm tra toàn diện một deal mua kèm có hợp lệ không
 */
function isValidAddOnDeal(mainP, addonP) {
  if (!mainP || !addonP) return false;
  if (addonP.isActive === false || addonP.isCombo) return false;
  if (typeof addonP.stock === 'number' && addonP.stock <= 0) return false;
  if (!isAddonPriceValid(mainP, addonP)) return false;
  if (!isAddonRelevant(mainP, addonP)) return false;
  return true;
}

/**
 * Lọc danh sách addOnDeals của một sản phẩm, loại bỏ triệt để các deal
 * không thỏa mãn điều kiện giá thấp hơn hoặc không liên quan.
 */
function filterProductAddOnDeals(product) {
  if (!product) return product;
  const rawObj = typeof product.toObject === 'function' ? product.toObject() : product;
  if (!Array.isArray(rawObj.addOnDeals) || rawObj.addOnDeals.length === 0) {
    return { ...rawObj, addOnDeals: [] };
  }

  const validDeals = [];
  for (const deal of rawObj.addOnDeals) {
    if (!deal || deal.isActive === false || Number(deal.discountValue) <= 0) continue;
    const ap = deal.product;
    if (!ap || typeof ap !== 'object') continue;
    if (isValidAddOnDeal(rawObj, ap)) {
      validDeals.push(deal);
    }
  }

  return {
    ...rawObj,
    addOnDeals: validDeals,
  };
}

module.exports = {
  getProductRole,
  isAddonRelevant,
  isAddonPriceValid,
  isValidAddOnDeal,
  filterProductAddOnDeals,
};

