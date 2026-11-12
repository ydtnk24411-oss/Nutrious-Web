
import { Component, signal, inject, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice } from '../../shared/services/cart.service';
import {
  ProductApiService,
  ApiProduct
} from '../../shared/services/product-api.service';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';
import {
  CategoryApiService,
  ApiCategory
} from '../../shared/services/category-api.service';
import { removeVietnameseTones, scoreProduct } from '../../shared/utils/search.util';

function toCartProduct(p: ApiProduct): XanhLaProduct {
  return {
    id: p._id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    priceNumber: p.priceNumber,
    image: p.image,
    category: p.categoryId,
    categoryVi: p.categoryVi || '',
    description: p.description,

    container: p.container,
    cutType: p.cutType,
    cutting: p.cutting,
    packSize: p.packSize,
    packaging: p.packaging,
    preparation: p.preparation,
    quantity: p.quantity,
    ripeness: p.ripeness,
    sizeGroup: p.sizeGroup,
    thickness: p.thickness,
    type: p.type,
    weight: p.weight,
    options: p.options,
    stock: typeof p.availableStock === 'number' ? p.availableStock : p.stock,
    availableStock: p.availableStock,
    comboStatus: p.comboStatus,
    isCombo: Boolean(p.isCombo || (Array.isArray(p.comboItems) && p.comboItems.length > 0)),
    originalPriceNumber: p.originalPriceNumber,
    comboItems: p.comboItems,
    addOnDeals: p.addOnDeals as any,
  };
}

export function toMainCategory(p: ApiProduct): string {
  return p.categoryId;
}

