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
  ingredients: { name: string; amountPer1Serving: number; unit: string }[];
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
}

export interface DayPlanComputedView {
  dayKey: string;
  dayLabel: string;
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
  return {
    id: p._id || p.slug,
    name: p.name,
    slug: formatProductSlug(p.slug, p._id),
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

function matchCatalogueProduct(ingredientName: string, catalogue: ApiProduct[]): ApiProduct | null {
  if (!catalogue || catalogue.length === 0) return null;
  const target = normalizeStr(ingredientName);

  // 1. Direct contains match
  let match = catalogue.find((p) => {
    const pName = normalizeStr(p.name);
    return pName.includes(target) || target.includes(pName);
  });
  if (match) return match;

  // 2. Keyword alias mappings for Vietnamese market items
  const keywordMap: [string, string[]][] = [
    ['ca hoi', ['ca hoi', 'salmon']],
    ['tom su', ['tom su', 'tom the', 'tom']],
    ['qua bo', ['qua bo', 'bo sap', 'avocado', 'bo 034']],
    ['bo sap', ['bo sap', 'qua bo', 'bo 034', 'avocado']],
    ['bo hass', ['qua bo', 'hass', 'bo sap']],
    ['thit bo', ['bo bap my', 'bo than', 'bo my', 'beef', 'thit bo']],
    ['bo my', ['bo bap my', 'bo than', 'bo my', 'thit bo']],
    ['thit ga', ['ga ta', 'dui ga', 'chicken', 'uc ga']],
    ['ga ta', ['ga ta', 'dui ga', 'chicken', 'uc ga']],
    ['heo thao moc', ['heo', 'ba roi', 'thit heo', 'nac dam']],
    ['ba roi', ['ba roi', 'thit heo', 'heo']],
    ['ca rot', ['ca rot', 'carrot']],
    ['cai thia', ['cai thia', 'bok choy', 'rau cai']],
    ['cai xanh', ['cai xanh', 'rau cai']],
    ['cai ngot', ['cai ngot', 'rau cai']],
    ['bong cai', ['bong cai', 'sup lo', 'broccoli']],
    ['bi do', ['bi do', 'bi ho lo', 'pumpkin']],
    ['dua leo', ['dua leo', 'cucumber']],
    ['ca chua', ['ca chua', 'tomato']],
    ['ot chuong', ['ot chuong', 'bell pepper']],
    ['nam dong co', ['nam dong co', 'nam huong', 'nam']],
    ['dau tay', ['dau tay', 'strawberry']],
    ['xoai cat', ['xoai cat', 'xoai']],
    ['cam sanh', ['cam sanh', 'cam', 'orange']],
    ['sa tuoi', ['sa tuoi', 'gung tuoi', 'sa', 'hanh']],
    ['sua chua', ['sua chua', 'yogurt', 'hy lap', 'men song']],
  ];

  for (const [key, aliases] of keywordMap) {
    if (target.includes(key) || key.includes(target)) {
      match = catalogue.find((p) => {
        const pNorm = normalizeStr(p.name);
        return aliases.some((a) => pNorm.includes(a));
      });
      if (match) return match;
    }
  }

  // 3. Match individual significant words
  const words = target.split(/\s+/).filter((w) => w.length >= 4);
  for (const word of words) {
    match = catalogue.find((p) => normalizeStr(p.name).includes(word));
    if (match) return match;
  }

  return catalogue[0] || null;
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
    { label: '🥛 Sữa chua', query: 'sữa chua' },
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
    { key: 'breakfast', label: 'Bữa Sáng Năng Lượng', time: '07:00 – 08:30', icon: '🌅' },
    { key: 'lunch', label: 'Bữa Trưa Đủ Chất', time: '11:30 – 13:00', icon: '☀️' },
    { key: 'snack', label: 'Bữa Phụ & Sữa Chua', time: '15:30 – 16:30', icon: '🥛' },
    { key: 'dinner', label: 'Bữa Tối Thanh Đạm', time: '18:30 – 20:00', icon: '🌙' },
  ];

  plannerMode = signal<'day' | 'week'>('day');
  selectedWeekDay = signal<string>('mon');
  weeklyOverviewMode = signal<boolean>(false);
  plannerPreset = signal<'eatclean' | 'protein' | 'family' | 'yogurt_detox'>('eatclean');
  showAdvancedConfig = signal<boolean>(false);
  expandedIngredientIds = signal<Record<string, boolean>>({});

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
  hasSearched = signal<boolean>(false);

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
          const p = matchCatalogueProduct(ing.name, cat);
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

  private buildDayPlanView(dayKey: string, dayLabel: string): DayPlanComputedView {
    const sched = this.weeklySchedule()[dayKey] || this.weeklySchedule()['mon'];
    const all = this.results();
    const slots: MealSlotView[] = this.MEAL_SLOTS_META.map((meta) => ({
      slotKey: meta.key,
      slotLabel: meta.label,
      slotTime: meta.time,
      slotIcon: meta.icon,
      recipe: all.find((r) => r.id === sched[meta.key]) || all[0] || null,
    }));

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    const prodMap = new Map<string, ApiProduct>();

    for (const s of slots) {
      if (s.recipe) {
        totalCalories += s.recipe.calories || 0;
        totalProtein += this.parseMacroNum(s.recipe.macros.protein);
        totalCarbs += this.parseMacroNum(s.recipe.macros.carbs);
        totalFat += this.parseMacroNum(s.recipe.macros.fat);
        totalFiber += this.parseMacroNum(s.recipe.macros.fiber);
        for (const ing of s.recipe.ingredients) {
          if (ing.product) {
            prodMap.set(ing.product._id || ing.product.slug, ing.product);
          }
        }
      }
    }

    const matchedProducts = Array.from(prodMap.values());
    const originalPrice = matchedProducts.reduce((sum, p) => sum + (p.priceNumber || 0), 0);
    const dealPrice = Math.round((originalPrice * 0.88) / 1000) * 1000;
    const savedPrice = Math.max(0, originalPrice - dealPrice);

    return {
      dayKey,
      dayLabel,
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
    };
  }

  readonly activeDayPlan = computed<DayPlanComputedView>(() => {
    const dKey = this.plannerMode() === 'day' ? 'mon' : this.selectedWeekDay();
    const dObj = this.WEEK_DAYS.find((d) => d.key === dKey) || this.WEEK_DAYS[0];
    return this.buildDayPlanView(dObj.key, this.plannerMode() === 'day' ? 'Thực đơn Hôm nay' : dObj.label);
  });

  readonly allWeekDaysPlans = computed<DayPlanComputedView[]>(() => {
    return this.WEEK_DAYS.map((d) => this.buildDayPlanView(d.key, d.label));
  });

  readonly weeklyPlanSummary = computed(() => {
    const days = this.allWeekDaysPlans();
    const prodMap = new Map<string, ApiProduct>();
    let totalCalories = 0;
    let totalProtein = 0;
    for (const d of days) {
      totalCalories += d.totalCalories;
      totalProtein += d.totalProtein;
      for (const p of d.matchedProducts) {
        prodMap.set(p._id || p.slug, p);
      }
    }
    const matchedProducts = Array.from(prodMap.values());
    // Weekly shopping multiplies base ingredients by 2.5x average across 7 days with 20% bundle discount
    const originalPrice = Math.round((matchedProducts.reduce((s, p) => s + (p.priceNumber || 0), 0) * 2.2) / 1000) * 1000;
    const dealPrice = Math.round((originalPrice * 0.8) / 1000) * 1000;
    const savedPrice = Math.max(0, originalPrice - dealPrice);
    return {
      avgCaloriesPerDay: Math.round(totalCalories / 7),
      avgProteinPerDay: Math.round(totalProtein / 7),
      totalMeals: 28,
      matchedProducts,
      originalPrice,
      dealPrice,
      savedPrice,
    };
  });

  applyPlannerPreset(preset: 'eatclean' | 'protein' | 'family' | 'yogurt_detox'): void {
    this.plannerPreset.set(preset);
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
  }

  swapMealInSlot(slotKey: MealSlotKey, dayKey?: string): void {
    const targetDay = dayKey || (this.plannerMode() === 'day' ? 'mon' : this.selectedWeekDay());
    const all = this.results();
    if (all.length === 0) return;

    const currentSched = this.weeklySchedule()[targetDay] || this.weeklySchedule()['mon'];
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
    if (nextRecipe) {
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
    const targetDay = this.plannerMode() === 'day' ? 'mon' : this.selectedWeekDay();
    const isLight = ['sua-chua-hy-lap-trai-cay', 'sinh-to-dau-xoai', 'detox-cam-tao-ca-rot'].includes(recipe.id);
    const slotKey: MealSlotKey = isLight ? 'snack' : 'lunch';

    this.weeklySchedule.update((prev) => ({
      ...prev,
      [targetDay]: {
        ...prev[targetDay],
        [slotKey]: recipe.id,
      },
    }));

    const dayLabel = this.plannerMode() === 'day' ? 'Hôm nay' : (this.WEEK_DAYS.find((d) => d.key === targetDay)?.label || 'Thứ 2');
    const slotLabel = isLight ? 'Bữa Phụ / Sữa Chua' : 'Bữa Trưa';
    this.addedToCart.set(`Đã thêm "${recipe.name}" vào ${slotLabel} (${dayLabel}) trong Kế Hoạch Thực Đơn!`);
    setTimeout(() => this.addedToCart.set(null), 3200);

    if (typeof document !== 'undefined') {
      document.getElementById('meal-planner-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  buyDayPlanIngredients(dayPlan: DayPlanComputedView): void {
    if (dayPlan.matchedProducts.length === 0) return;
    for (const p of dayPlan.matchedProducts) {
      const discounted = Math.round(((p.priceNumber || 0) * 0.88) / 500) * 500;
      this.cart.addItem(toCartProduct(p, discounted), 1);
    }
    for (const s of dayPlan.slots) {
      if (s.recipe) this.recordRecentMeal(s.recipe.id, '🕒 Đã lên thực đơn & mua gần đây');
    }
    this.voucher.copyCode('NUTRITION10');
    this.addedToCart.set(
      `Đã thêm trọn bộ ${dayPlan.matchedProducts.length} nguyên liệu cho ${dayPlan.dayLabel} (${formatPrice(dayPlan.dealPrice)}) vào giỏ hàng & sao chép mã NUTRITION10!`
    );
    setTimeout(() => this.addedToCart.set(null), 4000);
  }

  buyFullWeekIngredients(): void {
    const summary = this.weeklyPlanSummary();
    if (summary.matchedProducts.length === 0) return;
    for (const p of summary.matchedProducts) {
      const discounted = Math.round(((p.priceNumber || 0) * 0.8) / 500) * 500;
      this.cart.addItem(toCartProduct(p, discounted), 2);
    }
    this.voucher.copyCode('COMBO30');
    this.addedToCart.set(
      `Đã thêm trọn gói Đi Chợ Cả Tuần 7 Ngày (${summary.matchedProducts.length} loại nông sản tươi sạch, ưu đãi -20%) vào giỏ & sao chép mã COMBO30!`
    );
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
    if (inCart) return '🕒 Đang có nguyên liệu trong giỏ';
    if (this.getRecentScore(recipe) > 0) return '🕒 Đã mua nguyên liệu gần đây';
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
        label: '🕒 Đã ăn / Mua gần đây',
      },
      'ca-hoi-ap-chao': {
        timestamp: Date.now() - 3600 * 1000 * 18,
        label: '🕒 Đã mua nguyên liệu tuần này',
      },
      'salad-ga-nuong': {
        timestamp: Date.now() - 3600 * 1000 * 36,
        label: '🕒 Đã mua nguyên liệu gần đây',
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

  private recordRecentMeal(recipeId: string, label = '🕒 Vừa chọn / Đã mua gần đây'): void {
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
      this.recordRecentMeal(recipeId, '🕒 Vừa xem / Đã chọn gần đây');
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
      this.recordRecentMeal(rId, '🕒 Vừa mua trong gói Combo');
    }
    this.voucher.copyCode(plan.voucherCode);
    this.addedToCart.set(
      `Đã thêm trọn bộ "${plan.name}" (${plan.matchedProducts.length} nguyên liệu, Giá Deal ${plan.dealTotalText}) và sao chép mã ${plan.voucherCode}!`
    );
    setTimeout(() => this.addedToCart.set(null), 4000);
  }

  updateServings(newVal: number): void {
    const clamped = Math.max(1, Math.min(10, Number(newVal) || 1));
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

        const newServings = Math.max(1, Math.min(10, recipe.servings + delta));
        const originalRecipe = recipesDb.find((r) => r.id === recipeId);

        const updatedIngredients = recipe.ingredients.map((ing) => {
          if (!originalRecipe) return ing;
          const originalIng = originalRecipe.ingredients.find((i) => i.name === ing.name);
          if (!originalIng) return ing;
          const scaledAmount = originalIng.amountPer1Serving * newServings * recipe.meals;
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
        const matchedProd = matchCatalogueProduct(ing.name, currentCatalogue);

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

  totalCost(recipe: RecipeResult): number {
    const baseCost = recipe.ingredients
      .filter((i) => i.selected && !i.owned && i.product)
      .reduce((sum, i) => sum + (i.product?.priceNumber || 0), 0);
    return baseCost * Math.max(1, recipe.meals);
  }

  dealCost(recipe: RecipeResult): number {
    return Math.round((this.totalCost(recipe) * 0.9) / 1000) * 1000;
  }

  getProductLink(product: ApiProduct): string {
    return formatProductSlug(product.slug, product._id);
  }

  addAllToCart(recipe: RecipeResult): void {
    const toAdd = recipe.ingredients.filter((i) => i.selected && !i.owned && i.product);
    if (toAdd.length === 0) {
      this.addedToCart.set('Chưa có nguyên liệu nào khả dụng để thêm vào giỏ.');
      setTimeout(() => this.addedToCart.set(null), 3000);
      return;
    }

    const qty = Math.max(1, recipe.meals);
    for (const item of toAdd) {
      if (item.product) {
        this.cart.addItem(toCartProduct(item.product), qty);
      }
    }

    this.recordRecentMeal(recipe.id, '🕒 Vừa mua nguyên liệu món này');
    this.voucher.copyCode('NUTRITION10');
    this.addedToCart.set(
      `Đã thêm ${toAdd.length} nguyên liệu cho món "${recipe.name}" vào giỏ hàng và sao chép mã ưu đãi NUTRITION10 (-10%)!`
    );
    setTimeout(() => this.addedToCart.set(null), 3500);
  }

  addSingleToCart(product: ApiProduct): void {
    this.cart.addItem(toCartProduct(product), 1);
    this.addedToCart.set(`Đã thêm "${product.name}" vào giỏ hàng!`);
    setTimeout(() => this.addedToCart.set(null), 2500);
  }
}
