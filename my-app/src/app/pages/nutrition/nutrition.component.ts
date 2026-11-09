import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError } from 'rxjs';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { ApiService } from '../../shared/services/api.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

export interface IngredientItem {
  name: string;
  amount: string;
  unit: string;
  product: ApiProduct | null;
  selected: boolean;
  owned: boolean;
}

export interface RecipeMacros {
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  vitamins: string;
}

export interface RecipeStep {
  stepNumber: number;
  title: string;
  detail: string;
}

export interface RecipeResult {
  id: string;
  name: string;
  image: string;
  gallery: string[];
  description: string;
  matchScore: number;
  servings: number;
  meals: number;
  prepTime: string;
  cookTime: string;
  difficulty: string;
  calories: number;
  macros: RecipeMacros;
  chefTips: string;
  steps: RecipeStep[];
  ingredients: IngredientItem[];
  nutritionNote: string;
  goalsTags: string[];
  goalsMet: string[];
  explanation?: string[];
}

export interface RecipeDbItem {
  id: string;
  name: string;
  image: string;
  gallery?: string[];
  description: string;
  prepTime: string;
  cookTime?: string;
  difficulty?: string;
  calories?: number;
  macros?: RecipeMacros;
  chefTips?: string;
  steps?: RecipeStep[];
  servingBase: number;
  nutritionNote: string;
  goalsTags: string[];
  ingredients: { name: string; amountPer1Serving: number; unit: string; product?: ApiProduct | null }[];
}