export function normalizeCategoryTarget(cat: string): string {
  return cat.trim();
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export const FACET_LABEL_MAP: Record<string, Record<string, string>> = {
  preparation: {
    'Brewing Required': 'Cần pha / Hãm trà',
    'Cleaned Raw': 'Sơ chế sạch',
    'Cooked': 'Đã chế biến chín',
    'Cooked Frozen': 'Chín đông lạnh',
    'Instant Mix': 'Hòa tan / Dùng liền',
    'Raw': 'Tươi sống (chưa chế biến)',
    'Ready to Coat': 'Bột tẩm chiên',
    'Ready to Cook': 'Sơ chế nấu ngay',
    'Ready to Drink': 'Uống liền',
    'Ready to Eat': 'Ăn liền / Dùng ngay',
    'Ready to Use': 'Dùng trực tiếp',
    'Requires Bake': 'Cần nướng',
    'Requires Boiling': 'Cần luộc / nấu sôi',
    'Requires Mix': 'Cần pha trộn',
    'Requires Soaking': 'Cần ngâm nước',
  },
  ripeness: {
    'Dried': 'Đồ khô / Sấy khô',
    'Fresh': 'Tươi mới',
    'Fresh Frozen': 'Cấp đông tươi',
    'Frozen': 'Đông lạnh',
    'Ready to Cook': 'Sơ chế nấu ngay',
    'Ready to Eat': 'Ăn liền / Dùng ngay',
    'Ripe': 'Chín mọng / Chín tới',
    'Shelf Stable': 'Bảo quản nhiệt độ phòng',
  },
  sizeGroup: {
    'Extra Large': 'Cực lớn (XL)',
    'Large': 'Lớn (L)',
    'Medium': 'Vừa (M)',
    'Small': 'Nhỏ (S)',
  },
  type: {
    'Bakery': 'Bánh quy & bánh ngọt',
    'Beverage': 'Nước giải khát',
    'Cereal Drink': 'Thức uống ngũ cốc',
    'Chilled': 'Bảo quản mát (Sữa & bơ)',
    'Coffee': 'Cà phê',
    'Confectionery': 'Bánh kẹo & socola',
    'Dried Fruit': 'Trái cây sấy',
    'Dry': 'Hàng khô & gia vị',
    'Energy': 'Nước tăng lực',
    'Fresh': 'Hàng tươi sống',
    'Fresh Bakery': 'Bánh tươi & bánh mì',
    'Frozen': 'Đông lạnh',
    'Herbal': 'Trà thảo mộc & thanh nhiệt',
    'Juice': 'Nước ép trái cây',
    'Live': 'Hải sản tươi sống (đang bơi)',
    'Natural': 'Tự nhiên',
    'Nutritional': 'Bổ dưỡng & dinh dưỡng',
    'Nuts': 'Hạt dinh dưỡng',
    'Savory Snack': 'Khô & đồ nhắm mặn',
    'Semi-Dried': 'Hàng một nắng',
    'Snack': 'Snack & bánh gạo',
    'Sports': 'Nước bù khoáng & thể thao',
    'Tea': 'Trà túi lọc & đóng chai',
    'Vitamin': 'Nước bổ sung Vitamin',
    'Water': 'Nước tinh khiết & khoáng',
  },
};

const SIZE_ORDER: Record<string, number> = {
  'Small': 1,
  'Medium': 2,
  'Large': 3,
  'Extra Large': 4,
};

function parseWeightInGrams(w: string): number {
  const num = parseFloat(w.replace(',', '.'));
  if (isNaN(num)) return 999999;
  if (/kg/i.test(w)) return num * 1000;
  if (/l$/i.test(w)) return num * 1000;
  if (/ml/i.test(w)) return num;
  return num;
}

export function getFacetLabel(field: string, val: string): string {
  return FACET_LABEL_MAP[field]?.[val] || val;
}

export const DIET_FACET_OPTIONS: { value: string; label: string }[] = [
  { value: 'eat-clean', label: 'Eat Clean (Tươi sạch, ít chế biến)' },
  { value: 'keto', label: 'Keto (Ít tinh bột, giàu béo tốt)' },
  { value: 'low-carb', label: 'Low-Carb (Giảm tinh bột & đường)' },
  { value: 'vegetarian', label: 'Ăn chay (Thuần thực vật)' },
  { value: 'gym', label: 'Tập Gym (Tăng cơ / Giảm mỡ)' },
  { value: 'diabetic', label: 'Người tiểu đường (Ít đường, GI thấp)' },
  { value: 'hypertension', label: 'Người cao huyết áp (Ít muối, giàu Kali)' },
];

function parseMetric(val: unknown, unitRegex: RegExp): number {
  if (!val) return 0;
  const str = String(val).replace(',', '.');
  const m = str.match(unitRegex);
  return m ? parseFloat(m[1]) : 0;
}

export function getProductDiets(p: ApiProduct): string[] {
  if (p.isCombo) return [];
  const specs = p.specifications || {};

  // 1. Tự động đọc thông số dinh dưỡng từ specifications
  const kcal = parseMetric(specs['Năng lượng'], /(\d+(?:\.\d+)?)\s*kcal/i);
  const protein = parseMetric(
    specs['Chất đạm (Protein)'] || specs['Protein'],
    /(\d+(?:\.\d+)?)\s*g\b/i
  );
  const fat = parseMetric(
    specs['Chất béo (Lipid)'] || specs['Lipid'],
    /(\d+(?:\.\d+)?)\s*g\b/i
  );
  const carb = parseMetric(
    specs['Carbohydrate'] || specs['Tinh bột'],
    /(\d+(?:\.\d+)?)\s*g\b/i
  );
  const fiber = parseMetric(specs['Chất xơ'], /(\d+(?:\.\d+)?)\s*g\b/i);
  const netCarb = Math.max(0, carb - fiber);

  const hasNutrition = !!(
    specs['Năng lượng'] ||
    specs['Chất đạm (Protein)'] ||
    specs['Protein'] ||
    specs['Chất béo (Lipid)'] ||
    specs['Carbohydrate']
  );
  if (!hasNutrition) return [];

  // 2. Tự động đọc tên, đặc điểm, mô tả, hướng dẫn sử dụng, thành phần và danh mục
  const nameNorm = removeVietnameseTones(p.name || '');
  const slug = (p.slug || '').toLowerCase();
  const descNorm = removeVietnameseTones(
    [p.description, p.usageInstructions, p.storageInstructions].filter(Boolean).join(' ')
  );
  const specsNorm = removeVietnameseTones(
    Object.entries(specs)
      .map(([k, v]) => `${k} ${v}`)
      .join(' ')
  );
  const vitaminsNorm = removeVietnameseTones(specs['Vitamin & Khoáng chất'] || '');
  const fullText = `${nameNorm} ${slug} ${descNorm} ${specsNorm}`;

  const catNorm = removeVietnameseTones([p.category, p.categoryVi].filter(Boolean).join(' '));
  const type = p.type || '';

  const isVegetable =
    catNorm.includes('vegetables') ||
    catNorm.includes('rau cu');
  const isFruit =
    (catNorm.includes('fruits') || catNorm.includes('trai cay')) &&
    type !== 'Dried Fruit' &&
    !/\bsay\b/.test(nameNorm);
  const isDriedFruit =
    type === 'Dried Fruit' ||
    /\b(xoai say|mit say|trai cay say|tao do kho|ky tu)\b/.test(nameNorm);
  const isMeat =
    catNorm.includes('meat') ||
    (catNorm.includes('thit') && !catNorm.includes('hai san')) ||
    /\b(thit bo|ba chi bo|bap bo|than ngoai bo|loi vai bo|de suon bo|luoi bo|bo vien|bo wagyu|thit heo|nac dam heo|nac vai heo|nac than heo|suon canh buom|chan gio heo|cot let heo|tim heo|thit xay heo|thit ba roi|ga ta|dui ga|uc ga|canh ga|me ga|ma dui ga|uc vit|dui cuu|suon cuu|thit vai cuu)\b/.test(nameNorm);
  const isSeafood =
    catNorm.includes('seafood') ||
    (!isMeat &&
      (catNorm.includes('hai san') ||
        /\b(ca hoi|ca ngu|ca chim|ca dieu hong|ca bop|ca nuc|ca tuyet|ca chem|ca thu|ca loc|ca mu|cha ca|trung ca|tom hum|tom su|tom kho|muc ong|muc la|bach tuoc|so diep|so huyet|ngheu|hau sua|bao ngu|cua ca mau|thit cang cua|thanh cua|oc mong tay|oc huong|sua bien)\b/.test(nameNorm)));

  // Nhận diện thành phần có nguồn gốc động vật (thịt, cá, hải sản, trứng, sữa bò, phô mai, bơ động vật, gelatin, yến sào, dầu hào, nước mắm)
  const isPlantMilkOrSoy =
    /\b(sua hat|sua hanh nhan|sua oc cho|sua dau nanh|sua yen mach|dau hu|tau hu)\b/.test(nameNorm);
  const isAnimalProduct =
    isMeat ||
    isSeafood ||
    (!isPlantMilkOrSoy &&
      /\b(trung ga|trung cut|trung vit|sua tuoi|sua bo|sua chua|sua cacao|milo|probi|vang sua|banh flan|whipping cream|kem sua|bo lat man|bo dong vat|pho mai|pudding|tra sua|ca phe sua|nuoc mam|dau hao|cha bong|kho bo|kho ga|haribo|gelatin|nuoc yen)\b/.test(nameNorm)) ||
    /\b(gelatin|collagen thuy phan|chiet xuat hao|dam ca com|cha bong heo)\b/.test(specsNorm);

  // Nhận diện đồ ngọt, bánh kẹo, snack chiên rán, nước ngọt có ga, nước tăng lực
  const isSweetOrJunk =
    type === 'Confectionery' ||
    type === 'Snack' ||
    type === 'Energy' ||
    type === 'Beverage' ||
    /\b(snack|khoai tay chien|pringles|lays|oishi|banh quy nhan|banh quy bo|banh quy oreo|banh xop|banh bong lan|banh mi ngot|banh mi hoa cuc|banh tai yen|banh crepe|banh que|banh pho mai|pocky|kitkat|oreo|choco pie|danisa|solite|loacker|nabati|keo|socola|haribo|ricola|com chay|banh flan|pudding|vang sua|sua chua nep cam|tra sua|ca phe sua|milo|probi co duong|sua tuoi tiet trung vinamilk co duong|sua chua an vinamilk co duong|nuoc ngot|coca|pepsi|fanta|sprite|soda|nuoc tang luc|red bull|monster|compact|tra xanh khong do|tra o long c2|tra dao|tra bi dao|duong cat trang)\b/.test(nameNorm);

  // Nhận diện gia vị mặn, bột nấu ăn, đồ khô tẩm ướp nhiều muối
  const isCondimentOrCookingPowderOrSalted =
    /\b(nuoc mam|nuoc tuong|dau hao|tuong ot|muoi bot|bot ngot|hat nem|bot ngu vi|ot bot|bot nghe|bot ca re|tieu den|hoa hoi|que thanh|bot chien|bot nang|bot nuong|duong cat trang|banh da nem|pho kho|bun tuoi kho|kho bo|kho ga|com chay|tom kho|ca thu mot nang|bo lat man|cai be xanh muoi dua|sua bien uop gia vi|dau hat dieu rang muoi)\b/.test(nameNorm);

  const diets: string[] = [];

  // ── 1. EAT CLEAN (Tươi sạch, nguyên bản, ít chế biến, giàu dinh dưỡng) ──
  const isEatCleanCandidate =
    !isSweetOrJunk &&
    !isCondimentOrCookingPowderOrSalted &&
    !isDriedFruit &&
    (
      (isVegetable && !/\b(sa tuoi)\b/.test(nameNorm)) ||
      (isFruit &&
        carb <= 16.5 &&
        !/\b(sau rieng|chom chom|nho xanh|nho den|hong gion|mang cut|mang cau|dua le trang sieu ngot)\b/.test(nameNorm)) ||
      (isMeat &&
        (protein >= 17 || /\buc ga\b/.test(nameNorm)) &&
        fat <= 12.0 &&
        !/\b(ba chi|ba roi|suon|chan gio|wagyu|bo vien|luoi bo|canh ga|dui ga goc tu|nac dam)\b/.test(nameNorm)) ||
      (isSeafood &&
        fat <= 14.5 &&
        !/\b(thanh cua|sua bien uop gia vi|ca thu mot nang|ca nuc chuoi hap san|trung ca hoi|cha ca)\b/.test(nameNorm)) ||
      /\b(trung ga|trung cut|dau hu|sua hanh nhan khong duong|sua hat oc cho|sua yen mach|sua dau nanh|sua tuoi thanh trung|sua bo tuoi thanh trung|sua chua hy lap|sua chua men song da lat|suong sao den hat chia|nuoc dua tuoi|nuoc tinh khiet|nuoc khoang|tra lipton|banh quy yen mach|moc nhi|nam huong|mang dang)\b/.test(nameNorm)
    );
  if (isEatCleanCandidate) {
    diets.push('eat-clean');
  }

  // ── 2. KETO (Ít tinh bột Net Carb <= 6g/100g, giàu béo tốt & đạm) ──
  const isKetoCandidate =
    !isSweetOrJunk &&
    !isCondimentOrCookingPowderOrSalted &&
    !isDriedFruit &&
    netCarb <= 6.0 &&
    (
      (isMeat && !/\b(bo vien)\b/.test(nameNorm)) ||
      (isSeafood && !/\b(thanh cua|sua bien uop gia vi)\b/.test(nameNorm)) ||
      /\b(trung ga|trung cut|pho mai|bo dong vat|whipping cream|dau an simply|dau hu|sua hanh nhan khong duong|sua chua hy lap)\b/.test(nameNorm) ||
      /\b(bo sap|bo wax 034)\b/.test(nameNorm) ||
      (isVegetable && netCarb <= 4.5 && !/\b(ca rot|bi do|sa tuoi|cai be xanh muoi dua)\b/.test(nameNorm)) ||
      /\b(nuoc tinh khiet|nuoc khoang|tra lipton)\b/.test(nameNorm)
    );
  if (isKetoCandidate) {
    diets.push('keto');
  }

  // ── 3. LOW-CARB (Giảm tinh bột & đường: Carb <= 12g/100g hoặc Net Carb <= 9g/100g) ──
  const isLowCarbCandidate =
    !isSweetOrJunk &&
    !isCondimentOrCookingPowderOrSalted &&
    !isDriedFruit &&
    (carb <= 12.0 || netCarb <= 9.0) &&
    (
      (isMeat && !/\b(bo vien)\b/.test(nameNorm)) ||
      (isSeafood && !/\b(thanh cua)\b/.test(nameNorm)) ||
      (isVegetable && !/\b(sa tuoi)\b/.test(nameNorm)) ||
      (isFruit && carb <= 12.0 && !/\b(dua le trang sieu ngot)\b/.test(nameNorm)) ||
      /\b(trung ga|trung cut|trung vit lon|pho mai|bo dong vat|whipping cream|dau hu|sua hanh nhan|sua hat oc cho|sua tuoi thanh trung|sua bo tuoi thanh trung|sua dau nanh|sua yen mach|sua chua hy lap|sua chua men song da lat|suong sao den hat chia|rau cau dua|nuoc dua tuoi|nuoc tinh khiet|nuoc khoang|tra lipton|ca phe den)\b/.test(nameNorm)
    );
  if (isLowCarbCandidate) {
    diets.push('low-carb');
  }

  // ── 4. ĂN CHAY (Thuần thực vật: Không thịt, cá, hải sản, trứng, sữa bò, mỡ/bơ động vật, gelatin, nước mắm, dầu hào) ──
  const isRawCookingSpiceOrFlour =
    /\b(muoi bot|bot ngot|bot ngu vi|ot bot|bot nghe|bot ca re|tieu den|hoa hoi|que thanh|bot chien|bot nang|bot nuong|duong cat trang)\b/.test(nameNorm);
  const isVegetarianCandidate =
    !isAnimalProduct &&
    !isSweetOrJunk &&
    !isRawCookingSpiceOrFlour &&
    (
      isVegetable ||
      isFruit ||
      isDriedFruit ||
      /\b(dau hu|sua hanh nhan|sua hat oc cho|sua dau nanh|sua yen mach|suong sao den hat chia|rau cau dua|dau hat dieu|dau phong|rong bien say gion|banh quy yen mach|banh sandwich|moc nhi|nam huong|mang dang|tao do|ky tu|mien rieng|bun tuoi kho|pho kho|banh da nem|dau an simply|nuoc tuong|hat nem knorr nam huong|nuoc dua tuoi|nuoc gao|nuoc ep|nuoc trai cay|tra lipton|ca phe den|nuoc tinh khiet|nuoc khoang)\b/.test(nameNorm)
    );
  if (isVegetarianCandidate) {
    diets.push('vegetarian');
  }

  // ── 5. TẬP GYM (Tăng cơ / Giảm mỡ: Giàu Protein nạc, trứng, sữa, yến mạch, chuối, bông cải, bù khoáng) ──
  const isGymCandidate =
    !isSweetOrJunk &&
    !isCondimentOrCookingPowderOrSalted &&
    (
      (isMeat &&
        (protein >= 17 || /\buc ga\b/.test(nameNorm)) &&
        fat <= 14.0 &&
        !/\b(ba chi|ba roi|chan gio|suon canh buom|suon cuu|de suon|wagyu|bo vien|luoi bo|canh ga|dui ga goc tu|nac dam|thit vai cuu)\b/.test(nameNorm)) ||
      (isSeafood &&
        protein >= 14.5 &&
        fat <= 14.5 &&
        !/\b(thanh cua|sua bien|ca nuc chuoi hap san)\b/.test(nameNorm)) ||
      /\b(trung ga|trung cut|dau hu|sua chua hy lap|sua tuoi thanh trung|sua bo tuoi thanh trung|sua hanh nhan|sua hat oc cho|sua dau nanh|sua yen mach|pho mai bao mozzarella|pho mai lat cheddar)\b/.test(nameNorm) ||
      /\b(bong cai|sup lo|rau bo xoi|cai bo xoi|cai kale|bo sap|bo wax 034|chuoi laba|viet quat|tao envy|banh quy yen mach|banh sandwich|pocari sweat|revive|nuoc dua tuoi)\b/.test(nameNorm) ||
      fullText.includes('gymer')
    );
  if (isGymCandidate) {
    diets.push('gym');
  }

  // ── 6. NGƯỜI TIỂU ĐƯỜNG (Ít đường, GI thấp, giàu chất xơ hoặc đạm nạc) ──
  const isDiabeticCandidate =
    !isSweetOrJunk &&
    !isCondimentOrCookingPowderOrSalted &&
    !isDriedFruit &&
    (
      (isVegetable && carb <= 9.0 && !/\b(cai be xanh muoi dua|sa tuoi|bi do)\b/.test(nameNorm)) ||
      (isFruit &&
        netCarb <= 11.5 &&
        !/\b(sau rieng|chom chom|vai thieu|nhan|xoai|chuoi|nho|mit|mang cau|dua hau|dua le trang sieu ngot|hong gion|mang cut|chanh day)\b/.test(nameNorm)) ||
      (isSeafood &&
        carb <= 4.0 &&
        !/\b(thanh cua|sua bien uop gia vi|ca thu mot nang|trung ca hoi|ca nuc chuoi hap san|cha ca)\b/.test(nameNorm)) ||
      (isMeat &&
        (protein >= 18 || /\buc ga\b/.test(nameNorm)) &&
        fat <= 12.0 &&
        carb <= 1.0 &&
        !/\b(bo vien)\b/.test(nameNorm)) ||
      /\b(dau hu|trung ga|sua hanh nhan khong duong|sua hat oc cho|sua tuoi thanh trung th true milk khong duong|sua bo tuoi thanh trung|sua dau nanh|sua yen mach|sua chua hy lap|suong sao den hat chia|mien rieng|moc nhi|nam huong|mang dang|tra lipton|nuoc tinh khiet|nuoc khoang)\b/.test(nameNorm) ||
      fullText.includes('chi so duong huyet gi thap')
    );
  if (isDiabeticCandidate) {
    diets.push('diabetic');
  }

  // ── 7. NGƯỜI CAO HUYẾT ÁP (Ít muối/Natri, giàu Kali, Magie, Canxi, Omega-3, hạn chế mỡ bão hòa) ──
  const hasHeartMinerals =
    vitaminsNorm.includes('kali') ||
    vitaminsNorm.includes('magie') ||
    vitaminsNorm.includes('canxi') ||
    vitaminsNorm.includes('omega-3') ||
    specsNorm.includes('omega-3') ||
    descNorm.includes('omega-3') ||
    descNorm.includes('tim mach');

  const isHypertensionCandidate =
    !isSweetOrJunk &&
    !isCondimentOrCookingPowderOrSalted &&
    !isDriedFruit &&
    (
      (isVegetable && hasHeartMinerals && !/\b(cai be xanh muoi dua|sa tuoi)\b/.test(nameNorm)) ||
      (isFruit &&
        hasHeartMinerals &&
        !/\b(sau rieng|chom chom|vai thieu|dua le trang sieu ngot)\b/.test(nameNorm)) ||
      (isSeafood &&
        hasHeartMinerals &&
        !/\b(thanh cua|sua bien uop gia vi|ca thu mot nang|tom kho|trung ca hoi|ca nuc chuoi hap san|cha ca)\b/.test(nameNorm)) ||
      /\b(uc ga phi le|dau hu|sua hanh nhan khong duong|sua hat oc cho|sua dau nanh|sua yen mach|sua tuoi thanh trung|sua bo tuoi thanh trung|sua chua hy lap|suong sao den hat chia|dau an simply|moc nhi|nam huong|mang dang|nuoc dua tuoi|tra lipton)\b/.test(nameNorm)
    );
  if (isHypertensionCandidate) {
    diets.push('hypertension');
  }

  return diets;
}

export type NutritionMetricKey = 'protein' | 'fiber' | 'carb' | 'fat' | 'kcal';

export interface NutritionSliderConfig {
  key: NutritionMetricKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  tolerance: number;
  defaultValue: number;
}

export interface NutritionSliderState extends NutritionSliderConfig {
  enabled: boolean;
  value: number;
}

export const NUTRITION_SLIDER_CONFIGS: NutritionSliderConfig[] = [
  {
    key: 'protein',
    label: 'Chất đạm (Protein)',
    unit: 'g',
    min: 0,
    max: 80,
    step: 1,
    tolerance: 5,
    defaultValue: 20,
  },
  {
    key: 'fiber',
    label: 'Chất xơ',
    unit: 'g',
    min: 0,
    max: 55,
    step: 1,
    tolerance: 5,
    defaultValue: 5,
  },
  {
    key: 'carb',
    label: 'Carbohydrate (Tinh bột)',
    unit: 'g',
    min: 0,
    max: 100,
    step: 1,
    tolerance: 5,
    defaultValue: 10,
  },
  {
    key: 'fat',
    label: 'Chất béo (Lipid)',
    unit: 'g',
    min: 0,
    max: 100,
    step: 1,
    tolerance: 5,
    defaultValue: 5,
  },
  {
    key: 'kcal',
    label: 'Năng lượng (Calo)',
    unit: 'kcal',
    min: 0,
    max: 900,
    step: 5,
    tolerance: 5,
    defaultValue: 100,
  },
];

export function getProductNutritionValue(
  p: ApiProduct,
  key: NutritionMetricKey
): number | null {
  if (p.isCombo) return null;
  const specs = p.specifications || {};
  const hasNutrition = !!(
    specs['Năng lượng'] ||
    specs['Chất đạm (Protein)'] ||
    specs['Protein'] ||
    specs['Chất béo (Lipid)'] ||
    specs['Carbohydrate']
  );
  if (!hasNutrition) return null;

  if (key === 'protein') {
    const raw = specs['Chất đạm (Protein)'] || specs['Protein'];
    return raw ? parseMetric(raw, /(\d+(?:\.\d+)?)\s*g\b/i) : 0;
  }
  if (key === 'fiber') {
    const raw = specs['Chất xơ'];
    return raw ? parseMetric(raw, /(\d+(?:\.\d+)?)\s*g\b/i) : 0;
  }
  if (key === 'carb') {
    const raw = specs['Carbohydrate'] || specs['Tinh bột'];
    return raw ? parseMetric(raw, /(\d+(?:\.\d+)?)\s*g\b/i) : 0;
  }
  if (key === 'fat') {
    const raw = specs['Chất béo (Lipid)'] || specs['Lipid'];
    return raw ? parseMetric(raw, /(\d+(?:\.\d+)?)\s*g\b/i) : 0;
  }
  if (key === 'kcal') {
    const raw = specs['Năng lượng'];
    return raw ? parseMetric(raw, /(\d+(?:\.\d+)?)\s*kcal/i) : 0;
  }
  return null;
}

export function matchProductByNutritionSliders(
  p: ApiProduct,
  activeSliders: NutritionSliderState[]
): { matches: boolean; totalDiff: number } {
  if (!activeSliders.length) {
    return { matches: true, totalDiff: 0 };
  }
  if (p.isCombo) {
    return { matches: false, totalDiff: 999999 };
  }

  let totalDiff = 0;
  for (const s of activeSliders) {
    const val = getProductNutritionValue(p, s.key);
    if (val === null) {
      return { matches: false, totalDiff: 999999 };
    }
    // Nếu người dùng chọn mức > 0 thì sản phẩm phải thực sự có chỉ số đó (> 0)
    if (s.value > 0 && val <= 0) {
      return { matches: false, totalDiff: 999999 };
    }
    const diff = Math.abs(val - s.value);
    if (diff > s.tolerance) {
      return { matches: false, totalDiff: 999999 };
    }
    totalDiff += diff;
  }

  return { matches: true, totalDiff };
}

@Component({
  selector: 'app-ordering',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './ordering.component.html',
  styleUrl: './ordering.component.css',
})
export class OrderingComponent implements OnInit {
  protected cart = inject(CartService);

  private productApi = inject(ProductApiService);
  private categoryApi = inject(CategoryApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  constructor() {
    effect(() => {
      // Tự động đặt lại hiển thị 20 sản phẩm đầu khi đổi danh mục, tìm kiếm, bộ lọc hoặc sắp xếp
      this.activeCategory();
      this.search();
      this.sortBy();
      this.maxPrice();
      this.selectedFilters();
      this.nutritionSliders();
      this.visibleCount.set(this.pageSize);
    });
  }

  // Dữ liệu MongoDB
  protected allCategories = signal<ApiCategory[]>([]);
  protected allProducts = signal<ApiProduct[]>([]);

  // Danh sách danh mục lấy trực tiếp từ MongoDB
  protected categoryOptions = computed(() =>
    this.allCategories().map(category => ({
      value: category._id,
      label: category.name,
    }))
  );

  // Trả về Category tương ứng với Product
  protected getProductCategory(p: ApiProduct): ApiCategory | undefined {
    return this.allCategories().find(
      category => category._id === p.categoryId
    );
  }

  // Lấy tên Category từ categoryId
  protected formatPrice = formatPrice;
  protected getCategoryName(categoryId: string): string {
    return this.allCategories().find(
      category => category._id === categoryId
    )?.name ?? '';
  }

  protected fulfillment = signal<'pickup' | 'delivery'>('pickup');
  protected activeSection = signal('');
  protected loading = signal(true);
  protected error = signal('');

  // Filter state
  protected search = signal('');
  protected maxPrice = signal(300);
  protected sortBy = signal('default');

  // Bộ lọc thông số dinh dưỡng dạng tick chọn + thanh kéo
  protected nutritionSliders = signal<NutritionSliderState[]>(
    NUTRITION_SLIDER_CONFIGS.map(cfg => ({
      ...cfg,
      enabled: false,
      value: cfg.defaultValue,
    }))
  );

  protected activeNutritionSliders = computed(() =>
    this.nutritionSliders().filter(s => s.enabled)
  );

  protected selectedFilters = signal<Record<string, string[]>>({
    category: [],
    diet: [],
    preparation: [],
    ripeness: [],
    sizeGroup: [],
    type: [],
    weight: [],
  });

  // Filter accordion open state
  protected openAccordions = signal<Record<string, boolean>>({
    sort: true,
    price: true,
    category: true,
    diet: true,
    nutritionTarget: true,
    preparation: false,
    ripeness: false,
    sizeGroup: false,
    type: false,
    weight: false,
  });

  // Các lựa chọn bộ lọc tiếng Việt lấy từ dữ liệu thực tế
  protected facetOptions = computed(() => {
    const targetCat = this.activeCategory();
    const sourceProducts = targetCat === 'all'
      ? this.allProducts()
      : this.allProducts().filter(p => p.categoryId === targetCat);

    const buildFacetList = (field: keyof ApiProduct): FacetOption[] => {
      const counts: Record<string, number> = {};
      for (const p of sourceProducts) {
        const val = p[field] as string;
        if (val) {
          counts[val] = (counts[val] || 0) + 1;
        }
      }

      return Object.keys(counts)
        .sort((a, b) => {
          if (field === 'sizeGroup') {
            const orderA = SIZE_ORDER[a] ?? 99;
            const orderB = SIZE_ORDER[b] ?? 99;
            return orderA - orderB;
          }
          if (field === 'weight') {
            return parseWeightInGrams(a) - parseWeightInGrams(b);
          }
          const labelA = getFacetLabel(field as string, a);
          const labelB = getFacetLabel(field as string, b);
          return labelA.localeCompare(labelB, 'vi');
        })
        .map(val => ({
          value: val,
          label: getFacetLabel(field as string, val),
          count: counts[val],
        }));
    };

    const dietCounts: Record<string, number> = {};
    for (const p of sourceProducts) {
      for (const d of getProductDiets(p)) {
        dietCounts[d] = (dietCounts[d] || 0) + 1;
      }
    }

    return {
      category: this.allCategories().map(c => ({
        value: c._id,
        label: c.name,
        count: this.allProducts().filter(p => p.categoryId === c._id).length,
      })),
      diet: DIET_FACET_OPTIONS.map(opt => ({
        value: opt.value,
        label: opt.label,
        count: dietCounts[opt.value] || 0,
      })).filter(opt => opt.count > 0),
      preparation: buildFacetList('preparation'),
      ripeness: buildFacetList('ripeness'),
      sizeGroup: buildFacetList('sizeGroup'),
      type: buildFacetList('type'),
      weight: buildFacetList('weight'),
    };
  });

  protected maxPriceInDB = computed(() =>
    Math.ceil(
      Math.max(
        ...this.allProducts().map(p => p.priceNumber),
        300
      ) / 50
    ) * 50
  );

  protected hasActiveFilters = computed(() => {
    const f = this.selectedFilters();

    return Object.values(f).some(a => a.length > 0)
      || this.maxPrice() < this.maxPriceInDB()
      || !!this.search()
      || this.activeNutritionSliders().length > 0;
  });

  // Lọc và sắp xếp sản phẩm chính xác theo từ khóa & bộ lọc
  protected filteredProducts = computed(() => {
    const f = this.selectedFilters();
    const rawQ = this.search().trim();
    const normQ = removeVietnameseTones(rawQ);
    const maxP = this.maxPrice();
    const activeSliders = this.activeNutritionSliders();

    let list = this.allProducts().filter(p => {
      if (normQ) {
        const score = scoreProduct(p, rawQ.toLowerCase(), normQ);
        if (score <= 0) {
          return false;
        }
      }

      if (p.priceNumber > maxP) return false;

      if (activeSliders.length > 0) {
        const res = matchProductByNutritionSliders(p, activeSliders);
        if (!res.matches) {
          return false;
        }
      }

      if (
        f['category'].length &&
        !f['category'].includes(p.categoryId)
      ) {
        return false;
      }

      if (f['diet']?.length) {
        const diets = getProductDiets(p);
        if (!f['diet'].some(d => diets.includes(d))) {
          return false;
        }
      }

      if (
        f['preparation'].length &&
        !f['preparation'].includes(p.preparation)
      ) return false;

      if (
        f['ripeness'].length &&
        !f['ripeness'].includes(p.ripeness)
      ) return false;

      if (
        f['sizeGroup'].length &&
        !f['sizeGroup'].includes(p.sizeGroup)
      ) return false;

      if (
        f['type'].length &&
        !f['type'].includes(p.type)
      ) return false;

      if (
        f['weight'].length &&
        !f['weight'].includes(p.weight)
      ) return false;

      return true;
    });

    if (this.sortBy() === 'price-asc') {
      list = [...list].sort((a, b) => a.priceNumber - b.priceNumber);
    } else if (this.sortBy() === 'price-desc') {
      list = [...list].sort((a, b) => b.priceNumber - a.priceNumber);
    } else if (this.sortBy() === 'name-asc') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    } else if (normQ) {
      list = [...list].sort((a, b) => {
        const scoreB = scoreProduct(b, rawQ.toLowerCase(), normQ);
        const scoreA = scoreProduct(a, rawQ.toLowerCase(), normQ);
        return scoreB - scoreA;
      });
    } else if (activeSliders.length > 0) {
      list = [...list].sort((a, b) => {
        const diffA = matchProductByNutritionSliders(a, activeSliders).totalDiff;
        const diffB = matchProductByNutritionSliders(b, activeSliders).totalDiff;
        return diffA - diffB;
      });
    }

    return list;
  });

  // Gom sản phẩm theo đúng Category trong MongoDB
  protected readonly pageSize = 20;
  protected visibleCount = signal(20);
  protected activeCategory = signal('all');
  protected categoryProducts = computed(() => {
    const products = this.filteredProducts();
    const categoryId = this.activeCategory();

    if (this.selectedFilters()['category'].length > 0) {
      return products;
    }

    if (categoryId === 'all') {
      return products;
    }

    return products.filter(p => p.categoryId === categoryId);
  });

  protected activeCategoryTitle = computed(() => {
    const selectedCats = this.selectedFilters()['category'];
    if (selectedCats.length === 1) {
      return this.getCategoryName(selectedCats[0]) || 'Fresh Ingredients';
    }
    if (selectedCats.length > 1) {
      return 'Danh mục đã chọn';
    }

    const catId = this.activeCategory();
    if (catId === 'all') {
      return 'Tất cả sản phẩm';
    }

    return this.getCategoryName(catId) || 'Sản phẩm';
  });

  protected visibleProducts = computed(() =>
    this.categoryProducts().slice(0, this.visibleCount())
  );

  protected remainingCount = computed(() =>
    Math.max(0, this.categoryProducts().length - this.visibleProducts().length)
  );

  protected selectCategory(categoryId: string): void {
    this.activeCategory.set(categoryId);
    if (this.selectedFilters()['category'].length > 0) {
      this.selectedFilters.update(f => ({ ...f, category: [] }));
    }
    this.visibleCount.set(this.pageSize);

    const listEl = document.getElementById('ord-product-list');
    if (listEl && listEl.getBoundingClientRect().top < 110) {
      this.scrollToElement(listEl);
    }
  }

  protected showMoreProducts(): void {
    this.visibleCount.update(count => count + this.pageSize);
  }

  private scrollToElement(el: HTMLElement): void {
    const yOffset = -180;
    const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({
      top: Math.max(0, y),
      behavior: 'smooth',
    });
  }

  protected sections = computed(() => {
    const products = this.categoryProducts();

    return this.allCategories()
      .map(category => ({
        id: category._id,
        title: category.name,
        items: products.filter(p => p.categoryId === category._id)
      }))
      .filter(section => section.items.length > 0);
  });

  ngOnInit(): void {
    this.cart.loadViewedProducts();
    const q = this.route.snapshot.queryParamMap.get('q');

    if (q) {
      this.search.set(q);
    }

    // Tải danh mục và sản phẩm
    let categoriesLoaded = false;
    let productsLoaded = false;

    const finishLoading = () => {
      if (categoriesLoaded && productsLoaded) {
        this.loading.set(false);
        this.maxPrice.set(this.maxPriceInDB());

        const cat = this.route.snapshot.queryParamMap.get('category');

        if (cat) {
          this.navigateToCategory(cat);
        } else {
          this.activeSection.set(this.sections()[0]?.id ?? '');
        }
      }
    };

    this.categoryApi.getAll().subscribe({
      next: res => {
        this.allCategories.set(res.data);
        categoriesLoaded = true;
        finishLoading();
      },
      error: err => {
        console.error('Không tải được danh mục:', err);
        this.error.set('Không thể tải danh mục.');
        categoriesLoaded = true;
        finishLoading();
      },
    });

    this.productApi.getAll({
      limit: 0,
      sort: 'createdAt',
      isCombo: 'false',
    }).subscribe({
      next: res => {
        // Chỉ hiển thị sản phẩm đơn lẻ thông thường trên trang ordering, không hiển thị combo như 1 sản phẩm được mua
        const regularProducts = (res.data || []).filter(p => !p.isCombo);
        this.allProducts.set(regularProducts);
        productsLoaded = true;
        finishLoading();
      },
      error: err => {
        console.error('Không tải được sản phẩm:', err);
        this.error.set('Không thể tải sản phẩm.');
        productsLoaded = true;
        finishLoading();
      },
    });

    // Theo dõi khi query parameter thay đổi
    this.route.queryParamMap.subscribe(params => {
      const cat = params.get('category');
      const q = params.get('q');
      this.search.set(q ?? '');
      if (!this.loading()) {
        if (cat) {
          this.navigateToCategory(cat);
        } else if (!q) {
          this.selectCategory('all');
        }
      }
    });
  }

  // Tìm Category bằng ID, slug hoặc name
  private navigateToCategory(value: string): void {
    const target = normalizeCategoryTarget(value).toLowerCase();

    const category = this.allCategories().find(c =>
      c._id === value ||
      c.slug.toLowerCase() === target ||
      c.slug.toLowerCase() === '/category/' + target ||
      c.name.toLowerCase() === target
    );

    if (category) {
      this.selectCategory(category._id);
      setTimeout(() => this.scrollTo(category._id), 100);
    }
  }

  scrollTo(categoryId: string): void {
    this.activeSection.set(categoryId);

    const el = document.getElementById('section-' + categoryId);

    if (el) {
      const yOffset = -90;
      const y =
        el.getBoundingClientRect().top +
        window.pageYOffset +
        yOffset;

      window.scrollTo({
        top: y,
        behavior: 'smooth',
      });
    }
  }

  toggleAccordion(key: string): void {
    this.openAccordions.update(o => ({
      ...o,
      [key]: !o[key],
    }));
  }

  toggleFilter(facet: string, val: string): void {
    this.selectedFilters.update(f => {
      const arr = f[facet] ?? [];

      return {
        ...f,
        [facet]: arr.includes(val)
          ? arr.filter(x => x !== val)
          : [...arr, val],
      };
    });
  }

  isChecked(facet: string, val: string): boolean {
    return (this.selectedFilters()[facet] ?? []).includes(val);
  }

  toggleNutritionSlider(key: NutritionMetricKey, checked?: boolean): void {
    this.nutritionSliders.update(list =>
      list.map(item =>
        item.key === key
          ? { ...item, enabled: checked !== undefined ? checked : !item.enabled }
          : item
      )
    );
  }

  onNutritionSliderChange(key: NutritionMetricKey, val: number): void {
    const safeVal = isNaN(val) || val < 0 ? 0 : val;
    this.nutritionSliders.update(list =>
      list.map(item =>
        item.key === key
          ? { ...item, enabled: true, value: safeVal }
          : item
      )
    );
  }

  onNutritionNumberInput(key: NutritionMetricKey, rawVal: string): void {
    const trimmed = String(rawVal ?? '').trim().replace(',', '.');
    if (trimmed === '') {
      this.nutritionSliders.update(list =>
        list.map(item =>
          item.key === key ? { ...item, enabled: false, value: 0 } : item
        )
      );
      return;
    }
    const parsed = parseFloat(trimmed);
    if (!isNaN(parsed) && parsed >= 0) {
      this.nutritionSliders.update(list =>
        list.map(item =>
          item.key === key ? { ...item, enabled: true, value: parsed } : item
        )
      );
    }
  }

  clearNutritionTargets(): void {
    this.nutritionSliders.set(
      NUTRITION_SLIDER_CONFIGS.map(cfg => ({
        ...cfg,
        enabled: false,
        value: cfg.defaultValue,
      }))
    );
  }

  clearAllFilters(): void {
    this.selectedFilters.set({
      category: [],
      diet: [],
      preparation: [],
      ripeness: [],
      sizeGroup: [],
      type: [],
      weight: [],
    });

    this.search.set('');
    this.clearNutritionTargets();
    this.maxPrice.set(this.maxPriceInDB());
    this.sortBy.set('default');
  }

  itemQty(slug: string): number {
    return this.cart.items().find(
      i => i.product.slug === slug && i.itemType !== 'addon'
    )?.quantity ?? 0;
  }

  hasActiveAddOnDeals(prod: ApiProduct): boolean {
    if (!Array.isArray(prod.addOnDeals) || prod.addOnDeals.length === 0) return false;
    return prod.addOnDeals.some((d) => {
      if (!d || d.isActive === false || Number(d.discountValue) <= 0) return false;
      const p = d.product as any;
      return p && typeof p === 'object' && p.isActive !== false && !p.isCombo;
    });
  }

  formatViewedTime(iso: string): string {
    if (!iso) return '';
    const time = new Date(iso).getTime();
    if (Number.isNaN(time)) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (diffSec < 60) return 'Vừa xem';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} giờ trước`;
    const d = new Date(time);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  getProdStock(prod: ApiProduct): number {
    if (prod.isCombo) {
      if (prod.comboStatus === 'paused' || prod.comboStatus === 'hidden') return 0;
      if (typeof prod.availableStock === 'number') return Math.max(0, Math.floor(prod.availableStock));
    }
    return typeof prod.stock === 'number' ? Math.max(0, Math.floor(prod.stock)) : 0;
  }

  isProdUnavailable(prod: ApiProduct): boolean {
    return prod.isActive === false || this.getProdStock(prod) <= 0;
  }

  openBuyNow(prod: ApiProduct): void {
    if (this.isProdUnavailable(prod)) return;
    this.cart.openBuyNowModal(toCartProduct(prod));
  }

  addOne(prod: ApiProduct, event?: Event): void {
    if (this.isProdUnavailable(prod)) return;
    const maxStock = this.getProdStock(prod);
    if (this.itemQty(prod.slug) >= maxStock) return;
    if (event) {
      this.cart.animateFlyToCart(event, prod.image);
    }
    this.cart.addItem(toCartProduct(prod), 1);
  }

  removeOne(prod: ApiProduct): void {
    const qty = this.itemQty(prod.slug);

    if (qty > 1) {
      this.cart.updateQuantity(prod.slug, qty - 1);
    } else {
      this.cart.removeItem(prod.slug);
    }
  }

  goToCart(): void {
    this.router.navigate(['/cart']);
  }

  getComboItemName(it: any): string {
    return it?.product?.name || it?.name || 'Sản phẩm';
  }
}