export interface GoalItem {
  id: string;
  label: string;
  icon: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface MealPlanDeal {
  id: string;
  name: string;
  image?: string;
  badge: string;
  discountPercent: number;
  voucherCode: string;
  calories: string;
  targetAudience: string;
  description: string;
  goals: string[];
  servings: number;
  mealsCount: number;
  recipeIds: string[];
}

export interface MealPlanCardView extends MealPlanDeal {
  image: string;
  recipes: RecipeResult[];
  recipeNames: string[];
  matchedProducts: ApiProduct[];
  originalTotal: number;
  originalTotalText: string;
  dealTotal: number;
  dealTotalText: string;
  savedText: string;
}

export interface NutritionHeroConfig {
  kicker: string;
  title: string;
  subtitle: string;
  bannerImage: string;
}

export type MealSlotKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface DayMealPlanMap {
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
}

export interface MealSlotView {
  slotKey: MealSlotKey;
  slotLabel: string;
  slotTime: string;
  slotIcon: string;
  recipe: RecipeResult | null;
  portionMultiplier?: number;
  scaledCalories?: number;
  scaledProtein?: number;
  scaledFiber?: number;
  scaledCarbs?: number;
  scaledFat?: number;
}

export interface PlanIngredientBreakdown {
  product: ApiProduct;
  unitPrice: number;
  neededPacks: number;
  inCartPacks: number;
  missingPacks: number;
  totalPrice: number;
  inCartValue: number;
  missingDealPrice: number;
  owned: boolean;
  totalPortionMultiplier: number;
  usedInSlots: string[];
  estimatedGramsNeeded: number;
  formulaExplanation: string;
}

export interface DayPlanComputedView {
  dayKey: string;
  dayLabel: string;
  dayTheme: string;
  mealsPerDayCount: number;
  slots: MealSlotView[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  originalPrice: number;
  dealPrice: number;
  savedPrice: number;
  matchedProducts: ApiProduct[];
  alreadyInCartCount: number;
  alreadyInCartVal: number;
  missingCount: number;
  missingOriginalPrice: number;
  missingDealPrice: number;
  allInCart: boolean;
  ingredientBreakdown: PlanIngredientBreakdown[];
}

export const GOAL_ICONS: Record<string, string> = {
  protein: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8c0 2.2-1.8 4-4 4-1.1 0-2.1-.4-2.8-1.1"/><path d="M3 8c0 2.2 1.8 4 4 4 1.1 0-2.1-.4 2.8-1.1"/><path d="M12 20V4"/><path d="M8 16l4 4 4-4"/></svg>',
  fiber: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22l14-14"/><path d="M4 8l14 14"/><path d="M18 4v4"/><path d="M18 8h4"/></svg>',
  vitamin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/></svg>',
  mineral: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M12 2v20"/><path d="M2 12h20"/></svg>',
  variety: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  balance: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M4 6h16"/><path d="M4 18h16"/><path d="M12 7l4-4"/><path d="M12 7l-4-4"/><path d="M12 17l4 4"/><path d="M12 17l-4-4"/></svg>',
};

const FALLBACK_FOOD_IMG = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=700&q=80';

function formatProductSlug(slug?: string, id?: string): string {
  const raw = (slug || id || '').trim();
  if (!raw) return '/online-ordering';
  return raw.startsWith('/') ? raw : `/product-page/${raw}`;
}

function toCartProduct(p: ApiProduct, customPrice?: number): XanhLaProduct {
  const finalPrice = customPrice ?? (p.priceNumber || 0);
  const cleanSlug = (p.slug || '').replace(/^\/product-page\//, '').replace(/^\//, '').trim() || p._id || 'sp';
  return {
    id: p._id || p.slug || cleanSlug,
    name: p.name,
    slug: cleanSlug,
    price: customPrice !== undefined ? formatPrice(customPrice) : p.price,
    priceNumber: finalPrice,
    image: p.image || FALLBACK_FOOD_IMG,
    category: p.categoryId,
    categoryVi: p.categoryVi || '',
    description: p.description || '',
    container: p.container || '',
    cutType: p.cutType || '',
    cutting: p.cutting || '',
    packSize: p.packSize || '',
    packaging: p.packaging || '',
    preparation: p.preparation || '',
    quantity: p.quantity || '',
    ripeness: p.ripeness || '',
    sizeGroup: p.sizeGroup || '',
    thickness: p.thickness || '',
    type: p.type || '',
    weight: p.weight || '',
    options: p.options,
  };
}

function normalizeStr(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function lowerKeepDiacritics(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function parseGramWeight(weightStr?: string): number {
  if (!weightStr) return 0;
  const str = weightStr.toLowerCase().trim();
  const kgMatch = str.match(/([0-9]+(?:[.,][0-9]+)?)\s*kg/);
  if (kgMatch) {
    const val = parseFloat(kgMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return Math.round(val * 1000);
  }
  const gMatch = str.match(/([0-9]+)\s*(?:g|gram)/);
  if (gMatch) {
    const val = parseInt(gMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return 0;
}

export interface IngredientMetaDef {
  slug: string;
  name: string;
  priceNumber: number;
  weight: string;
  categoryVi: string;
  image: string;
}

const EXACT_INGREDIENT_META: Record<string, IngredientMetaDef> = {
  // Gà ta / Thịt gà
  'gà ta thả vườn nguyên con': {
    slug: 'ga-ta-tha-vuon-nguyen-con',
    name: 'Gà Ta Thả Vườn Nguyên Con',
    priceNumber: 95000,
    weight: 'Khay 500g',
    categoryVi: 'Thịt tươi sạch',
    image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&q=80',
  },
  'gà ta thả vườn': {
    slug: 'ga-ta-tha-vuon-nguyen-con',
    name: 'Gà Ta Thả Vườn Nguyên Con',
    priceNumber: 95000,
    weight: 'Khay 500g',
    categoryVi: 'Thịt tươi sạch',
    image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&q=80',
  },
  'thịt gà thả vườn': {
    slug: 'ga-ta-tha-vuon-nguyen-con',
    name: 'Gà Ta Thả Vườn Nguyên Con',
    priceNumber: 95000,
    weight: 'Khay 500g',
    categoryVi: 'Thịt tươi sạch',
    image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&q=80',
  },
  'thịt gà': {
    slug: 'ga-ta-tha-vuon-nguyen-con',
    name: 'Gà Ta Thả Vườn Nguyên Con',
    priceNumber: 95000,
    weight: 'Khay 500g',
    categoryVi: 'Thịt tươi sạch',
    image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&q=80',
  },
  'ức gà': {
    slug: 'ga-ta-tha-vuon-nguyen-con',
    name: 'Gà Ta Thả Vườn Nguyên Con',
    priceNumber: 95000,
    weight: 'Khay 500g',
    categoryVi: 'Thịt tươi sạch',
    image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&q=80',
  },
  'gà ta': {
    slug: 'ga-ta-tha-vuon-nguyen-con',
    name: 'Gà Ta Thả Vườn Nguyên Con',
    priceNumber: 95000,
    weight: 'Khay 500g',
    categoryVi: 'Thịt tươi sạch',
    image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&q=80',
  },

  // Ớt chuông
  'ớt chuông 3 màu': {
    slug: 'ot-chuong-3-mau-da-lat',
    name: 'Ớt Chuông 3 Màu Đà Lạt',
    priceNumber: 35000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&q=80',
  },
  'ớt chuông đà lạt': {
    slug: 'ot-chuong-3-mau-da-lat',
    name: 'Ớt Chuông 3 Màu Đà Lạt',
    priceNumber: 35000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&q=80',
  },
  'ớt chuông': {
    slug: 'ot-chuong-3-mau-da-lat',
    name: 'Ớt Chuông 3 Màu Đà Lạt',
    priceNumber: 35000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&q=80',
  },
  'ớt chuông 3 màu đà lạt': {
    slug: 'ot-chuong-3-mau-da-lat',
    name: 'Ớt Chuông 3 Màu Đà Lạt',
    priceNumber: 35000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&q=80',
  },

  // Cá hồi
  'cá hồi na uy fillet tươi': {
    slug: 'ca-hoi-na-uy-fillet-tuoi',
    name: 'Cá Hồi Na Uy Fillet Tươi',
    priceNumber: 165000,
    weight: 'Khay 250g',
    categoryVi: 'Hải sản tươi sống',
    image: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=600&q=80',
  },
  'cá hồi phi lê': {
    slug: 'ca-hoi-na-uy-fillet-tuoi',
    name: 'Cá Hồi Na Uy Fillet Tươi',
    priceNumber: 165000,
    weight: 'Khay 250g',
    categoryVi: 'Hải sản tươi sống',
    image: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=600&q=80',
  },
  'cá hồi na uy': {
    slug: 'ca-hoi-na-uy-fillet-tuoi',
    name: 'Cá Hồi Na Uy Fillet Tươi',
    priceNumber: 165000,
    weight: 'Khay 250g',
    categoryVi: 'Hải sản tươi sống',
    image: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=600&q=80',
  },
  'cá hồi': {
    slug: 'ca-hoi-na-uy-fillet-tuoi',
    name: 'Cá Hồi Na Uy Fillet Tươi',
    priceNumber: 165000,
    weight: 'Khay 250g',
    categoryVi: 'Hải sản tươi sống',
    image: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=600&q=80',
  },

  // Bông cải xanh
  'bông cải xanh đà lạt': {
    slug: 'bong-cai-xanh-da-lat',
    name: 'Bông Cải Xanh Đà Lạt',
    priceNumber: 28000,
    weight: 'Búp 350g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&q=80',
  },
  'bông cải xanh': {
    slug: 'bong-cai-xanh-da-lat',
    name: 'Bông Cải Xanh Đà Lạt',
    priceNumber: 28000,
    weight: 'Búp 350g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&q=80',
  },

  // Cà rốt
  'cà rốt baby đà lạt': {
    slug: 'ca-rot-baby-da-lat',
    name: 'Cà Rốt Baby Đà Lạt',
    priceNumber: 22000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&q=80',
  },
  'cà rốt đà lạt': {
    slug: 'ca-rot-baby-da-lat',
    name: 'Cà Rốt Baby Đà Lạt',
    priceNumber: 22000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&q=80',
  },
  'cà rốt baby': {
    slug: 'ca-rot-baby-da-lat',
    name: 'Cà Rốt Baby Đà Lạt',
    priceNumber: 22000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&q=80',
  },
  'cà rốt': {
    slug: 'ca-rot-baby-da-lat',
    name: 'Cà Rốt Baby Đà Lạt',
    priceNumber: 22000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&q=80',
  },

  // Dưa leo
  'dưa leo baby đà lạt': {
    slug: 'dua-leo-baby-da-lat',
    name: 'Dưa Leo Baby Đà Lạt',
    priceNumber: 20000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=600&q=80',
  },
  'dưa leo baby': {
    slug: 'dua-leo-baby-da-lat',
    name: 'Dưa Leo Baby Đà Lạt',
    priceNumber: 20000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=600&q=80',
  },
  'dưa leo': {
    slug: 'dua-leo-baby-da-lat',
    name: 'Dưa Leo Baby Đà Lạt',
    priceNumber: 20000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=600&q=80',
  },
  'dưa leo tươi': {
    slug: 'dua-leo-baby-da-lat',
    name: 'Dưa Leo Baby Đà Lạt',
    priceNumber: 20000,
    weight: 'Túi 400g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=600&q=80',
  },

  // Cà chua
  'cà chua bi đà lạt': {
    slug: 'ca-chua-bi-da-lat',
    name: 'Cà Chua Bi Đà Lạt',
    priceNumber: 25000,
    weight: 'Hộp 350g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&q=80',
  },
  'cà chua bi': {
    slug: 'ca-chua-bi-da-lat',
    name: 'Cà Chua Bi Đà Lạt',
    priceNumber: 25000,
    weight: 'Hộp 350g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&q=80',
  },
  'cà chua': {
    slug: 'ca-chua-bi-da-lat',
    name: 'Cà Chua Bi Đà Lạt',
    priceNumber: 25000,
    weight: 'Hộp 350g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&q=80',
  },

  // Thịt bò
  'thịt bò bắp mỹ nhập khẩu': {
    slug: 'thit-bo-bap-my-nhap-khau',
    name: 'Thịt Bò Bắp Mỹ Nhập Khẩu',
    priceNumber: 135000,
    weight: 'Khay 300g',
    categoryVi: 'Thịt bò nhập khẩu',
    image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=600&q=80',
  },
  'thịt bò bắp mỹ': {
    slug: 'thit-bo-bap-my-nhap-khau',
    name: 'Thịt Bò Bắp Mỹ Nhập Khẩu',
    priceNumber: 135000,
    weight: 'Khay 300g',
    categoryVi: 'Thịt bò nhập khẩu',
    image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=600&q=80',
  },
  'thịt bò mỹ': {
    slug: 'thit-bo-bap-my-nhap-khau',
    name: 'Thịt Bò Bắp Mỹ Nhập Khẩu',
    priceNumber: 135000,
    weight: 'Khay 300g',
    categoryVi: 'Thịt bò nhập khẩu',
    image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=600&q=80',
  },
  'thịt bò': {
    slug: 'thit-bo-bap-my-nhap-khau',
    name: 'Thịt Bò Bắp Mỹ Nhập Khẩu',
    priceNumber: 135000,
    weight: 'Khay 300g',
    categoryVi: 'Thịt bò nhập khẩu',
    image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=600&q=80',
  },
  'bò bắp': {
    slug: 'thit-bo-bap-my-nhap-khau',
    name: 'Thịt Bò Bắp Mỹ Nhập Khẩu',
    priceNumber: 135000,
    weight: 'Khay 300g',
    categoryVi: 'Thịt bò nhập khẩu',
    image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=600&q=80',
  },
  'bò mỹ thăn': {
    slug: 'thit-bo-bap-my-nhap-khau',
    name: 'Thịt Bò Bắp Mỹ Nhập Khẩu',
    priceNumber: 135000,
    weight: 'Khay 300g',
    categoryVi: 'Thịt bò nhập khẩu',
    image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=600&q=80',
  },

  // Cải xanh
  'cải xanh đà lạt': {
    slug: 'cai-xanh-da-lat',
    name: 'Cải Xanh Đà Lạt',
    priceNumber: 18000,
    weight: 'Bó 350g',
    categoryVi: 'Rau lá hữu cơ',
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80',
  },
  'cải xanh': {
    slug: 'cai-xanh-da-lat',
    name: 'Cải Xanh Đà Lạt',
    priceNumber: 18000,
    weight: 'Bó 350g',
    categoryVi: 'Rau lá hữu cơ',
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80',
  },

  // Sữa chua Hy Lạp
  'sữa chua hy lạp hữu cơ không đường': {
    slug: 'sua-chua-hy-lap-huu-co',
    name: 'Sữa Chua Hy Lạp Hữu Cơ Không Đường',
    priceNumber: 45000,
    weight: 'Hộp 250g',
    categoryVi: 'Sữa chua & Chế phẩm sữa',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80',
  },
  'sữa chua hy lạp hữu cơ': {
    slug: 'sua-chua-hy-lap-huu-co',
    name: 'Sữa Chua Hy Lạp Hữu Cơ Không Đường',
    priceNumber: 45000,
    weight: 'Hộp 250g',
    categoryVi: 'Sữa chua & Chế phẩm sữa',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80',
  },
  'sữa chua hy lạp': {
    slug: 'sua-chua-hy-lap-huu-co',
    name: 'Sữa Chua Hy Lạp Hữu Cơ Không Đường',
    priceNumber: 45000,
    weight: 'Hộp 250g',
    categoryVi: 'Sữa chua & Chế phẩm sữa',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80',
  },

  // Sữa chua men sống
  'sữa chua men sống đà lạt ít đường': {
    slug: 'sua-chua-men-song-da-lat',
    name: 'Sữa Chua Men Sống Đà Lạt Ít Đường',
    priceNumber: 32000,
    weight: 'Lốc 4 hộp',
    categoryVi: 'Sữa chua & Chế phẩm sữa',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80',
  },
  'sữa chua men sống đà lạt': {
    slug: 'sua-chua-men-song-da-lat',
    name: 'Sữa Chua Men Sống Đà Lạt Ít Đường',
    priceNumber: 32000,
    weight: 'Lốc 4 hộp',
    categoryVi: 'Sữa chua & Chế phẩm sữa',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80',
  },
  'sữa chua men sống': {
    slug: 'sua-chua-men-song-da-lat',
    name: 'Sữa Chua Men Sống Đà Lạt Ít Đường',
    priceNumber: 32000,
    weight: 'Lốc 4 hộp',
    categoryVi: 'Sữa chua & Chế phẩm sữa',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80',
  },

  // Dâu tây
  'dâu tây đà lạt': {
    slug: 'dau-tay-da-lat',
    name: 'Dâu Tây Đà Lạt',
    priceNumber: 85000,
    weight: 'Hộp 250g',
    categoryVi: 'Trái cây Đà Lạt',
    image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600&q=80',
  },
  'dâu tây': {
    slug: 'dau-tay-da-lat',
    name: 'Dâu Tây Đà Lạt',
    priceNumber: 85000,
    weight: 'Hộp 250g',
    categoryVi: 'Trái cây Đà Lạt',
    image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600&q=80',
  },

  // Xoài cát
  'xoài cát hòa lộc': {
    slug: 'xoai-cat-hoa-loc',
    name: 'Xoài Cát Hòa Lộc',
    priceNumber: 55000,
    weight: 'Trái 500g',
    categoryVi: 'Trái cây miền Tây',
    image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&q=80',
  },
  'xoài cát': {
    slug: 'xoai-cat-hoa-loc',
    name: 'Xoài Cát Hòa Lộc',
    priceNumber: 55000,
    weight: 'Trái 500g',
    categoryVi: 'Trái cây miền Tây',
    image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&q=80',
  },

  // Nấm đông cô
  'nấm đông cô đà lạt': {
    slug: 'nam-dong-co-da-lat',
    name: 'Nấm Đông Cô Đà Lạt',
    priceNumber: 42000,
    weight: 'Khay 250g',
    categoryVi: 'Nấm tươi hữu cơ',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  },
  'nấm đông cô tươi': {
    slug: 'nam-dong-co-da-lat',
    name: 'Nấm Đông Cô Đà Lạt',
    priceNumber: 42000,
    weight: 'Khay 250g',
    categoryVi: 'Nấm tươi hữu cơ',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  },
  'nấm đông cô': {
    slug: 'nam-dong-co-da-lat',
    name: 'Nấm Đông Cô Đà Lạt',
    priceNumber: 42000,
    weight: 'Khay 250g',
    categoryVi: 'Nấm tươi hữu cơ',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  },

  // Tôm sú
  'tôm sú tươi sống cà mau': {
    slug: 'tom-su-tuoi-song-ca-mau',
    name: 'Tôm Sú Tươi Sống Cà Mau',
    priceNumber: 125000,
    weight: 'Khay 350g',
    categoryVi: 'Hải sản tươi sống',
    image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&q=80',
  },
  'tôm sú tươi sống': {
    slug: 'tom-su-tuoi-song-ca-mau',
    name: 'Tôm Sú Tươi Sống Cà Mau',
    priceNumber: 125000,
    weight: 'Khay 350g',
    categoryVi: 'Hải sản tươi sống',
    image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&q=80',
  },
  'tôm sú': {
    slug: 'tom-su-tuoi-song-ca-mau',
    name: 'Tôm Sú Tươi Sống Cà Mau',
    priceNumber: 125000,
    weight: 'Khay 350g',
    categoryVi: 'Hải sản tươi sống',
    image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&q=80',
  },

  // Cải ngọt
  'rau cải ngọt': {
    slug: 'rau-cai-ngot-huu-co',
    name: 'Rau Cải Ngọt Hữu Cơ',
    priceNumber: 18000,
    weight: 'Bó 350g',
    categoryVi: 'Rau ăn lá hữu cơ',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
  },
  'cải ngọt hữu cơ': {
    slug: 'rau-cai-ngot-huu-co',
    name: 'Rau Cải Ngọt Hữu Cơ',
    priceNumber: 18000,
    weight: 'Bó 350g',
    categoryVi: 'Rau ăn lá hữu cơ',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
  },
  'cải ngọt': {
    slug: 'rau-cai-ngot-huu-co',
    name: 'Rau Cải Ngọt Hữu Cơ',
    priceNumber: 18000,
    weight: 'Bó 350g',
    categoryVi: 'Rau ăn lá hữu cơ',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
  },
  'rau cải': {
    slug: 'cai-thia-baby-da-lat',
    name: 'Cải Thìa Baby Đà Lạt',
    priceNumber: 20000,
    weight: 'Túi 350g',
    categoryVi: 'Rau ăn lá hữu cơ',
    image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=600&q=80',
  },

  // Sả tươi
  'sả tươi bến tre': {
    slug: 'sa-tuoi-ben-tre',
    name: 'Sả Tươi Bến Tre',
    priceNumber: 12000,
    weight: 'Bó 200g',
    categoryVi: 'Rau gia vị',
    image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80',
  },
  'sả tươi': {
    slug: 'sa-tuoi-ben-tre',
    name: 'Sả Tươi Bến Tre',
    priceNumber: 12000,
    weight: 'Bó 200g',
    categoryVi: 'Rau gia vị',
    image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80',
  },

  // Quả bơ
  'bơ sáp đắk lắk': {
    slug: 'bo-sap-dak-lak',
    name: 'Bơ Sáp Đắk Lắk',
    priceNumber: 48000,
    weight: 'Túi 500g',
    categoryVi: 'Trái cây Tây Nguyên',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&q=80',
  },
  'quả bơ sáp': {
    slug: 'bo-sap-dak-lak',
    name: 'Bơ Sáp Đắk Lắk',
    priceNumber: 48000,
    weight: 'Túi 500g',
    categoryVi: 'Trái cây Tây Nguyên',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&q=80',
  },
  'bơ hass đắk lắk': {
    slug: 'bo-sap-dak-lak',
    name: 'Bơ Sáp Đắk Lắk',
    priceNumber: 48000,
    weight: 'Túi 500g',
    categoryVi: 'Trái cây Tây Nguyên',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&q=80',
  },
  'bơ sáp': {
    slug: 'bo-sap-dak-lak',
    name: 'Bơ Sáp Đắk Lắk',
    priceNumber: 48000,
    weight: 'Túi 500g',
    categoryVi: 'Trái cây Tây Nguyên',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&q=80',
  },

  // Bí đỏ
  'bí đỏ hồ lô đà lạt': {
    slug: 'bi-do-ho-lo-da-lat',
    name: 'Bí Đỏ Hồ Lô Đà Lạt',
    priceNumber: 24000,
    weight: 'Trái 600g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=600&q=80',
  },
  'bí đỏ hồ lô': {
    slug: 'bi-do-ho-lo-da-lat',
    name: 'Bí Đỏ Hồ Lô Đà Lạt',
    priceNumber: 24000,
    weight: 'Trái 600g',
    categoryVi: 'Rau củ Đà Lạt',
    image: 'https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=600&q=80',
  },

  // Thịt heo
  'thịt ba rọi heo thảo mộc': {
    slug: 'thit-ba-roi-heo-thao-moc',
    name: 'Thịt Ba Rọi Heo Thảo Mộc',
    priceNumber: 88000,
    weight: 'Khay 350g',
    categoryVi: 'Thịt heo thảo mộc',
    image: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=600&q=80',
  },
  'thịt heo thảo mộc': {
    slug: 'thit-ba-roi-heo-thao-moc',
    name: 'Thịt Ba Rọi Heo Thảo Mộc',
    priceNumber: 88000,
    weight: 'Khay 350g',
    categoryVi: 'Thịt heo thảo mộc',
    image: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=600&q=80',
  },
  'thịt ba rọi': {
    slug: 'thit-ba-roi-heo-thao-moc',
    name: 'Thịt Ba Rọi Heo Thảo Mộc',
    priceNumber: 88000,
    weight: 'Khay 350g',
    categoryVi: 'Thịt heo thảo mộc',
    image: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=600&q=80',
  },

  // Cải thìa
  'cải thìa baby đà lạt': {
    slug: 'cai-thia-baby-da-lat',
    name: 'Cải Thìa Baby Đà Lạt',
    priceNumber: 20000,
    weight: 'Túi 350g',
    categoryVi: 'Rau ăn lá hữu cơ',
    image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=600&q=80',
  },
  'cải thìa baby': {
    slug: 'cai-thia-baby-da-lat',
    name: 'Cải Thìa Baby Đà Lạt',
    priceNumber: 20000,
    weight: 'Túi 350g',
    categoryVi: 'Rau ăn lá hữu cơ',
    image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=600&q=80',
  },
  'cải thìa đà lạt': {
    slug: 'cai-thia-baby-da-lat',
    name: 'Cải Thìa Baby Đà Lạt',
    priceNumber: 20000,
    weight: 'Túi 350g',
    categoryVi: 'Rau ăn lá hữu cơ',
    image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=600&q=80',
  },
  'cải thìa': {
    slug: 'cai-thia-baby-da-lat',
    name: 'Cải Thìa Baby Đà Lạt',
    priceNumber: 20000,
    weight: 'Túi 350g',
    categoryVi: 'Rau ăn lá hữu cơ',
    image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=600&q=80',
  },

  // Cam sành
  'cam sành vĩnh long': {
    slug: 'cam-sanh-vinh-long',
    name: 'Cam Sành Vĩnh Long',
    priceNumber: 36000,
    weight: 'Túi 1kg',
    categoryVi: 'Trái cây miền Tây',
    image: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=600&q=80',
  },
  'cam sành tươi': {
    slug: 'cam-sanh-vinh-long',
    name: 'Cam Sành Vĩnh Long',
    priceNumber: 36000,
    weight: 'Túi 1kg',
    categoryVi: 'Trái cây miền Tây',
    image: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=600&q=80',
  },
  'cam sành': {
    slug: 'cam-sanh-vinh-long',
    name: 'Cam Sành Vĩnh Long',
    priceNumber: 36000,
    weight: 'Túi 1kg',
    categoryVi: 'Trái cây miền Tây',
    image: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=600&q=80',
  },
};

function resolveIngredientMeta(rawKey: string): IngredientMetaDef | null {
  if (EXACT_INGREDIENT_META[rawKey]) return EXACT_INGREDIENT_META[rawKey];
  for (const [k, meta] of Object.entries(EXACT_INGREDIENT_META)) {
    if (rawKey.includes(k) || k.includes(rawKey)) {
      return meta;
    }
  }
  if (rawKey.includes('gà')) return EXACT_INGREDIENT_META['gà ta thả vườn nguyên con'];
  if (rawKey.includes('ớt chuông')) return EXACT_INGREDIENT_META['ớt chuông 3 màu'];
  if (rawKey.includes('cá hồi')) return EXACT_INGREDIENT_META['cá hồi na uy fillet tươi'];
  if (rawKey.includes('thịt bò') || rawKey.includes('bò')) return EXACT_INGREDIENT_META['thịt bò bắp mỹ nhập khẩu'];
  if (rawKey.includes('bông cải')) return EXACT_INGREDIENT_META['bông cải xanh đà lạt'];
  if (rawKey.includes('cà rốt')) return EXACT_INGREDIENT_META['cà rốt baby đà lạt'];
  if (rawKey.includes('cà chua')) return EXACT_INGREDIENT_META['cà chua bi đà lạt'];
  if (rawKey.includes('dưa leo') || rawKey.includes('dưa chuột')) return EXACT_INGREDIENT_META['dưa leo baby đà lạt'];
  if (rawKey.includes('sữa chua men sống')) return EXACT_INGREDIENT_META['sữa chua men sống đà lạt ít đường'];
  if (rawKey.includes('sữa chua')) return EXACT_INGREDIENT_META['sữa chua hy lạp hữu cơ không đường'];
  if (rawKey.includes('dâu tây')) return EXACT_INGREDIENT_META['dâu tây đà lạt'];
  if (rawKey.includes('xoài')) return EXACT_INGREDIENT_META['xoài cát hòa lộc'];
  if (rawKey.includes('nấm')) return EXACT_INGREDIENT_META['nấm đông cô đà lạt'];
  if (rawKey.includes('tôm')) return EXACT_INGREDIENT_META['tôm sú tươi sống cà mau'];
  if (rawKey.includes('cải thìa')) return EXACT_INGREDIENT_META['cải thìa baby'];
  if (rawKey.includes('cải xanh')) return EXACT_INGREDIENT_META['cải xanh đà lạt'];
  if (rawKey.includes('cải ngọt') || rawKey.includes('rau cải')) return EXACT_INGREDIENT_META['rau cải ngọt'];
  if (rawKey.includes('sả')) return EXACT_INGREDIENT_META['sả tươi bến tre'];
  if (rawKey.includes('bơ')) return EXACT_INGREDIENT_META['bơ sáp đắk lắk'];
  if (rawKey.includes('bí đỏ')) return EXACT_INGREDIENT_META['bí đỏ hồ lô đà lạt'];
  if (rawKey.includes('heo') || rawKey.includes('ba rọi')) return EXACT_INGREDIENT_META['thịt ba rọi heo thảo mộc'];
  if (rawKey.includes('cam')) return EXACT_INGREDIENT_META['cam sành vĩnh long'];
  return null;
}

function isCompatibleProduct(ingredientRaw: string, product: ApiProduct): boolean {
  if (!product || !product.name) return false;
  const pName = lowerKeepDiacritics(product.name);
  const pSlug = product.slug || '';
  const ing = lowerKeepDiacritics(ingredientRaw);

  // If ingredient is cải xanh (not bông cải), product must NOT be bông cải
  if (ing.includes('cải xanh') && !ing.includes('bông cải')) {
    if (pName.includes('bông cải') || pSlug.includes('bong-cai')) return false;
  }
  // If ingredient is nấm, product must have nấm
  if (ing.includes('nấm') && !pName.includes('nấm') && !pSlug.includes('nam')) {
    return false;
  }
  // If ingredient is cà rốt, product must have cà rốt
  if (ing.includes('cà rốt') && !pName.includes('cà rốt') && !pSlug.includes('ca-rot')) {
    return false;
  }
  // If ingredient is ớt chuông, product must have ớt chuông
  if (ing.includes('ớt chuông') && !pName.includes('ớt chuông') && !pSlug.includes('ot-chuong')) {
    return false;
  }
  // If ingredient is gà, product must have gà
  if (ing.includes('gà') && !pName.includes('gà') && !pSlug.includes('ga')) {
    return false;
  }
  // If ingredient is sả, product must be real sả, and NOT cá thu, cá hồi, thịt, or false match from 'đặc sản'
  if (/(?:^|[\s,;.-])sả(?:$|[\s,;.-])/i.test(ing) || ing.includes('sả')) {
    const isRealSa = /(?:^|[\s,;.-])sả(?:$|[\s,;.-])|củ\s*sả|sả\s*tươi/i.test(pName);
    const hasFalseMatch = /đặc\s*sản|nông\s*sản|thủy\s*sản|hải\s*sản|khoáng\s*sản/i.test(pName);
    const isMeatOrFish = /cá\s*thu|cá\s*hồi|thịt|heo|bò|gà|tôm/i.test(pName);
    if (!isRealSa || hasFalseMatch || isMeatOrFish || pName.includes('rau ngót') || pSlug.includes('rau-ngot')) {
      return false;
    }
  }
  // If ingredient is bơ, product must NOT be thịt bò
  if (ing.includes('bơ') && (pName.includes('thịt bò') || pSlug.includes('thit-bo') || pName.includes('bò bắp'))) {
    return false;
  }
  // If ingredient is thịt bò, product must have bò and NOT bơ
  if (ing.includes('bò') && !ing.includes('bơ') && (!pName.includes('bò') || pName.includes('bơ sáp'))) {
    return false;
  }
  return true;
}

function matchCatalogueProduct(
  ingredientName: string,
  catalogue: ApiProduct[],
  preMatched?: ApiProduct | null
): ApiProduct | null {
  const rawKey = lowerKeepDiacritics(ingredientName);
  const exactMeta = resolveIngredientMeta(rawKey);

  // 0. If the backend already matched the product AND it is actually compatible with the ingredient name, use it
  if (preMatched && preMatched.name && (preMatched.image || preMatched.priceNumber)) {
    if (isCompatibleProduct(rawKey, preMatched)) {
      return preMatched;
    }
  }

  // 1. Strict match in catalogue (MongoDB products)
  if (catalogue && catalogue.length > 0) {
    if (exactMeta) {
      const bySlug = catalogue.find(
        (p) => p.slug === exactMeta.slug || normalizeStr(p.slug) === normalizeStr(exactMeta.slug)
      );
      if (bySlug && isCompatibleProduct(rawKey, bySlug)) {
        return {
          ...bySlug,
          image: exactMeta.image || bySlug.image,
        };
      }
      const byExactName = catalogue.find(
        (p) => lowerKeepDiacritics(p.name) === lowerKeepDiacritics(exactMeta.name)
      );
      if (byExactName && isCompatibleProduct(rawKey, byExactName)) {
        return {
          ...byExactName,
          image: exactMeta.image || byExactName.image,
        };
      }
    }

    // 2. Strict core agricultural noun-phrase matching with explicit exclusions
    const CORE_SEARCH_PHRASES: { pattern: RegExp; exclude?: RegExp }[] = [
      { pattern: /nấm\s+đông\s+cô|nấm/i },
      { pattern: /cà\s+rốt/i },
      { pattern: /bông\s+cải\s+xanh|súp\s+lơ/i },
      { pattern: /cải\s+xanh/i, exclude: /bông\s+cải/i },
      { pattern: /cải\s+thìa/i },
      { pattern: /cải\s+ngọt/i, exclude: /bông\s+cải/i },
      { pattern: /ớt\s+chuông/i },
      { pattern: /cà\s+chua/i },
      { pattern: /dưa\s+leo|dưa\s+chuột/i },
      { pattern: /cá\s+hồi/i },
      { pattern: /thịt\s+bò|thăn\s+bò|bắp\s+bò/i },
      { pattern: /thịt\s+gà|gà\s+ta|ức\s+gà/i },
      { pattern: /thịt\s+heo|ba\s+rọi|thịt\s+lợn/i },
      { pattern: /tôm\s+sú|tôm/i },
      { pattern: /sữa\s+chua\s+men\s+sống/i },
      { pattern: /sữa\s+chua\s+hy\s+lạp|sữa\s+chua/i },
      { pattern: /dâu\s+tây/i },
      { pattern: /xoài/i },
      { pattern: /sả\s+tươi|củ\s+sả|(?:^|\s)sả(?:\s|$)/i, exclude: /đặc\s*sản|nông\s*sản|thủy\s*sản|hải\s*sản|cá\s*thu|cá\s*hồi|thịt/i },
      { pattern: /bơ\s+sáp|quả\s+bơ/i, exclude: /thịt\s+bò|thăn\s+bò/i },
      { pattern: /bí\s+đỏ/i },
      { pattern: /cam\s+sành/i },
    ];

    for (const rule of CORE_SEARCH_PHRASES) {
      if (rule.pattern.test(rawKey)) {
        const found = catalogue.find((p) => {
          const pName = p.name || '';
          if (rule.exclude && rule.exclude.test(pName)) return false;
          return rule.pattern.test(pName);
        });
        if (found && isCompatibleProduct(rawKey, found)) {
          return {
            ...found,
            image: exactMeta?.image || found.image,
          };
        }
        // If this core ingredient is recognized but not present in catalogue, STOP here immediately!
        // Never fall through to loose single-word / stopword matching!
        break;
      }
    }
  }

  // 3. Fallback to the exact ingredient meta so the photo, price & weight are 100% accurate
  if (exactMeta) {
    return {
      _id: exactMeta.slug,
      name: exactMeta.name,
      slug: exactMeta.slug,
      price: formatPrice(exactMeta.priceNumber),
      priceNumber: exactMeta.priceNumber,
      image: exactMeta.image,
      categoryId: exactMeta.categoryVi,
      categoryVi: exactMeta.categoryVi,
      weight: exactMeta.weight,
    } as ApiProduct;
  }

  return null;
}

@Component({
  selector: 'app-nutrition',
  standalone: true,
  imports: [ShellComponent, RouterLink, CommonModule, FormsModule],
  templateUrl: './nutrition.component.html',
  styleUrl: './nutrition.component.css',
})
export class NutritionComponent implements OnInit {
  protected cart = inject(CartService);
  private productApi = inject(ProductApiService);
  private api = inject(ApiService);
  private voucher = inject(VoucherService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly GOAL_ICONS = GOAL_ICONS;
  protected formatPrice = formatPrice;

  heroConfig = signal<NutritionHeroConfig>({
    kicker: '🥗 Trợ Lý Thực Đơn Khoa Học · Dữ Liệu Trực Tuyến',
    title: 'Dinh dưỡng thông minh & Thực đơn chuẩn vị',
    subtitle:
      'Khám phá các gói thực đơn dinh dưỡng tiết kiệm, xem chi tiết công thức chế biến từng bước, bảng thành phần vi chất và thêm trọn bộ nguyên liệu tươi sạch vào giỏ hàng chỉ với một chạm.',
    bannerImage: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=520&fit=crop',
  });

  // Dynamic data loaded from MongoDB via /api/nutrition and /api/products
  private goalsSignal = signal<GoalItem[]>([]);
  private recipesDbSignal = signal<RecipeDbItem[]>([]);
  private mealPlansSignal = signal<MealPlanDeal[]>([]);
  catalogue = signal<ApiProduct[]>([]);

  get GOALS(): GoalItem[] {
    return this.goalsSignal();
  }

  selectedGoals = signal<string[]>([]);
  goalTargets = signal<Record<string, number>>({});
  servings = signal<number>(2);
  mealsCount = signal<number>(1);
  budgetLimit = signal<number | null>(null);
  excludeIngredients = signal<string>('');
  searchQuery = signal<string>('');
  sortBy = signal<'relevant' | 'cheapest' | 'most_expensive' | 'recent'>('relevant');
  categoryTab = signal<'all' | 'yogurt' | 'protein' | 'fiber' | 'vitamin' | 'balance'>('all');
  activePlanId = signal<string | null>(null);

  // Recent meals & purchased ingredients tracking (synced with MongoDB orders + Cart + localStorage)
  recentMealsMap = signal<Record<string, { timestamp: number; label: string }>>({});
  recentOrderedItemNames = signal<string[]>([]);

  readonly quickSearchTags = [
    { label: '🍶 Sữa chua', query: 'sữa chua' },
    { label: '🐟 Cá hồi', query: 'cá hồi' },
    { label: '🥑 Quả bơ', query: 'bơ' },
    { label: '🍗 Thịt gà', query: 'gà' },
    { label: '🍓 Dâu tây', query: 'dâu tây' },
    { label: '🥩 Thịt bò', query: 'thịt bò' },
    { label: '🍄 Nấm đông cô', query: 'nấm' },
  ];

  // ===== DAILY & WEEKLY MEAL PLANNER STATE =====
  readonly WEEK_DAYS = [
    { key: 'mon', label: 'Thứ 2', short: 'T2' },
    { key: 'tue', label: 'Thứ 3', short: 'T3' },
    { key: 'wed', label: 'Thứ 4', short: 'T4' },
    { key: 'thu', label: 'Thứ 5', short: 'T5' },
    { key: 'fri', label: 'Thứ 6', short: 'T6' },
    { key: 'sat', label: 'Thứ 7', short: 'T7' },
    { key: 'sun', label: 'Chủ Nhật', short: 'CN' },
  ];

  readonly MEAL_SLOTS_META: { key: MealSlotKey; label: string; time: string; icon: string }[] = [
    { key: 'breakfast', label: 'Bữa Sáng Năng Lượng', time: '07:00 – 08:30', icon: '☀️' },
    { key: 'lunch', label: 'Bữa Trưa Đủ Chất', time: '11:30 – 13:00', icon: '🍲' },
    { key: 'snack', label: 'Bữa Phụ & Sữa Chua', time: '15:30 – 16:30', icon: '🥣' },
    { key: 'dinner', label: 'Bữa Tối Thanh Đạm', time: '18:30 – 20:00', icon: '🥗' },
  ];

  plannerMode = signal<'day' | 'week'>('day');
  selectedWeekDay = signal<string>('mon');
  weeklyOverviewMode = signal<boolean>(false);
  plannerPreset = signal<'eatclean' | 'protein' | 'family' | 'yogurt_detox'>('protein');
  currentStep = signal<1 | 2 | 3>(1);
  mealsPerDay = signal<2 | 3 | 4>(3);
  targetDailyKcal = signal<number>(1650);
  targetProtein = signal<number>(125);
  targetFiber = signal<number>(28);
  targetCarbs = signal<number>(130);
  smartPlanConfigured = signal<boolean>(true);
  priorityNutrients = signal<string[]>(['protein', 'fiber', 'probiotic']);
  showAdvancedConfig = signal<boolean>(false);
  expandedIngredientIds = signal<Record<string, boolean>>({});
  showDayPlanBreakdown = signal<boolean>(false);
  plannerOwnedIngredientIds = signal<Record<string, boolean>>({});
  private planRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  private macroInputTimer: ReturnType<typeof setTimeout> | undefined;

  readonly NUTRIENT_BOOST_OPTIONS = [
    { id: 'protein', label: '🥩 Tăng Đạm (Protein Xây Cơ)', desc: 'Thịt bò, ức gà, cá hồi, tôm sú' },
    { id: 'fiber', label: '🥦 Giàu Chất Xơ (No Lâu)', desc: 'Bông cải xanh, cải ngọt, bí đỏ' },
    { id: 'probiotic', label: '🍶 Lợi Khuẩn Sữa Chua', desc: 'Sữa chua Hy Lạp, men sống tiêu hóa' },
    { id: 'omega3', label: '🐟 Omega-3 & Tim Mạch', desc: 'Cá hồi Na Uy, quả bơ sáp' },
    { id: 'vitamin', label: '🍊 Vitamin Đẹp Da & Đề Kháng', desc: 'Dâu tây, cam sành, ớt chuông' },
    { id: 'lowcarb', label: '🥑 Low-Carb (Giảm Tinh Bột)', desc: 'Ưu tiên rau xanh & đạm nạc' },
  ];

  readonly DAY_THEMES: Record<'eatclean' | 'protein' | 'family' | 'yogurt_detox', string> = {
    protein: 'Thực đơn Tập Gym Tăng Cơ: Giàu Đạm Tinh Khiết, Phục Hồi Năng Lượng & Săn Chắc Cơ Bắp',
    eatclean: 'Thực đơn Eat Clean Giảm Mỡ: Thâm Hụt Calo Thông Minh, Giàu Chất Xơ Tự Nhiên & Ít Tinh Bột',
    family: 'Thực đơn Cơm Nhà Đủ Chất: Cân Bằng 4 Nhóm Dinh Dưỡng, Thơm Ngon Hợp Khẩu Vị Cả Nhà',
    yogurt_detox: 'Thực đơn Thanh Lọc & Tiêu Hóa Khỏe: Bổ Sung Probiotics Từ Sữa Chua Hy Lạp & Trái Cây Tươi',
  };

  readonly WEEK_DAY_THEMES: Record<'eatclean' | 'protein' | 'family' | 'yogurt_detox', Record<string, string>> = {
    protein: {
      mon: 'Thứ 2: Nạp Đạm Tinh Khiết & Khởi Động Cơ Bắp',
      tue: 'Thứ 3: Tăng Sức Bền Với Bò Mỹ & Bông Cải Xanh',
      wed: 'Thứ 4: Phục Hồi Cơ Chuyên Sâu Cùng Omega-3 Cá Hồi',
      thu: 'Thứ 5: Siết Cơ Nạc Với Ức Gà & Sữa Chua Hy Lạp',
      fri: 'Thứ 6: Bổ Sung Kẽm & Đạm Hải Sản Tôm Sú Cà Mau',
      sat: 'Thứ 7: Năng Lượng Đỉnh Cao Cho Buổi Tập Cuối Tuần',
      sun: 'Chủ Nhật: Giãn Cơ, Bù Khoáng & Tiêu Hóa Nhẹ Nhàng',
    },
    eatclean: {
      mon: 'Thứ 2: Thanh Lọc Đầu Tuần & Thâm Hụt Calo Tự Nhiên',
      tue: 'Thứ 3: Đốt Mỡ Thừa Với Chất Béo Tốt (Bơ Sáp & Cá Hồi)',
      wed: 'Thứ 4: Nhẹ Bụng Đẹp Da Cùng Salad Ức Gà Sốt Sữa Chua',
      thu: 'Thứ 5: Cân Bằng Đường Huyết & Giàu Chất Xơ Hoà Tan',
      fri: 'Thứ 6: Detox Vitamin C & Chống Oxy Hóa Tươi Mát',
      sat: 'Thứ 7: Eat Clean Cuối Tuần Ngon Miệng Không Lo Tăng Cân',
      sun: 'Chủ Nhật: Nghỉ Ngơi, Bổ Sung Lợi Khuẩn & Làm Sạch Ruột',
    },
    family: {
      mon: 'Thứ 2: Cơm Nhà Đủ Chất Khởi Đầu Tuần Mới',
      tue: 'Thứ 3: Đổi Vị Cuốn Rau Thảo Mộc & Canh Ngọt Thanh',
      wed: 'Thứ 4: Bổ Sung Canxi & Sắt Cho Cả Gia Đình',
      thu: 'Thứ 5: Bữa Cơm Ấm Cúng Giàu Omega-3 & Vitamin A',
      fri: 'Thứ 6: Thực Đơn Thanh Mát, Dễ Tiêu Hóa Cho Người Lớn & Trẻ Nhỏ',
      sat: 'Thứ 7: Tiệc Cuối Tuần Tươi Ngon Với Hải Sản & Rau Hữu Cơ',
      sun: 'Chủ Nhật: Cân Bằng Dinh Dưỡng & Bữa Phụ Sữa Chua Trái Cây',
    },
    yogurt_detox: {
      mon: 'Thứ 2: Đánh Thức Hệ Vi Sinh Đường Ruột Với Sữa Chua Hy Lạp',
      tue: 'Thứ 3: Thanh Lọc Cơ Thể & Bổ Sung Enzyme Tự Nhiên',
      wed: 'Thứ 4: Tăng Cường Miễn Dịch Với Probiotics & Vitamin C',
      thu: 'Thứ 5: Thực Đơn Nhẹ Bụng, Giảm Đầy Hơi & Tốt Cho Dạ Dày',
      fri: 'Thứ 6: Trẻ Hóa Làn Da Với Dâu Tây, Xoài Cát & Sữa Chua Men Sống',
      sat: 'Thứ 7: Phục Hồi Năng Lượng Xanh Từ Đạm Thực Vật & Nấm',
      sun: 'Chủ Nhật: Thư Giãn Toàn Diện & Cân Bằng Hệ Tiêu Hóa',
    },
  };

  // Dedicated single-day schedule (independent of weekly schedule)
  singleDaySchedule = signal<DayMealPlanMap>({
    breakfast: 'sua-chua-hy-lap-trai-cay',
    lunch: 'bo-ap-chao-bong-cai',
    snack: 'sinh-to-dau-xoai',
    dinner: 'ca-hoi-ap-chao',
  });

  weeklySchedule = signal<Record<string, DayMealPlanMap>>({
    mon: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'ca-hoi-ap-chao', snack: 'sinh-to-dau-xoai', dinner: 'salad-ga-nuong' },
    tue: { breakfast: 'sinh-to-dau-xoai', lunch: 'bo-ap-chao-bong-cai', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'canh-cai-xanh-thit-bo' },
    wed: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'tom-su-hap-cai-ngot', snack: 'detox-cam-tao-ca-rot', dinner: 'salad-uc-ga-sot-sua-chua' },
    thu: { breakfast: 'detox-cam-tao-ca-rot', lunch: 'ca-rot-xao-thit-ga', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'salad-bo-ca-hoi' },
    fri: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'heo-thao-moc-cuon-rau', snack: 'sinh-to-dau-xoai', dinner: 'sup-bi-do-hat-sen' },
    sat: { breakfast: 'sinh-to-dau-xoai', lunch: 'ca-hoi-ap-chao', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'dau-hu-sot-nam-chay' },
    sun: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'bo-ap-chao-bong-cai', snack: 'detox-cam-tao-ca-rot', dinner: 'tom-su-hap-cai-ngot' },
  });

  // Dedicated detail view state (for viewing a dish or a meal plan on its own detail screen)
  selectedRecipeId = signal<string | null>(null);
  selectedPlanDetailId = signal<string | null>(null);
  activeGalleryImage = signal<string>('');

  loading = signal<boolean>(false);
  results = signal<RecipeResult[]>([]);
  addedToCart = signal<string | null>(null);
  lastAddedRecipe = signal<RecipeResult | null>(null);
  hasSearched = signal<boolean>(false);

  // Dynamic Macro Caloric Distribution Ratio (WHO / National Nutrition Institute standards)
  readonly macroPercentages = computed(() => {
    const pGrams = Math.max(0, this.targetProtein());
    const cGrams = Math.max(0, this.targetCarbs());
    const kcal = Math.max(1, this.targetDailyKcal());
    const pKcal = pGrams * 4;
    const cKcal = cGrams * 4;
    const fKcal = Math.max(0, kcal - pKcal - cKcal);
    const totalMacroKcal = pKcal + cKcal + fKcal;
    const pPct = Math.round((pKcal / totalMacroKcal) * 100);
    const cPct = Math.round((cKcal / totalMacroKcal) * 100);
    const fPct = Math.max(0, 100 - pPct - cPct);
    return {
      pPct,
      cPct,
      fPct,
      fGrams: Math.round(fKcal / 9),
      overTarget: pKcal + cKcal > kcal,
    };
  });

  setTargetDailyKcal(value: number | string): void {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      this.targetDailyKcal.set(Math.max(1000, Math.min(2800, Math.round(parsed / 50) * 50)));
      this.schedulePlanRefresh();
    }
  }

  setMacroTarget(kind: 'protein' | 'fiber' | 'carbs', value: number | string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const limits = kind === 'protein' ? [20, 240] : kind === 'fiber' ? [10, 60] : [40, 300];
    const clamped = Math.max(limits[0], Math.min(limits[1], Math.round(parsed)));
    if (kind === 'protein') this.targetProtein.set(clamped);
    else if (kind === 'fiber') this.targetFiber.set(clamped);
    else this.targetCarbs.set(clamped);
    this.schedulePlanRefresh();
  }

  queueMacroTarget(kind: 'protein' | 'fiber' | 'carbs', value: string): void {
    if (this.macroInputTimer) clearTimeout(this.macroInputTimer);
    if (!value.trim()) return;
    this.macroInputTimer = setTimeout(() => this.setMacroTarget(kind, value), 450);
  }

  commitMacroTarget(kind: 'protein' | 'fiber' | 'carbs', value: string): void {
    if (this.macroInputTimer) clearTimeout(this.macroInputTimer);
    if (!value.trim()) return;
    this.setMacroTarget(kind, value);
  }

  private schedulePlanRefresh(): void {
    if (!this.smartPlanConfigured()) return;
    if (this.planRefreshTimer) clearTimeout(this.planRefreshTimer);
    this.planRefreshTimer = setTimeout(() => this.generateSmartPlan(), 220);
  }

  getCalorieStatusText(total: number, target: number): string {
    const diff = total - target;
    if (Math.abs(diff) <= 80) return '✓ Đạt chuẩn';
    if (diff > 80) return `Vượt ${diff} kcal`;
    return `Thiếu ${Math.abs(diff)} kcal`;
  }

  getProteinStatusText(total: number, target: number): string {
    if (total > target) return `Vượt ${total - target}g`;
    if (total === target) return '✓ Đạt';
    return `Thiếu ${target - total}g`;
  }

  getNutrientStatusText(actual: number, target: number): string {
    if (actual > target) return `Vượt ${actual - target}g`;
    if (actual === target) return '✓ Đạt';
    return `Thiếu ${target - actual}g`;
  }

  readonly selectedDetailRecipe = computed<RecipeResult | null>(() => {
    const id = this.selectedRecipeId();
    if (!id) return null;
    return this.results().find(r => r.id === id) || null;
  });

  readonly relatedRecipes = computed<RecipeResult[]>(() => {
    const current = this.selectedDetailRecipe();
    if (!current) return [];
    return this.results().filter(r => r.id !== current.id).slice(0, 3);
  });

  readonly mealPlanCards = computed<MealPlanCardView[]>(() => {
    const plans = this.mealPlansSignal();
    const allResults = this.results();
    const recipes = this.recipesDbSignal();
    const cat = this.catalogue();

    return plans.map((plan, idx) => {
      const planRecipes = plan.recipeIds
        .map(id => allResults.find(r => r.id === id))
        .filter((r): r is RecipeResult => !!r);

      const dbRecipes = plan.recipeIds
        .map(id => recipes.find(r => r.id === id))
        .filter((r): r is RecipeDbItem => !!r);

      const prodMap = new Map<string, ApiProduct>();
      for (const r of dbRecipes) {
        for (const ing of r.ingredients) {
          const p = matchCatalogueProduct(ing.name, cat, ing.product);
          if (p) prodMap.set(p._id || p.slug, p);
        }
      }
      const matchedProducts = Array.from(prodMap.values());
      const originalTotal = matchedProducts.reduce((s, p) => s + (p.priceNumber || 0), 0);
      const dealTotal = Math.round((originalTotal * (100 - plan.discountPercent)) / 100 / 1000) * 1000;
      const saved = Math.max(0, originalTotal - dealTotal);

      const defaultImages = [
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=700&q=80',
        'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=700&q=80',
        'https://images.unsplash.com/photo-1547592180-85f173990554?w=700&q=80',
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=700&q=80',
      ];

      return {
        ...plan,
        image: plan.image || dbRecipes[0]?.image || defaultImages[idx % defaultImages.length],
        recipes: planRecipes,
        recipeNames: dbRecipes.map(r => r.name),
        matchedProducts,
        originalTotal,
        originalTotalText: formatPrice(originalTotal),
        dealTotal,
        dealTotalText: formatPrice(dealTotal),
        savedText: formatPrice(saved),
      };
    });
  });

  readonly selectedDetailPlan = computed<MealPlanCardView | null>(() => {
    const id = this.selectedPlanDetailId();
    if (!id) return null;
    return this.mealPlanCards().find(p => p.id === id) || null;
  });

  readonly filteredResults = computed<RecipeResult[]>(() => {
    const tab = this.categoryTab();
    const query = normalizeStr(this.searchQuery());
    const sortMode = this.sortBy();
    let list = [...this.results()];

    // 1. Category tab filter
    if (tab === 'yogurt') {
      list = list.filter((r) => {
        const text = normalizeStr(`${r.name} ${r.description} ${r.ingredients.map((i) => i.name).join(' ')}`);
        return text.includes('sua chua') || text.includes('yogurt');
      });
    } else if (tab !== 'all') {
      list = list.filter((r) => r.goalsTags.includes(tab));
    }

    // 2. Search query filter (matches dish name, ingredient names, description, nutritionNote, macros)
    if (query) {
      const keywords = query.split(/\s+/).filter((w) => w.length > 0);
      list = list.filter((r) => {
        const searchable = normalizeStr(
          `${r.name} ${r.description} ${r.nutritionNote} ${r.macros.vitamins} ${r.ingredients.map((i) => `${i.name} ${i.product?.name || ''}`).join(' ')}`
        );
        return keywords.every((kw) => searchable.includes(kw)) || searchable.includes(query);
      });
    }

    // 3. Recent filter mode: if 'recent' is selected, filter to recent meals (or sort recent to top if all)
    if (sortMode === 'recent') {
      const recentList = list.filter((r) => this.getRecentScore(r) > 0);
      if (recentList.length > 0) {
        list = recentList;
      }
      list.sort((a, b) => this.getRecentScore(b) - this.getRecentScore(a));
      return list;
    }

    // 4. Sort modes: 'relevant' | 'cheapest' | 'most_expensive'
    if (sortMode === 'cheapest') {
      list.sort((a, b) => this.dealCost(a) - this.dealCost(b));
    } else if (sortMode === 'most_expensive') {
      list.sort((a, b) => this.dealCost(b) - this.dealCost(a));
    } else {
      // 'relevant': combine search keyword match score + nutrition goal matchScore
      list.sort((a, b) => this.getRelevanceScore(b, query) - this.getRelevanceScore(a, query));
    }

    return list;
  });

  readonly recentMealsCount = computed<number>(() => {
    return this.results().filter((r) => this.getRecentScore(r) > 0).length;
  });

  private parseMacroNum(val?: string): number {
    if (!val) return 0;
    const m = String(val).match(/[\d.]+/);
    return m ? Number(m[0]) || 0 : 0;
  }

  private getActiveSlotMetas(): { key: MealSlotKey; label: string; time: string; icon: string }[] {
    const count = this.mealsPerDay();
    if (count === 2) {
      // 2 bữa/ngày (Nhịn ăn gián đoạn 16:8 / Ăn gọn): Bữa Trưa + Bữa Tối
      return this.MEAL_SLOTS_META.filter((m) => m.key === 'lunch' || m.key === 'dinner');
    }
    if (count === 3) {
      // 3 bữa/ngày tiêu chuẩn: Bữa Sáng + Bữa Trưa + Bữa Tối
      return this.MEAL_SLOTS_META.filter((m) => m.key === 'breakfast' || m.key === 'lunch' || m.key === 'dinner');
    }
    // 4 bữa/ngày: Bữa Sáng + Bữa Trưa + Bữa Phụ Sữa Chua + Bữa Tối
    return this.MEAL_SLOTS_META;
  }

  private getMealSlotWeights(activeMetas: { key: MealSlotKey }[]): Record<MealSlotKey, number> {
    const count = activeMetas.length;
    if (count === 2) {
      return { breakfast: 0, lunch: 0.5, dinner: 0.5, snack: 0 };
    }
    if (count === 3) {
      return { breakfast: 0.3, lunch: 0.4, dinner: 0.3, snack: 0 };
    }
    return { breakfast: 0.25, lunch: 0.35, snack: 0.15, dinner: 0.25 };
  }

  private buildDayPlanView(dayKey: string, dayLabel: string): DayPlanComputedView {
    const isSingle = dayKey === 'day';
    const sched = isSingle ? this.singleDaySchedule() : (this.weeklySchedule()[dayKey] || this.weeklySchedule()['mon']);
    const all = this.results();
    const activeMetas = this.getActiveSlotMetas();
    const weights = this.getMealSlotWeights(activeMetas);
    const targetKcal = Math.max(1000, this.targetDailyKcal());
    const count = activeMetas.length;

    const slots: MealSlotView[] = activeMetas.map((meta) => {
      const rec = all.find((r) => r.id === sched[meta.key]) || all[0] || null;
      if (!rec) {
        return {
          slotKey: meta.key,
          slotLabel: meta.label,
          slotTime: meta.time,
          slotIcon: meta.icon,
          recipe: null,
        };
      }
      const mealWeight = weights[meta.key] || (1 / Math.max(1, count));
      const slotTargetKcal = targetKcal * mealWeight;
      const baseKcal = Math.max(1, rec.calories || 420);
      const portionMultiplier = Math.round((slotTargetKcal / baseKcal) * 10) / 10;
      const scaledCalories = Math.round(baseKcal * portionMultiplier);
      const scaledProtein = Math.round(this.parseMacroNum(rec.macros.protein) * portionMultiplier);
      const scaledCarbs = Math.round(this.parseMacroNum(rec.macros.carbs) * portionMultiplier);
      const scaledFat = Math.round(this.parseMacroNum(rec.macros.fat) * portionMultiplier);
      const scaledFiber = Math.round(this.parseMacroNum(rec.macros.fiber) * portionMultiplier);

      return {
        slotKey: meta.key,
        slotLabel: meta.label,
        slotTime: meta.time,
        slotIcon: meta.icon,
        recipe: rec,
        portionMultiplier,
        scaledCalories,
        scaledProtein,
        scaledCarbs,
        scaledFat,
        scaledFiber,
      };
    });

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;

    interface ProductUsageAgg {
      product: ApiProduct;
      totalPortion: number;
      usedSlots: { slotLabel: string; portion: number }[];
      totalGrams: number;
    }
    const prodUsageMap = new Map<string, ProductUsageAgg>();

    for (const s of slots) {
      if (s.recipe) {
        totalCalories += s.scaledCalories || s.recipe.calories || 0;
        totalProtein += s.scaledProtein || this.parseMacroNum(s.recipe.macros.protein);
        totalCarbs += s.scaledCarbs || this.parseMacroNum(s.recipe.macros.carbs);
        totalFat += s.scaledFat || this.parseMacroNum(s.recipe.macros.fat);
        totalFiber += s.scaledFiber || this.parseMacroNum(s.recipe.macros.fiber);

        const slotPortion = s.portionMultiplier || 1.0;
        const currentServings = Math.max(1, this.servings());

        for (const ing of s.recipe.ingredients) {
          if (ing.product) {
            const pKey = ing.product._id || ing.product.slug;
            const existing = prodUsageMap.get(pKey);

            let fallbackGrams = 100;
            const pName = (ing.product.name || ing.name).toLowerCase();
            if (/thịt|bò|gà|cá|tôm|heo|fillet/i.test(pName)) {
              fallbackGrams = 150;
            } else if (/cải|rau|xà lách|nấm|cà chua|cà rốt|ớt chuông|dưa leo|bí đỏ/i.test(pName)) {
              fallbackGrams = 100;
            } else if (/sả|tỏi|hành|gừng|ớt/i.test(pName)) {
              fallbackGrams = 25;
            } else if (/sữa chua|bơ|dâu|xoài|trái cây/i.test(pName)) {
              fallbackGrams = 120;
            }

            // Important: ing.amount in RecipeResult is already scaled by s.recipe.servings.
            // We must divide by s.recipe.servings to get the base single-serving gram weight!
            const rawGrams = parseGramWeight(ing.amount + (ing.unit || ''));
            const recipeServingsCount = Math.max(1, s.recipe.servings || currentServings);
            const baseGramsPerPerson = rawGrams > 0 ? (rawGrams / recipeServingsCount) : fallbackGrams;

            // Total grams needed for this slot = base grams per person * portion multiplier * number of people
            const slotGrams = Math.round(baseGramsPerPerson * slotPortion * currentServings);
            // Portion multiplier reflects the sum of slot portions (e.g. 1.2x + 1.6x + 1.2x = 4.0x)
            const portionMultiple = Math.round(slotPortion * 10) / 10;

            if (existing) {
              existing.totalPortion = Math.round((existing.totalPortion + portionMultiple) * 10) / 10;
              existing.totalGrams += slotGrams;
              existing.usedSlots.push({ slotLabel: s.slotLabel, portion: slotPortion });
            } else {
              prodUsageMap.set(pKey, {
                product: ing.product,
                totalPortion: portionMultiple,
                totalGrams: slotGrams,
                usedSlots: [{ slotLabel: s.slotLabel, portion: slotPortion }],
              });
            }
          }
        }
      }
    }

    const matchedProducts = Array.from(prodUsageMap.values()).map(a => a.product);
    const ownedMap = this.plannerOwnedIngredientIds();
    let originalPrice = 0;
    let alreadyInCartVal = 0;
    let missingOriginalPrice = 0;
    let alreadyInCartCount = 0;
    let missingCount = 0;

    const ingredientBreakdown: PlanIngredientBreakdown[] = Array.from(prodUsageMap.values()).map((agg) => {
      const p = agg.product;
      const pid = p._id || p.slug;
      const isOwned = !!ownedMap[pid];
      const unitPrice = p.priceNumber || 0;

      const packGramSize = parseGramWeight(p.weight) || 350;
      let neededPacks = 1;
      if (isOwned) {
        neededPacks = 0;
      } else if (packGramSize > 0 && agg.totalGrams > 0) {
        neededPacks = Math.max(1, Math.ceil(agg.totalGrams / packGramSize));
      } else {
        neededPacks = Math.max(1, Math.ceil(agg.totalPortion / 2.0));
      }

      const inCartPacks = this.getCartQty(p);
      const effectiveInCart = Math.min(neededPacks, inCartPacks);
      const missingPacks = Math.max(0, neededPacks - effectiveInCart);
      const totalPrice = unitPrice * neededPacks;
      const inCartValue = unitPrice * effectiveInCart;
      const missingOriginal = unitPrice * missingPacks;
      const missingDeal = Math.round((missingOriginal * 0.88) / 1000) * 1000;

      originalPrice += totalPrice;
      alreadyInCartVal += inCartValue;
      missingOriginalPrice += missingOriginal;
      if (effectiveInCart > 0) alreadyInCartCount++;
      if (missingPacks > 0) missingCount++;

      const usedInSlots = agg.usedSlots.map((u) => `${u.slotLabel} (${u.portion}x)`);
      const formulaExplanation = `Dùng cho ${usedInSlots.join(' + ')} · Tổng ${agg.totalPortion}x khẩu phần (${this.servings()} người ăn) → Cần ~${agg.totalGrams}g. Quy cách gói ${p.weight || packGramSize + 'g'} → Cần mua ${neededPacks} ${this.getProductPackUnit(p)}.`;

      return {
        product: p,
        unitPrice,
        neededPacks,
        inCartPacks,
        missingPacks,
        totalPrice,
        inCartValue,
        missingDealPrice: missingDeal,
        owned: isOwned,
        totalPortionMultiplier: agg.totalPortion,
        usedInSlots,
        estimatedGramsNeeded: agg.totalGrams,
        formulaExplanation,
      };
    });

    const dealPrice = Math.round((originalPrice * 0.88) / 1000) * 1000;
    const missingDealPrice = Math.round((missingOriginalPrice * 0.88) / 1000) * 1000;
    const savedPrice = Math.max(0, originalPrice - dealPrice);
    const allInCart = matchedProducts.length > 0 && missingCount === 0;

    const preset = this.plannerPreset();
    const dayTheme = isSingle
      ? (this.DAY_THEMES[preset] || 'Thực đơn cân bằng dinh dưỡng chuẩn khoa học')
      : (this.WEEK_DAY_THEMES[preset]?.[dayKey] || 'Thực đơn cân bằng dinh dưỡng & nông sản tươi sạch thu hoạch trong ngày');

    return {
      dayKey,
      dayLabel,
      dayTheme,
      mealsPerDayCount: activeMetas.length,
      slots,
      totalCalories,
      totalProtein: Math.round(totalProtein),
      totalCarbs: Math.round(totalCarbs),
      totalFat: Math.round(totalFat),
      totalFiber: Math.round(totalFiber),
      originalPrice,
      dealPrice,
      savedPrice,
      matchedProducts,
      alreadyInCartCount,
      alreadyInCartVal,
      missingCount,
      missingOriginalPrice,
      missingDealPrice,
      allInCart,
      ingredientBreakdown,
    };
  }

  readonly activeDayPlan = computed<DayPlanComputedView>(() => {
    if (this.plannerMode() === 'day') {
      const activeMetas = this.getActiveSlotMetas();
      return this.buildDayPlanView('day', `Thực đơn Trong Ngày (${activeMetas.length} bữa)`);
    }

    const dKey = this.selectedWeekDay();
    const dObj = this.WEEK_DAYS.find((d) => d.key === dKey) || this.WEEK_DAYS[0];
    return this.buildDayPlanView(dObj.key, `${dObj.label} (${this.mealsPerDay()} bữa/ngày)`);
  });

  readonly allWeekDaysPlans = computed<DayPlanComputedView[]>(() => {
    return this.WEEK_DAYS.map((d) => this.buildDayPlanView(d.key, d.label));
  });

  readonly weeklyPlanSummary = computed(() => {
    const days = this.allWeekDaysPlans();
    const prodMap = new Map<string, ApiProduct>();
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFiber = 0;
    for (const d of days) {
      totalCalories += d.totalCalories;
      totalProtein += d.totalProtein;
      totalFiber += d.totalFiber;
      for (const p of d.matchedProducts) {
        prodMap.set(p._id || p.slug, p);
      }
    }
    const matchedProducts = Array.from(prodMap.values());
    const ownedMap = this.plannerOwnedIngredientIds();
    let originalPrice = 0;
    let alreadyInCartVal = 0;
    let missingOriginalPrice = 0;
    let alreadyInCartCount = 0;
    let missingCount = 0;

    const ingredientBreakdown: PlanIngredientBreakdown[] = matchedProducts.map((p) => {
      const pid = p._id || p.slug;
      const isOwned = !!ownedMap[pid];
      const unitPrice = p.priceNumber || 0;
      const neededPacks = isOwned ? 0 : 2;
      const inCartPacks = this.getCartQty(p);
      const effectiveInCart = Math.min(neededPacks, inCartPacks);
      const missingPacks = Math.max(0, neededPacks - effectiveInCart);
      const totalPrice = unitPrice * neededPacks;
      const inCartValue = unitPrice * effectiveInCart;
      const missingOriginal = unitPrice * missingPacks;
      const missingDeal = Math.round((missingOriginal * 0.8) / 1000) * 1000;

      originalPrice += totalPrice;
      alreadyInCartVal += inCartValue;
      missingOriginalPrice += missingOriginal;
      if (effectiveInCart > 0) alreadyInCartCount++;
      if (missingPacks > 0) missingCount++;

      return {
        product: p,
        unitPrice,
        neededPacks,
        inCartPacks,
        missingPacks,
        totalPrice,
        inCartValue,
        missingDealPrice: missingDeal,
        owned: isOwned,
        totalPortionMultiplier: 7 * (this.servings() || 1),
        usedInSlots: ['Thực đơn 7 ngày cả tuần'],
        estimatedGramsNeeded: 700,
        formulaExplanation: `Định lượng cho cả tuần 7 ngày (${this.mealsPerDay() * 7} bữa) → Cần ${neededPacks} ${this.getProductPackUnit(p)}.`,
      };
    });

    const dealPrice = Math.round((originalPrice * 0.8) / 1000) * 1000;
    const missingDealPrice = Math.round((missingOriginalPrice * 0.8) / 1000) * 1000;
    const savedPrice = Math.max(0, originalPrice - dealPrice);
    const allInCart = matchedProducts.length > 0 && missingCount === 0;

    return {
      avgCaloriesPerDay: Math.round(totalCalories / 7),
      avgProteinPerDay: Math.round(totalProtein / 7),
      avgFiberPerDay: Math.round(totalFiber / 7),
      totalMeals: 7 * this.mealsPerDay(),
      matchedProducts,
      originalPrice,
      dealPrice,
      savedPrice,
      alreadyInCartCount,
      alreadyInCartVal,
      missingCount,
      missingOriginalPrice,
      missingDealPrice,
      allInCart,
      ingredientBreakdown,
    };
  });

  setMealsPerDay(count: 2 | 3 | 4): void {
    this.mealsPerDay.set(count);
    this.schedulePlanRefresh();
  }

  togglePriorityNutrient(id: string): void {
    const current = this.priorityNutrients();
    if (current.includes(id)) {
      this.priorityNutrients.set(current.filter((item) => item !== id));
    } else {
      this.priorityNutrients.set([...current, id]);
    }
    this.schedulePlanRefresh();
  }

  isPriorityNutrient(id: string): boolean {
    return this.priorityNutrients().includes(id);
  }

  setBudgetQuick(amount: number | null): void {
    this.budgetLimit.set(amount);
    this.schedulePlanRefresh();
  }

  getMacroPercent(actual: number, target: number): number {
    if (!target || target <= 0) return 100;
    return Math.min(100, Math.round((actual / target) * 100));
  }

  setStep(step: 1 | 2 | 3): void {
    this.currentStep.set(step);
  }

  getPresetLabel(preset?: string): string {
    const p = preset || this.plannerPreset();
    if (p === 'protein') return 'Tập Gym & Tăng Cơ';
    if (p === 'eatclean') return 'Giảm Cân Eat Clean';
    if (p === 'family') return 'Cơm Nhà Cân Bằng';
    if (p === 'yogurt_detox') return 'Thanh Lọc Tiêu Hóa';
    return 'Cân Bằng Dinh Dưỡng';
  }

  applyPlannerPreset(preset: 'eatclean' | 'protein' | 'family' | 'yogurt_detox'): void {
    this.plannerPreset.set(preset);
    if (preset === 'protein') {
      this.mealsPerDay.set(4);
      this.targetDailyKcal.set(2000);
      this.targetProtein.set(145);
      this.targetFiber.set(30);
      this.targetCarbs.set(160);
      this.priorityNutrients.set(['protein', 'omega3', 'probiotic']);
      this.singleDaySchedule.set({
        breakfast: 'sua-chua-hy-lap-trai-cay',
        lunch: 'bo-ap-chao-bong-cai',
        snack: 'sinh-to-dau-xoai',
        dinner: 'ca-hoi-ap-chao',
      });
    } else if (preset === 'eatclean') {
      this.mealsPerDay.set(3);
      this.targetDailyKcal.set(1350);
      this.targetProtein.set(95);
      this.targetFiber.set(35);
      this.targetCarbs.set(90);
      this.priorityNutrients.set(['fiber', 'lowcarb', 'vitamin']);
      this.singleDaySchedule.set({
        breakfast: 'sua-chua-hy-lap-trai-cay',
        lunch: 'ca-hoi-ap-chao',
        snack: 'sinh-to-dau-xoai',
        dinner: 'salad-ga-nuong',
      });
    } else if (preset === 'family') {
      this.mealsPerDay.set(3);
      this.targetDailyKcal.set(1750);
      this.targetProtein.set(110);
      this.targetFiber.set(28);
      this.targetCarbs.set(150);
      this.priorityNutrients.set(['protein', 'fiber', 'vitamin']);
      this.singleDaySchedule.set({
        breakfast: 'sua-chua-hy-lap-trai-cay',
        lunch: 'canh-cai-xanh-thit-bo',
        snack: 'sinh-to-dau-xoai',
        dinner: 'ca-rot-xao-thit-ga',
      });
    } else if (preset === 'yogurt_detox') {
      this.mealsPerDay.set(4);
      this.targetDailyKcal.set(1400);
      this.targetProtein.set(85);
      this.targetFiber.set(36);
      this.targetCarbs.set(105);
      this.priorityNutrients.set(['probiotic', 'fiber', 'vitamin']);
      this.singleDaySchedule.set({
        breakfast: 'sua-chua-hy-lap-trai-cay',
        lunch: 'salad-uc-ga-sot-sua-chua',
        snack: 'sinh-to-dau-xoai',
        dinner: 'dau-hu-sot-nam-chay',
      });
    }

    const presets: Record<'eatclean' | 'protein' | 'family' | 'yogurt_detox', Record<string, DayMealPlanMap>> = {
      eatclean: {
        mon: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'ca-hoi-ap-chao', snack: 'sinh-to-dau-xoai', dinner: 'salad-ga-nuong' },
        tue: { breakfast: 'sinh-to-dau-xoai', lunch: 'salad-bo-ca-hoi', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'tom-su-hap-cai-ngot' },
        wed: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'salad-uc-ga-sot-sua-chua', snack: 'detox-cam-tao-ca-rot', dinner: 'dau-hu-sot-nam-chay' },
        thu: { breakfast: 'detox-cam-tao-ca-rot', lunch: 'ca-hoi-ap-chao', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'sup-bi-do-hat-sen' },
        fri: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'salad-ga-nuong', snack: 'sinh-to-dau-xoai', dinner: 'tom-su-hap-cai-ngot' },
        sat: { breakfast: 'sinh-to-dau-xoai', lunch: 'salad-bo-ca-hoi', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'salad-uc-ga-sot-sua-chua' },
        sun: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'ca-hoi-ap-chao', snack: 'detox-cam-tao-ca-rot', dinner: 'sup-bi-do-hat-sen' },
      },
      protein: {
        mon: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'bo-ap-chao-bong-cai', snack: 'sinh-to-dau-xoai', dinner: 'ca-hoi-ap-chao' },
        tue: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'ca-rot-xao-thit-ga', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'tom-su-hap-cai-ngot' },
        wed: { breakfast: 'sinh-to-dau-xoai', lunch: 'ca-hoi-ap-chao', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'salad-uc-ga-sot-sua-chua' },
        thu: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'bo-ap-chao-bong-cai', snack: 'sinh-to-dau-xoai', dinner: 'heo-thao-moc-cuon-rau' },
        fri: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'tom-su-hap-cai-ngot', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'salad-bo-ca-hoi' },
        sat: { breakfast: 'sinh-to-dau-xoai', lunch: 'bo-ap-chao-bong-cai', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'ca-hoi-ap-chao' },
        sun: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'salad-ga-nuong', snack: 'sinh-to-dau-xoai', dinner: 'tom-su-hap-cai-ngot' },
      },
      family: {
        mon: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'canh-cai-xanh-thit-bo', snack: 'sinh-to-dau-xoai', dinner: 'ca-rot-xao-thit-ga' },
        tue: { breakfast: 'sinh-to-dau-xoai', lunch: 'heo-thao-moc-cuon-rau', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'tom-su-hap-cai-ngot' },
        wed: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'bo-ap-chao-bong-cai', snack: 'detox-cam-tao-ca-rot', dinner: 'sup-bi-do-hat-sen' },
        thu: { breakfast: 'sup-bi-do-hat-sen', lunch: 'ca-hoi-ap-chao', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'canh-cai-xanh-thit-bo' },
        fri: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'ca-rot-xao-thit-ga', snack: 'sinh-to-dau-xoai', dinner: 'heo-thao-moc-cuon-rau' },
        sat: { breakfast: 'sinh-to-dau-xoai', lunch: 'tom-su-hap-cai-ngot', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'bo-ap-chao-bong-cai' },
        sun: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'ca-hoi-ap-chao', snack: 'sinh-to-dau-xoai', dinner: 'dau-hu-sot-nam-chay' },
      },
      yogurt_detox: {
        mon: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'salad-uc-ga-sot-sua-chua', snack: 'sinh-to-dau-xoai', dinner: 'dau-hu-sot-nam-chay' },
        tue: { breakfast: 'sinh-to-dau-xoai', lunch: 'salad-bo-ca-hoi', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'sup-bi-do-hat-sen' },
        wed: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'salad-ga-nuong', snack: 'detox-cam-tao-ca-rot', dinner: 'salad-uc-ga-sot-sua-chua' },
        thu: { breakfast: 'detox-cam-tao-ca-rot', lunch: 'dau-hu-sot-nam-chay', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'tom-su-hap-cai-ngot' },
        fri: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'salad-uc-ga-sot-sua-chua', snack: 'sinh-to-dau-xoai', dinner: 'sup-bi-do-hat-sen' },
        sat: { breakfast: 'sinh-to-dau-xoai', lunch: 'salad-bo-ca-hoi', snack: 'sua-chua-hy-lap-trai-cay', dinner: 'dau-hu-sot-nam-chay' },
        sun: { breakfast: 'sua-chua-hy-lap-trai-cay', lunch: 'salad-uc-ga-sot-sua-chua', snack: 'detox-cam-tao-ca-rot', dinner: 'salad-ga-nuong' },
      },
    };
    this.weeklySchedule.set(presets[preset]);
    this.smartPlanConfigured.set(true);
    this.generateSmartPlan();
  }

  generateSmartPlan(): void {
    this.computeRecipes();
    const pool = this.results();
    if (pool.length === 0) return;
    this.smartPlanConfigured.set(true);
    const optimizedPlan = this.optimizeMealPlan(pool);
    this.singleDaySchedule.set(optimizedPlan);

    const newSchedule: Record<string, DayMealPlanMap> = {};
    const usedByEarlierDays: string[] = [];
    this.WEEK_DAYS.forEach((day) => {
      const plan = this.optimizeMealPlan(pool, usedByEarlierDays);
      newSchedule[day.key] = plan;
      usedByEarlierDays.push(...Object.values(plan));
    });
    this.weeklySchedule.set(newSchedule);
    const modeLabel = this.plannerMode() === 'day' ? `Thực đơn Ngày (${this.mealsPerDay()} bữa)` : `Thực đơn Cả Tuần 7 Ngày (${this.mealsPerDay()} bữa/ngày)`;
    this.addedToCart.set(
      `✓ Đã thiết lập ${modeLabel} theo mục tiêu: ${this.targetDailyKcal()} kcal/ngày · Đạm ${this.targetProtein()}g · Chất xơ ${this.targetFiber()}g!`
    );
    setTimeout(() => this.addedToCart.set(null), 3500);
  }

  private optimizeMealPlan(pool: RecipeResult[], previouslyUsed: string[] = []): DayMealPlanMap {
    const slots = this.getActiveSlotMetas();
    const target = {
      calories: Math.max(1, this.targetDailyKcal()),
      protein: Math.max(1, this.targetProtein()),
      fiber: Math.max(1, this.targetFiber()),
      carbs: Math.max(1, this.targetCarbs()),
    };
    const priorities = this.priorityNutrients();
    const lightIds = new Set(['sua-chua-hy-lap-trai-cay', 'sinh-to-dau-xoai', 'detox-cam-tao-ca-rot', 'sup-bi-do-hat-sen']);
    const recipeCandidates = pool.length <= 20
      ? pool
      : [...pool]
          .sort((a, b) => this.recipeTargetDistance(a, target, slots.length) - this.recipeTargetDistance(b, target, slots.length))
          .slice(0, 20);
    let best: RecipeResult[] = [];
    let bestScore = Number.NEGATIVE_INFINITY;

    const evaluatePlan = (recipes: RecipeResult[]): void => {
      const totals = recipes.reduce((sum, recipe) => ({
        calories: sum.calories + (recipe.calories || 0),
        protein: sum.protein + this.parseMacroNum(recipe.macros.protein),
        fiber: sum.fiber + this.parseMacroNum(recipe.macros.fiber),
        carbs: sum.carbs + this.parseMacroNum(recipe.macros.carbs),
      }), { calories: 0, protein: 0, fiber: 0, carbs: 0 });
      const error =
        2 * Math.abs(totals.calories - target.calories) / target.calories +
        (priorities.includes('protein') ? 3 : 2) * Math.abs(totals.protein - target.protein) / target.protein +
        (priorities.includes('fiber') ? 2.5 : 1.5) * Math.abs(totals.fiber - target.fiber) / target.fiber +
        (priorities.includes('lowcarb') ? 1.5 : 1.2) * Math.abs(totals.carbs - target.carbs) / target.carbs;
      const repeats = recipes.length - new Set(recipes.map((recipe) => recipe.id)).size;
      const reusePenalty = recipes.reduce((sum, recipe) => sum + Math.min(0.01, previouslyUsed.filter((id) => id === recipe.id).length * 0.001), 0);
      const priorityBonus = recipes.reduce((sum, recipe, index) => {
        const text = normalizeStr(`${recipe.name} ${recipe.description} ${recipe.ingredients.map((item) => item.name).join(' ')}`);
        const lightSlot = slots[index].key === 'breakfast' || slots[index].key === 'snack';
        const slotBonus = lightSlot ? (lightIds.has(recipe.id) ? 0.002 : 0) : (lightIds.has(recipe.id) ? 0 : 0.001);
        return sum + slotBonus +
          (priorities.includes('probiotic') && (text.includes('sua chua') || text.includes('hy lap')) ? 0.001 : 0) +
          (priorities.includes('omega3') && (text.includes('ca hoi') || text.includes('bo')) ? 0.001 : 0) +
          (priorities.includes('vitamin') && (text.includes('dau tay') || text.includes('cam') || text.includes('ca rot')) ? 0.001 : 0);
      }, 0);
      const score = -error - repeats * 4.0 - reusePenalty + priorityBonus;
      if (score > bestScore) {
        bestScore = score;
        best = [...recipes];
      }
    };

    const search = (index: number, chosen: RecipeResult[]): void => {
      if (index === slots.length) {
        evaluatePlan(chosen);
        return;
      }
      for (const recipe of recipeCandidates) search(index + 1, [...chosen, recipe]);
    };
    search(0, []);

    const plan: DayMealPlanMap = { breakfast: pool[0].id, lunch: pool[0].id, snack: pool[0].id, dinner: pool[0].id };
    slots.forEach((slot, index) => {
      if (best[index]) plan[slot.key] = best[index].id;
    });
    return plan;
  }

  private recipeTargetDistance(recipe: RecipeResult, target: { calories: number; protein: number; fiber: number; carbs: number }, mealCount: number): number {
    const perMeal = Math.max(1, mealCount);
    return 2.2 * Math.abs((recipe.calories || 0) - target.calories / perMeal) / target.calories +
      1.5 * Math.abs(this.parseMacroNum(recipe.macros.protein) - target.protein / perMeal) / target.protein +
      1.3 * Math.abs(this.parseMacroNum(recipe.macros.fiber) - target.fiber / perMeal) / target.fiber +
      Math.abs(this.parseMacroNum(recipe.macros.carbs) - target.carbs / perMeal) / target.carbs;
  }

  swapMealInSlot(slotKey: MealSlotKey, dayKey?: string): void {
    const isDayMode = this.plannerMode() === 'day';
    const all = this.results();
    if (all.length === 0) return;

    const currentSched = isDayMode
      ? this.singleDaySchedule()
      : (this.weeklySchedule()[dayKey || this.selectedWeekDay()] || this.weeklySchedule()['mon']);
    const currentId = currentSched[slotKey];

    // Pick appropriate pool for snack/breakfast vs main meals
    let pool = all;
    if (slotKey === 'snack' || slotKey === 'breakfast') {
      const lightPool = all.filter((r) =>
        ['sua-chua-hy-lap-trai-cay', 'sinh-to-dau-xoai', 'detox-cam-tao-ca-rot', 'sup-bi-do-hat-sen', 'salad-uc-ga-sot-sua-chua'].includes(r.id)
      );
      if (lightPool.length > 1) pool = lightPool;
    }

    const idx = pool.findIndex((r) => r.id === currentId);
    const nextRecipe = pool[(idx + 1) % pool.length];
    if (!nextRecipe) return;

    if (isDayMode) {
      this.singleDaySchedule.update((prev) => ({
        ...prev,
        [slotKey]: nextRecipe.id,
      }));
    } else {
      const targetDay = dayKey || this.selectedWeekDay();
      this.weeklySchedule.update((prev) => ({
        ...prev,
        [targetDay]: {
          ...prev[targetDay],
          [slotKey]: nextRecipe.id,
        },
      }));
    }
  }

  assignRecipeToPlanner(recipe: RecipeResult): void {
    const isLight = ['sua-chua-hy-lap-trai-cay', 'sinh-to-dau-xoai', 'detox-cam-tao-ca-rot'].includes(recipe.id);
    const slotKey: MealSlotKey =
      isLight && this.mealsPerDay() >= 3 ? (this.mealsPerDay() === 4 ? 'snack' : 'breakfast') : 'lunch';

    if (this.plannerMode() === 'day') {
      this.singleDaySchedule.update((prev) => ({
        ...prev,
        [slotKey]: recipe.id,
      }));
      const slotLabel = slotKey === 'snack' ? 'Bữa Phụ Sữa Chua' : slotKey === 'breakfast' ? 'Bữa Sáng' : 'Bữa Trưa';
      this.addedToCart.set(`Đã thêm "${recipe.name}" vào ${slotLabel} trong Thực đơn Ngày!`);
    } else {
      const targetDay = this.selectedWeekDay();
      this.weeklySchedule.update((prev) => ({
        ...prev,
        [targetDay]: {
          ...prev[targetDay],
          [slotKey]: recipe.id,
        },
      }));
      const dayLabel = this.WEEK_DAYS.find((d) => d.key === targetDay)?.label || 'Thứ 2';
      const slotLabel = slotKey === 'snack' ? 'Bữa Phụ Sữa Chua' : slotKey === 'breakfast' ? 'Bữa Sáng' : 'Bữa Trưa';
      this.addedToCart.set(`Đã thêm "${recipe.name}" vào ${slotLabel} (${dayLabel}) trong Kế Hoạch Tuần!`);
    }

    setTimeout(() => this.addedToCart.set(null), 3200);

    if (typeof document !== 'undefined') {
      document.getElementById('meal-planner-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  togglePlannerIngredientOwned(productId: string): void {
    this.plannerOwnedIngredientIds.update((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  }

  toggleDayPlanBreakdown(): void {
    this.showDayPlanBreakdown.update((v) => !v);
  }

  isPlannerIngredientOwned(productId: string): boolean {
    return !!this.plannerOwnedIngredientIds()[productId];
  }

  buyDayPlanIngredients(dayPlan: DayPlanComputedView): void {
    if (dayPlan.matchedProducts.length === 0) return;
    const neededToAdd: { product: ApiProduct; qty: number }[] = [];
    const alreadyInCart: ApiProduct[] = [];

    for (const item of dayPlan.ingredientBreakdown) {
      if (item.owned) continue;
      if (item.missingPacks > 0) {
        neededToAdd.push({ product: item.product, qty: item.missingPacks });
      } else {
        alreadyInCart.push(item.product);
      }
    }

    if (neededToAdd.length === 0) {
      this.addedToCart.set(`Tất cả nguyên liệu cho ${dayPlan.dayLabel} đã có sẵn trong giỏ hàng (hoặc đã có tại nhà)!`);
      setTimeout(() => this.addedToCart.set(null), 3500);
      return;
    }

    for (const { product: p, qty } of neededToAdd) {
      const discounted = Math.round(((p.priceNumber || 0) * 0.88) / 500) * 500;
      this.cart.addItem(toCartProduct(p, discounted), qty);
    }
    // Đảm bảo tất cả nguyên liệu của thực đơn (cả món mới thêm và món đã có từ trước) đều được tick chọn trong giỏ hàng
    this.cart.ensureItemsSelected(dayPlan.matchedProducts.map((p) => p.name || p.slug));
    for (const s of dayPlan.slots) {
      if (s.recipe) this.recordRecentMeal(s.recipe.id, '✓ Đã lên thực đơn & mua gần đây');
    }
    this.voucher.copyCode('NUTRITION10');

    if (alreadyInCart.length > 0) {
      this.addedToCart.set(
        `Đã thêm ${neededToAdd.length} món còn thiếu (${formatPrice(dayPlan.missingDealPrice)}) vào giỏ (${alreadyInCart.length} món đã có sẵn được giữ nguyên) & sao chép mã NUTRITION10!`
      );
    } else {
      this.addedToCart.set(
        `Đã thêm trọn bộ ${dayPlan.matchedProducts.length} nguyên liệu cho ${dayPlan.dayLabel} (${formatPrice(dayPlan.missingDealPrice)}) vào giỏ hàng & sao chép mã NUTRITION10!`
      );
    }
    setTimeout(() => this.addedToCart.set(null), 4000);
  }

  buyFullWeekIngredients(): void {
    const summary = this.weeklyPlanSummary();
    if (summary.matchedProducts.length === 0) return;
    const neededToAdd: { product: ApiProduct; qty: number }[] = [];
    const alreadyInCart: ApiProduct[] = [];

    for (const item of summary.ingredientBreakdown) {
      if (item.owned) continue;
      if (item.missingPacks > 0) {
        neededToAdd.push({ product: item.product, qty: item.missingPacks });
      } else {
        alreadyInCart.push(item.product);
      }
    }

    if (neededToAdd.length === 0) {
      this.addedToCart.set('Toàn bộ nguyên liệu cho thực đơn Cả Tuần 7 Ngày đã có sẵn trong giỏ hàng (hoặc đã có tại nhà)!');
      setTimeout(() => this.addedToCart.set(null), 3500);
      return;
    }

    for (const { product: p, qty } of neededToAdd) {
      const discounted = Math.round(((p.priceNumber || 0) * 0.8) / 500) * 500;
      this.cart.addItem(toCartProduct(p, discounted), qty);
    }
    // Đảm bảo tất cả nguyên liệu cả tuần đều được tick chọn trong giỏ hàng
    this.cart.ensureItemsSelected(summary.matchedProducts.map((p) => p.name || p.slug));
    this.voucher.copyCode('COMBO30');
    if (alreadyInCart.length > 0) {
      this.addedToCart.set(
        `Đã thêm ${neededToAdd.length} món còn thiếu (${formatPrice(summary.missingDealPrice)}) cho Cả Tuần 7 Ngày (${alreadyInCart.length} món đã có trong giỏ được giữ nguyên) & sao chép mã COMBO30!`
      );
    } else {
      this.addedToCart.set(
        `Đã thêm trọn gói Đi Chợ Cả Tuần 7 Ngày (${summary.matchedProducts.length} loại nông sản tươi sạch, ưu đãi -20%) vào giỏ & sao chép mã COMBO30!`
      );
    }
    setTimeout(() => this.addedToCart.set(null), 4500);
  }

  toggleExpandIngredients(recipeId: string): void {
    this.expandedIngredientIds.update((prev) => ({
      ...prev,
      [recipeId]: !prev[recipeId],
    }));
  }

  isIngredientsExpanded(recipeId: string): boolean {
    return !!this.expandedIngredientIds()[recipeId];
  }

  scrollToElement(id: string): void {
    if (typeof document !== 'undefined') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  getRelevanceScore(recipe: RecipeResult, normQuery: string): number {
    let score = recipe.matchScore;
    if (!normQuery) return score;

    const nameNorm = normalizeStr(recipe.name);
    const ingNorm = normalizeStr(recipe.ingredients.map((i) => `${i.name} ${i.product?.name || ''}`).join(' '));
    const descNorm = normalizeStr(`${recipe.description} ${recipe.nutritionNote}`);

    if (nameNorm.includes(normQuery)) score += 120;
    if (ingNorm.includes(normQuery)) score += 90;
    if (descNorm.includes(normQuery)) score += 40;

    const words = normQuery.split(/\s+/).filter((w) => w.length >= 2);
    for (const w of words) {
      if (nameNorm.includes(w)) score += 35;
      if (ingNorm.includes(w)) score += 25;
      if (descNorm.includes(w)) score += 10;
    }
    return score;
  }

  getRecentScore(recipe: RecipeResult): number {
    const map = this.recentMealsMap();
    if (map[recipe.id]) {
      return map[recipe.id].timestamp;
    }
    // Check if any ingredient matches items in current Cart or MongoDB recent orders
    const cartItems = this.cart.items();
    for (const ing of recipe.ingredients) {
      const ingNorm = normalizeStr(ing.name);
      const prodId = ing.product?._id || ing.product?.slug || '';
      const inCart = cartItems.some(
        (ci) =>
          ci.product.id === prodId ||
          normalizeStr(ci.product.name).includes(ingNorm) ||
          ingNorm.includes(normalizeStr(ci.product.name))
      );
      if (inCart) return Date.now() - 60_000;
    }

    const orderedNames = this.recentOrderedItemNames();
    let matchedOrderCount = 0;
    for (const ing of recipe.ingredients) {
      const ingNorm = normalizeStr(ing.name);
      const prodNorm = normalizeStr(ing.product?.name || '');
      const hit = orderedNames.some((on) => {
        const oNorm = normalizeStr(on);
        return (
          (oNorm && ingNorm && (oNorm.includes(ingNorm) || ingNorm.includes(oNorm))) ||
          (oNorm && prodNorm && (oNorm.includes(prodNorm) || prodNorm.includes(oNorm)))
        );
      });
      if (hit) matchedOrderCount++;
    }
    if (matchedOrderCount > 0) {
      return 1_700_000_000_000 + matchedOrderCount * 1000;
    }
    return 0;
  }

  isRecentMeal(recipe: RecipeResult): boolean {
    return this.getRecentScore(recipe) > 0;
  }

  getRecentBadgeText(recipe: RecipeResult): string {
    const map = this.recentMealsMap();
    if (map[recipe.id]?.label) {
      return map[recipe.id].label;
    }
    const cartItems = this.cart.items();
    const inCart = recipe.ingredients.some((ing) => {
      const prodId = ing.product?._id || ing.product?.slug || '';
      return cartItems.some((ci) => ci.product.id === prodId);
    });
    if (inCart) return '🛒 Đang có nguyên liệu trong giỏ';
    if (this.getRecentScore(recipe) > 0) return '🛍️ Đã mua nguyên liệu gần đây';
    return '';
  }

  applyQuickSearch(query: string): void {
    if (this.searchQuery() === query) {
      this.searchQuery.set('');
    } else {
      this.searchQuery.set(query);
      this.sortBy.set('relevant');
    }
  }

  private loadRecentMealsHistory(serverRecentItems?: { name: string; orderedAt?: string }[]): void {
    const defaultRecent: Record<string, { timestamp: number; label: string }> = {
      'sua-chua-hy-lap-trai-cay': {
        timestamp: Date.now() - 3600 * 1000 * 5,
        label: '🥣 Đã ăn / Mua gần đây',
      },
      'ca-hoi-ap-chao': {
        timestamp: Date.now() - 3600 * 1000 * 18,
        label: '🐟 Đã mua nguyên liệu tuần này',
      },
      'salad-ga-nuong': {
        timestamp: Date.now() - 3600 * 1000 * 36,
        label: '🥗 Đã mua nguyên liệu gần đây',
      },
    };

    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('xanhla_recent_meals_v1') : null;
      const parsed = raw ? JSON.parse(raw) : {};
      this.recentMealsMap.set({ ...defaultRecent, ...parsed });
    } catch {
      this.recentMealsMap.set(defaultRecent);
    }

    const names: string[] = [];
    if (Array.isArray(serverRecentItems)) {
      for (const it of serverRecentItems) {
        if (it?.name) names.push(it.name);
      }
    }
    this.recentOrderedItemNames.set(names);

    // If user is logged in, also fetch their personal orders from /api/orders/my
    if (this.cart.currentUser()) {
      this.api
        .get<{ success: boolean; data: any[] }>('/orders/my?limit=10')
        .pipe(catchError(() => of({ success: false, data: [] })))
        .subscribe((res) => {
          if (res?.data && Array.isArray(res.data)) {
            const myNames = [...this.recentOrderedItemNames()];
            for (const ord of res.data) {
              for (const item of ord.items || []) {
                if (item?.name) myNames.unshift(item.name);
              }
            }
            this.recentOrderedItemNames.set(Array.from(new Set(myNames)));
          }
        });
    }
  }

  private recordRecentMeal(recipeId: string, label = '✓ Vừa chọn / Đã mua gần đây'): void {
    const updated = {
      ...this.recentMealsMap(),
      [recipeId]: {
        timestamp: Date.now(),
        label,
      },
    };
    this.recentMealsMap.set(updated);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('xanhla_recent_meals_v1', JSON.stringify(updated));
      }
    } catch {}
  }

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      nutrition: this.api
        .get<{
          success: boolean;
          data: {
            hero?: NutritionHeroConfig;
            goals: GoalItem[];
            mealPlans?: MealPlanDeal[];
            recipes: RecipeDbItem[];
            recentOrderedItems?: { name: string; orderedAt?: string }[];
          };
        }>('/nutrition')
        .pipe(
          catchError(() =>
            of({
              success: false,
              data: {
                hero: undefined as NutritionHeroConfig | undefined,
                goals: [] as GoalItem[],
                mealPlans: [] as MealPlanDeal[],
                recipes: [] as RecipeDbItem[],
                recentOrderedItems: [] as { name: string; orderedAt?: string }[],
              },
            })
          )
        ),
      products: this.productApi
        .getAll({ limit: 0 })
        .pipe(catchError(() => of({ success: false, total: 0, page: 1, pages: 1, data: [] as ApiProduct[] }))),
    }).subscribe(({ nutrition, products }) => {
      if (nutrition?.data) {
        if (nutrition.data.hero) this.heroConfig.set(nutrition.data.hero);
        this.goalsSignal.set(nutrition.data.goals || []);
        this.mealPlansSignal.set(nutrition.data.mealPlans || []);
        this.recipesDbSignal.set(nutrition.data.recipes || []);
        this.loadRecentMealsHistory(nutrition.data.recentOrderedItems);
      } else {
        this.loadRecentMealsHistory();
      }
      if (products?.data) {
        this.catalogue.set(products.data);
      }
      this.computeRecipes();
      this.loading.set(false);

      // Watch query params (?recipe=... or ?plan=...) so clicking from Promotions or sharing link opens detail page directly
      this.route.queryParamMap.subscribe((params) => {
        const rId = params.get('recipe');
        const pId = params.get('plan');
        if (rId) {
          this.openRecipeDetail(rId, false);
        } else if (pId) {
          this.openPlanDetail(pId, false);
        } else {
          this.selectedRecipeId.set(null);
          this.selectedPlanDetailId.set(null);
        }
      });
    });
  }

  onImageError(event: Event, fallbackUrl = FALLBACK_FOOD_IMG): void {
    const img = event.target as HTMLImageElement | null;
    if (img && img.src !== fallbackUrl) {
      img.src = fallbackUrl;
    }
  }

  openRecipeDetail(recipeId: string, updateUrl = true): void {
    // Ensure all recipes are computed so we can find it even if a filter was active
    if (!this.results().some(r => r.id === recipeId)) {
      this.selectedGoals.set([]);
      this.budgetLimit.set(null);
      this.excludeIngredients.set('');
      this.computeRecipes();
    }
    const found = this.results().find(r => r.id === recipeId);
    if (found) {
      this.recordRecentMeal(recipeId, '👁️ Vừa xem / Đã chọn gần đây');
      this.selectedPlanDetailId.set(null);
      this.selectedRecipeId.set(recipeId);
      this.activeGalleryImage.set(found.image);
      if (updateUrl) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { recipe: recipeId, plan: null },
          queryParamsHandling: 'merge',
        });
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  openPlanDetail(planId: string, updateUrl = true): void {
    const plan = this.mealPlanCards().find(p => p.id === planId);
    if (plan) {
      this.selectedRecipeId.set(null);
      this.selectedPlanDetailId.set(planId);
      this.activePlanId.set(planId);
      if (updateUrl) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { plan: planId, recipe: null },
          queryParamsHandling: 'merge',
        });
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  closeDetailView(): void {
    this.selectedRecipeId.set(null);
    this.selectedPlanDetailId.set(null);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { recipe: null, plan: null },
      queryParamsHandling: 'merge',
    });
  }

  applyMealPlan(plan: MealPlanCardView): void {
    this.openPlanDetail(plan.id);
  }

  addMealPlanToCart(plan: MealPlanCardView): void {
    if (plan.matchedProducts.length === 0) return;
    for (const p of plan.matchedProducts) {
      const discounted = Math.round(((p.priceNumber || 0) * (100 - plan.discountPercent)) / 100 / 500) * 500;
      this.cart.addItem(toCartProduct(p, discounted), 1);
    }
    for (const rId of plan.recipeIds) {
      this.recordRecentMeal(rId, '🛍️ Vừa mua trong gói Combo');
    }
    this.voucher.copyCode(plan.voucherCode);
    this.addedToCart.set(
      `Đã thêm trọn bộ "${plan.name}" (${plan.matchedProducts.length} nguyên liệu, Giá Deal ${plan.dealTotalText}) và sao chép mã ${plan.voucherCode}!`
    );
    setTimeout(() => this.addedToCart.set(null), 4000);
  }

  updateServings(newVal: number): void {
    const clamped = Math.max(1, Math.min(20, Number(newVal) || 1));
    this.servings.set(clamped);
    this.computeRecipes();
  }

  updateMealsCount(newVal: number): void {
    const clamped = Math.max(1, Math.min(3, Number(newVal) || 1));
    this.mealsCount.set(clamped);
    this.computeRecipes();
  }

  isGoalSelected(id: string): boolean {
    return this.selectedGoals().includes(id);
  }

  toggleGoal(id: string): void {
    this.activePlanId.set(null);
    const goals = this.selectedGoals();
    const isSelected = goals.includes(id);
    const newGoals = isSelected ? goals.filter((g) => g !== id) : [...goals, id];
    this.selectedGoals.set(newGoals);

    const targets = { ...this.goalTargets() };
    if (!isSelected) {
      const goal = this.goalsSignal().find((g) => g.id === id);
      if (goal && goal.unit) {
        targets[id] = goal.default;
      }
    } else {
      delete targets[id];
    }
    this.goalTargets.set(targets);
  }

  getGoalTarget(goalId: string): number {
    return this.goalTargets()[goalId] || 0;
  }

  setGoalTarget(goalId: string, value: number): void {
    const targets = { ...this.goalTargets() };
    targets[goalId] = Number(value);
    this.goalTargets.set(targets);
  }

  getGoalUnit(goalId: string): string {
    const goal = this.goalsSignal().find((g) => g.id === goalId);
    return goal?.unit || '';
  }

  hasNumericTarget(goalId: string): boolean {
    const goal = this.goalsSignal().find((g) => g.id === goalId);
    return !!goal?.unit;
  }

  adjustServings(recipeId: string, delta: number): void {
    const recipesDb = this.recipesDbSignal();
    this.results.update((list) =>
      list.map((recipe) => {
        if (recipe.id !== recipeId) return recipe;

        const newServings = Math.max(1, Math.min(20, recipe.servings + delta));
        const originalRecipe = recipesDb.find((r) => r.id === recipeId || (r as any).recipeId === recipeId);

        const updatedIngredients = recipe.ingredients.map((ing) => {
          let amountPer1 = 0;
          if (originalRecipe) {
            const originalIng = originalRecipe.ingredients.find((i) => i.name === ing.name);
            if (originalIng && originalIng.amountPer1Serving) {
              amountPer1 = originalIng.amountPer1Serving;
            }
          }
          if (!amountPer1) {
            const currNum = parseFloat(ing.amount) || 100;
            amountPer1 = Math.round(currNum / Math.max(1, recipe.servings));
          }
          const scaledAmount = amountPer1 * newServings * Math.max(1, recipe.meals);
          return {
            ...ing,
            amount: `${scaledAmount}`,
          };
        });

        return {
          ...recipe,
          servings: newServings,
          ingredients: updatedIngredients,
        };
      })
    );
  }

  findRecipes(): void {
    this.activePlanId.set(null);
    this.loading.set(true);
    setTimeout(() => {
      this.computeRecipes();
      this.loading.set(false);
    }, 250);
  }

  private computeRecipes(priorityRecipeIds?: string[]): void {
    const selected = this.selectedGoals();
    const targets = this.goalTargets();
    const currentServings = Math.max(1, this.servings());
    const currentMeals = Math.max(1, this.mealsCount());
    const excludeRaw = normalizeStr(this.excludeIngredients());
    const excludeKeywords = excludeRaw
      ? excludeRaw.split(/[,;\s]+/).map((s) => s.trim()).filter((s) => s.length >= 2)
      : [];

    const recipesDb = this.recipesDbSignal();
    const goalsList = this.goalsSignal();

    const matchedRecipes = recipesDb.filter((recipe) => {
      if (excludeKeywords.length > 0) {
        const hasExcluded = recipe.ingredients.some((ing) => {
          const ingNorm = normalizeStr(ing.name);
          return excludeKeywords.some((kw) => ingNorm.includes(kw));
        });
        if (hasExcluded) return false;
      }

      if (priorityRecipeIds && priorityRecipeIds.length > 0) {
        return priorityRecipeIds.includes(recipe.id);
      }

      if (selected.length === 0) return true;
      return recipe.goalsTags.some((g) => selected.includes(g));
    });

    const currentCatalogue = this.catalogue();

    const recipeResults: RecipeResult[] = matchedRecipes.map((recipe) => {
      let matchScore = 95;
      const explanation: string[] = [];

      if (selected.length > 0) {
        const common = recipe.goalsTags.filter((g) => selected.includes(g));
        const baseScore = Math.round((common.length / selected.length) * 100);
        matchScore = Math.min(100, Math.max(70, baseScore));

        common.forEach((tagId) => {
          const goal = goalsList.find((g) => g.id === tagId);
          if (goal) {
            const target = targets[tagId];
            if (target && goal.unit) {
              explanation.push(`${goal.label}: mục tiêu ${target}${goal.unit}`);
            } else {
              explanation.push(goal.label);
            }
          }
        });
      }

      const goalsMet = recipe.goalsTags.map(
        (tagId) => goalsList.find((g) => g.id === tagId)?.label || tagId
      );

      const ingredients: IngredientItem[] = recipe.ingredients.map((ing) => {
        const scaledAmount = ing.amountPer1Serving * currentServings * currentMeals;
        const matchedProd = matchCatalogueProduct(ing.name, currentCatalogue, ing.product);

        return {
          name: ing.name,
          amount: `${scaledAmount}`,
          unit: ing.unit,
          product: matchedProd,
          selected: true,
          owned: false,
        };
      });

      const ingImages = ingredients
        .map(i => i.product?.image)
        .filter((u): u is string => !!u);
      const gallery = Array.from(new Set([recipe.image, ...(recipe.gallery || []), ...ingImages])).slice(0, 5);

      return {
        id: recipe.id,
        name: recipe.name,
        image: recipe.image,
        gallery,
        description: recipe.description,
        matchScore,
        servings: currentServings,
        meals: currentMeals,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime || '15 phút',
        difficulty: recipe.difficulty || 'Dễ nấu',
        calories: recipe.calories || 420,
        macros: recipe.macros || {
          protein: '32g',
          carbs: '24g',
          fat: '14g',
          fiber: '8g',
          vitamins: 'Vitamin A, C, B6, Omega-3, Sắt, Canxi',
        },
        chefTips:
          recipe.chefTips ||
          'Chế biến ở lửa vừa cùng nông sản tươi sạch thu hoạch trong ngày từ Xanh Lá để giữ trọn vẹn hương vị và vi chất.',
        steps: recipe.steps?.length
          ? recipe.steps
          : [
              { stepNumber: 1, title: 'Sơ chế nguyên liệu', detail: 'Rửa sạch rau củ hữu cơ và thấm khô phần thịt/hải sản tươi.' },
              { stepNumber: 2, title: 'Tẩm ướp gia vị', detail: 'Ướp nguyên liệu với muối hồng, tiêu đen và dầu ô liu trong 10 phút.' },
              { stepNumber: 3, title: 'Chế biến giữ trọn vi chất', detail: 'Nấu hoặc áp chảo vừa chín tới để giữ màu xanh giòn của rau củ.' },
              { stepNumber: 4, title: 'Trình bày & Thưởng thức', detail: 'Bày ra đĩa và thưởng thức ngay khi còn nóng.' },
            ],
        ingredients,
        nutritionNote: recipe.nutritionNote,
        goalsTags: recipe.goalsTags,
        goalsMet,
        explanation: explanation.length > 0 ? explanation : undefined,
      };
    });

    recipeResults.sort((a, b) => b.matchScore - a.matchScore);

    const budget = this.budgetLimit();
    const finalResults =
      budget && budget > 0
        ? recipeResults.filter((r) => this.totalCost(r) <= budget)
        : recipeResults;

    this.results.set(finalResults);
    this.hasSearched.set(true);
  }

  toggleIngredient(recipeId: string, ingredientName: string): void {
    this.results.update((list) =>
      list.map((recipe) => {
        if (recipe.id !== recipeId) return recipe;
        return {
          ...recipe,
          ingredients: recipe.ingredients.map((ing) =>
            ing.name === ingredientName ? { ...ing, selected: !ing.selected } : ing
          ),
        };
      })
    );
  }

  toggleOwned(recipeId: string, ingredientName: string): void {
    this.results.update((list) =>
      list.map((recipe) => {
        if (recipe.id !== recipeId) return recipe;
        return {
          ...recipe,
          ingredients: recipe.ingredients.map((ing) =>
            ing.name === ingredientName ? { ...ing, owned: !ing.owned } : ing
          ),
        };
      })
    );
  }

  getIngredientNeededPacks(item: IngredientItem, servings?: number, meals?: number): number {
    if (!item || !item.product) return 1;
    const weightStr = item.product.weight || (item.product as any).packSize || item.product.name;
    const packGrams = parseGramWeight(weightStr);
    const neededGrams = parseFloat(item.amount) || 0;

    if (packGrams > 0 && neededGrams > 0) {
      const multiplier = (item.unit && item.unit.toLowerCase().includes('kg')) ? 1000 : 1;
      const totalNeededGrams = neededGrams * multiplier;
      return Math.max(1, Math.ceil(totalNeededGrams / packGrams));
    }

    const currentServings = servings || 2;
    return Math.max(1, Math.ceil(currentServings / 4));
  }

  getProductUnit(item: IngredientItem): string {
    if (!item) return 'gói';
    const name = ((item.product?.name || item.name) + ' ' + (item.unit || '')).toLowerCase();
    if (name.includes('nguyên con') || (name.includes('gà') && name.includes('con')) || item.name.toLowerCase().includes('con')) {
      return 'con';
    }
    if (name.includes('hộp') || name.includes('lốc')) return 'hộp';
    if (name.includes('khay')) return 'khay';
    if (name.includes('túi')) return 'túi';
    if (name.includes('búp') || name.includes('bắp')) return 'bắp';
    if (name.includes('chai') || name.includes('lọ')) return 'chai';
    return 'gói';
  }

  getProductPackUnit(p?: ApiProduct | null): string {
    if (!p) return 'gói';
    const name = (p.name || '').toLowerCase() + ' ' + (p.weight || '').toLowerCase();
    if (name.includes('nguyên con') || name.includes('con')) return 'con';
    if (name.includes('hộp') || name.includes('lốc')) return 'hộp';
    if (name.includes('khay')) return 'khay';
    if (name.includes('túi')) return 'túi';
    if (name.includes('bó')) return 'bó';
    if (name.includes('búp') || name.includes('bắp')) return 'bắp';
    if (name.includes('chai') || name.includes('lọ')) return 'chai';
    return 'gói/khay';
  }

  getServingMultiplier(servings: number): number {
    return Math.max(1, Math.ceil((servings || 2) / 4));
  }

  totalCost(recipe: RecipeResult): number {
    const baseCost = recipe.ingredients
      .filter((i) => i.selected && !i.owned && i.product)
      .reduce((sum, i) => {
        const packs = this.getIngredientNeededPacks(i, recipe.servings, recipe.meals);
        return sum + (i.product?.priceNumber || 0) * packs;
      }, 0);
    return baseCost;
  }

  dealCost(recipe: RecipeResult): number {
    return Math.round((this.totalCost(recipe) * 0.9) / 1000) * 1000;
  }

  getProductLink(product: ApiProduct): string {
    return formatProductSlug(product.slug, product._id);
  }

  getCartQty(product: ApiProduct | null | undefined): number {
    if (!product) return 0;
    const items = this.cart.items();
    const prodSlug = (product.slug || '').toLowerCase();
    const prodId = (product._id || '').toLowerCase();
    const prodName = (product.name || '').toLowerCase();

    let totalQty = 0;
    for (const it of items) {
      const itSlug = (it.product.slug || '').toLowerCase();
      const itId = (it.product.id || '').toLowerCase();
      const itName = (it.product.name || '').toLowerCase();

      if ((prodSlug && itSlug === prodSlug) || (prodId && itId === prodId) || (prodName && itName === prodName)) {
        totalQty += it.quantity;
      }
    }
    return totalQty;
  }

  getIngredientMissingQty(item: IngredientItem, servings: number, meals: number = 1): number {
    if (!item || !item.product || item.owned || !item.selected) return 0;
    const neededPacks = this.getIngredientNeededPacks(item, servings, meals);
    const inCart = this.getCartQty(item.product);
    return Math.max(0, neededPacks - inCart);
  }

  isIngredientFullyInCart(item: IngredientItem, servings: number, meals: number = 1): boolean {
    if (!item || !item.product) return false;
    const neededPacks = this.getIngredientNeededPacks(item, servings, meals);
    const inCart = this.getCartQty(item.product);
    return inCart >= neededPacks;
  }

  getAlreadyInCartCount(recipe: RecipeResult): number {
    if (!recipe) return 0;
    return recipe.ingredients.filter(
      (i) => i.selected && !i.owned && i.product && this.getCartQty(i.product) > 0
    ).length;
  }

  getMissingIngredientsCount(recipe: RecipeResult): number {
    if (!recipe) return 0;
    return recipe.ingredients.filter(
      (i) => i.selected && !i.owned && i.product && this.getIngredientMissingQty(i, recipe.servings, recipe.meals) > 0
    ).length;
  }

  getRemainingOrigCost(recipe: RecipeResult): number {
    if (!recipe) return 0;
    return recipe.ingredients
      .filter((i) => i.selected && !i.owned && i.product)
      .reduce((sum, i) => {
        const missing = this.getIngredientMissingQty(i, recipe.servings, recipe.meals);
        return sum + (i.product?.priceNumber || 0) * missing;
      }, 0);
  }

  getRemainingToPayCost(recipe: RecipeResult): number {
    const baseCost = this.getRemainingOrigCost(recipe);
    return Math.round((baseCost * 0.9) / 1000) * 1000;
  }

  getAlreadyInCartValue(recipe: RecipeResult): number {
    if (!recipe) return 0;
    return recipe.ingredients
      .filter((i) => i.selected && !i.owned && i.product)
      .reduce((sum, i) => {
        const needed = this.getIngredientNeededPacks(i, recipe.servings, recipe.meals);
        const inCart = Math.min(needed, this.getCartQty(i.product));
        return sum + (i.product?.priceNumber || 0) * inCart;
      }, 0);
  }

  getIngredientRemainingPrice(item: IngredientItem, servings: number, meals: number = 1): number {
    const missing = this.getIngredientMissingQty(item, servings, meals);
    return (item.product?.priceNumber || 0) * missing;
  }

  addAllToCart(recipe: RecipeResult): void {
    const eligible = recipe.ingredients.filter((i) => i.selected && !i.owned && i.product);
    if (eligible.length === 0) {
      this.addedToCart.set('Chưa có nguyên liệu nào khả dụng để thêm vào giỏ.');
      setTimeout(() => this.addedToCart.set(null), 3000);
      return;
    }

    const itemsToAdd: { item: IngredientItem; qtyToAdd: number }[] = [];
    const alreadyEnough: string[] = [];

    for (const item of eligible) {
      const missing = this.getIngredientMissingQty(item, recipe.servings, recipe.meals);
      if (missing > 0) {
        itemsToAdd.push({ item, qtyToAdd: missing });
      } else {
        alreadyEnough.push(item.product?.name || item.name);
      }
    }

    if (itemsToAdd.length === 0) {
      this.lastAddedRecipe.set(recipe);
      this.addedToCart.set(
        `Toàn bộ nguyên liệu cho khẩu phần ${recipe.servings} người đã có đủ số lượng trong giỏ hàng! Không cần mua thêm.`
      );
      setTimeout(() => this.addedToCart.set(null), 5000);
      return;
    }

    for (const { item, qtyToAdd } of itemsToAdd) {
      if (item.product) {
        this.cart.addItem(toCartProduct(item.product), qtyToAdd);
      }
    }

    // Tự động chỉ tick chọn các nguyên liệu thuộc món này (tạm bỏ tick các món khác trong giỏ)
    this.cart.selectOnlyRecipeItems(recipe.ingredients.filter(i => i.selected && !i.owned));

    this.lastAddedRecipe.set(recipe);
    this.recordRecentMeal(recipe.id, '✓ Vừa mua nguyên liệu món này');
    this.voucher.copyCode('NUTRITION10');

    if (alreadyEnough.length > 0) {
      const addedDesc = itemsToAdd
        .map(t => `${t.item.product?.name || t.item.name} (+${t.qtyToAdd} gói)`)
        .join(', ');
      this.addedToCart.set(
        `Đã thêm bổ sung phần nguyên liệu còn thiếu cho ${recipe.servings} người ăn: ${addedDesc}! (${alreadyEnough.join(', ')} đã có đủ). Đã sao chép mã NUTRITION10!`
      );
    } else {
      this.addedToCart.set(
        `Đã thêm trọn bộ ${itemsToAdd.length} nguyên liệu cho ${recipe.servings} người ăn vào giỏ hàng & sao chép mã NUTRITION10 (-10%)!`
      );
    }
    setTimeout(() => this.addedToCart.set(null), 7000);
  }

  checkoutOnlyRecipe(recipe: RecipeResult): void {
    const eligible = recipe.ingredients.filter((i) => i.selected && !i.owned && i.product);
    if (eligible.length === 0) return;

    // 1. Thêm bất kỳ phần nguyên liệu còn thiếu nào vào giỏ hàng
    for (const item of eligible) {
      const missing = this.getIngredientMissingQty(item, recipe.servings, recipe.meals);
      if (missing > 0 && item.product) {
        this.cart.addItem(toCartProduct(item.product), missing);
      }
    }

    // 2. Chỉ tick chọn các nguyên liệu thuộc món ăn này (tất cả các món cũ khác như bột giặt, dầu ăn... tự động bị bỏ tick)
    this.cart.selectOnlyRecipeItems(recipe.ingredients.filter(i => i.selected && !i.owned));

    // 3. Áp mã ưu đãi combo dinh dưỡng
    this.voucher.copyCode('NUTRITION10');
    this.recordRecentMeal(recipe.id, '✓ Đang thanh toán nguyên liệu món này');

    // 4. Chuyển thẳng sang trang Checkout
    this.router.navigate(['/checkout'], { queryParams: { voucher: 'NUTRITION10' } });
  }

  addMissingPacksToCart(item: IngredientItem, servings: number, meals: number = 1): void {
    if (!item.product) return;
    const missing = this.getIngredientMissingQty(item, servings, meals);
    const qty = missing > 0 ? missing : 1;
    this.cart.addItem(toCartProduct(item.product), qty);
    this.addedToCart.set(`Đã thêm ${qty} gói "${item.product.name}" vào giỏ hàng!`);
    setTimeout(() => this.addedToCart.set(null), 2500);
  }

  addSingleToCart(product: ApiProduct): void {
    const prevQty = this.getCartQty(product);
    this.cart.addItem(toCartProduct(product), 1);
    if (prevQty > 0) {
      this.addedToCart.set(`Đã tăng số lượng "${product.name}" lên ${prevQty + 1} trong giỏ hàng!`);
    } else {
      this.addedToCart.set(`Đã thêm "${product.name}" vào giỏ hàng!`);
    }
    setTimeout(() => this.addedToCart.set(null), 2500);
  }
}
