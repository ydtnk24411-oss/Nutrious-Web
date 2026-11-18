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
  buyPacksOverride?: number;
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
  fallbackFoodImage?: string;
}

export interface QuickSearchTag {
  label: string;
  query: string;
}

export interface IngredientAliasItem {
  keyword: string;
  slug: string;
  excludeKeyword?: string;
}

export interface WeekDayOption {
  key: string;
  label: string;
  short: string;
}

export interface MealSlotOption {
  key: MealSlotKey;
  label: string;
  time: string;
  icon: string;
}

export interface NutrientBoostOption {
  id: string;
  label: string;
  desc: string;
}

export interface PlannerHealthGoalConfig {
  id: 'protein' | 'eatclean' | 'family' | 'yogurt_detox';
  title: string;
  subtitle: string;
  badge: string;
  metrics: string;
  mealsPerDay: 2 | 3 | 4;
  targetDailyKcal: number;
  targetProtein: number;
  targetFiber: number;
  targetCarbs: number;
  priorityNutrients: string[];
  dayTheme: string;
  weekDayThemes: Record<string, string>;
  defaultSingleDaySchedule: DayMealPlanMap;
  weeklySchedule: Record<string, DayMealPlanMap>;
}

export interface NutritionPlannerConfig {
  weekDays: WeekDayOption[];
  mealSlots: MealSlotOption[];
  lightRecipeIds: string[];
  nutrientBoostOptions: NutrientBoostOption[];
  healthGoals: PlannerHealthGoalConfig[];
}

export interface RecipeDefaultsConfig {
  cookTime?: string;
  difficulty?: string;
  calories?: number;
  macros?: RecipeMacros;
  chefTips?: string;
  steps?: RecipeStep[];
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

function formatProductSlug(slug?: string, id?: string): string {
  const raw = (slug || id || '').trim();
  if (!raw) return '/online-ordering';
  return raw.startsWith('/') ? raw : `/product-page/${raw}`;
}

function toCartProduct(p: ApiProduct, customPrice?: number, fallbackImage = ''): XanhLaProduct {
  const finalPrice = customPrice ?? (p.priceNumber || 0);
  const cleanSlug = (p.slug || '').replace(/^\/product-page\//, '').replace(/^\//, '').trim() || p._id || 'sp';
  return {
    id: p._id || p.slug || cleanSlug,
    name: p.name,
    slug: cleanSlug,
    price: customPrice !== undefined ? formatPrice(customPrice) : p.price,
    priceNumber: finalPrice,
    image: p.image || fallbackImage,
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

function isCompatibleProduct(ingredientRaw: string, product: ApiProduct): boolean {
  if (!product || !product.name) return false;
  const pName = lowerKeepDiacritics(product.name);
  const pSlug = product.slug || '';
  const ing = lowerKeepDiacritics(ingredientRaw);

  if (ing.includes('cải xanh') && !ing.includes('bông cải')) {
    if (pName.includes('bông cải') || pSlug.includes('bong-cai')) return false;
  }
  if (ing.includes('nấm') && !pName.includes('nấm') && !pSlug.includes('nam')) {
    return false;
  }
  if (ing.includes('cà rốt') && !pName.includes('cà rốt') && !pSlug.includes('ca-rot')) {
    return false;
  }
  if (ing.includes('ớt chuông') && !pName.includes('ớt chuông') && !pSlug.includes('ot-chuong')) {
    return false;
  }
  if (ing.includes('gà') && !pName.includes('gà') && !pSlug.includes('ga')) {
    return false;
  }
  if (/(?:^|[\s,;.-])sả(?:$|[\s,;.-])/i.test(ing) || ing.includes('sả')) {
    const isRealSa = /(?:^|[\s,;.-])sả(?:$|[\s,;.-])|củ\s*sả|sả\s*tươi/i.test(pName);
    const hasFalseMatch = /đặc\s*sản|nông\s*sản|thủy\s*sản|hải\s*sản|khoáng\s*sản/i.test(pName);
    const isMeatOrFish = /cá\s*thu|cá\s*hồi|thịt|heo|bò|gà|tôm/i.test(pName);
    if (!isRealSa || hasFalseMatch || isMeatOrFish || pName.includes('rau ngót') || pSlug.includes('rau-ngot')) {
      return false;
    }
  }
  if (ing.includes('bơ') && (pName.includes('thịt bò') || pSlug.includes('thit-bo') || pName.includes('bò bắp'))) {
    return false;
  }
  if (ing.includes('bò') && !ing.includes('bơ') && (!pName.includes('bò') || pName.includes('bơ sáp'))) {
    return false;
  }
  return true;
}

function matchCatalogueProduct(
  ingredientName: string,
  catalogue: ApiProduct[],
  preMatched?: ApiProduct | null,
  aliases: IngredientAliasItem[] = []
): ApiProduct | null {
  const rawKey = lowerKeepDiacritics(ingredientName);

  // 1. Prefer product already matched from MongoDB by /api/nutrition
  if (preMatched && preMatched.name && (preMatched.image || preMatched.priceNumber)) {
    if (isCompatibleProduct(rawKey, preMatched)) {
      return preMatched;
    }
  }

  if (!catalogue || catalogue.length === 0) return null;

  // 2. Match exact product name from MongoDB /api/products catalogue
  const byExactName = catalogue.find(
    (p) => lowerKeepDiacritics(p.name) === rawKey && isCompatibleProduct(rawKey, p)
  );
  if (byExactName) return byExactName;

  // 3. Match using DB-configured ingredient aliases (longest keyword first so specific aliases win)
  if (aliases.length > 0) {
    const sortedAliases = [...aliases].sort((a, b) => (b.keyword?.length || 0) - (a.keyword?.length || 0));
    for (const alias of sortedAliases) {
      const kw = lowerKeepDiacritics(alias.keyword);
      if (!kw || !rawKey.includes(kw)) continue;
      if (alias.excludeKeyword && rawKey.includes(lowerKeepDiacritics(alias.excludeKeyword))) continue;

      const bySlug = catalogue.find(
        (p) => (p.slug === alias.slug || normalizeStr(p.slug) === normalizeStr(alias.slug)) && isCompatibleProduct(rawKey, p)
      );
      if (bySlug) return bySlug;
    }
  }

  // 4. Normalized exact name fallback against live MongoDB catalogue
  const normKey = normalizeStr(ingredientName);
  const byNorm = catalogue.find(
    (p) => normalizeStr(p.name) === normKey && isCompatibleProduct(rawKey, p)
  );
  return byNorm || null;
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

  protected formatPrice = formatPrice;

  // Dynamic data loaded from MongoDB via /api/nutrition and /api/products
  heroConfig = signal<NutritionHeroConfig>({
    kicker: '',
    title: '',
    subtitle: '',
    bannerImage: '',
    fallbackFoodImage: '',
  });
  private goalsSignal = signal<GoalItem[]>([]);
  private recipesDbSignal = signal<RecipeDbItem[]>([]);
  private mealPlansSignal = signal<MealPlanDeal[]>([]);
  private ingredientAliasesSignal = signal<IngredientAliasItem[]>([]);
  private recipeDefaultsSignal = signal<RecipeDefaultsConfig | null>(null);
  private quickSearchTagsSignal = signal<QuickSearchTag[]>([]);
  private plannerConfigSignal = signal<NutritionPlannerConfig>({
    weekDays: [],
    mealSlots: [],
    lightRecipeIds: [],
    nutrientBoostOptions: [],
    healthGoals: [],
  });
  catalogue = signal<ApiProduct[]>([]);

  get GOALS(): GoalItem[] {
    return this.goalsSignal();
  }

  get quickSearchTags(): QuickSearchTag[] {
    return this.quickSearchTagsSignal();
  }

  get WEEK_DAYS(): WeekDayOption[] {
    return this.plannerConfigSignal().weekDays || [];
  }

  get MEAL_SLOTS_META(): MealSlotOption[] {
    return this.plannerConfigSignal().mealSlots || [];
  }

  get HEALTH_GOALS(): PlannerHealthGoalConfig[] {
    return this.plannerConfigSignal().healthGoals || [];
  }

  get NUTRIENT_BOOST_OPTIONS(): NutrientBoostOption[] {
    return this.plannerConfigSignal().nutrientBoostOptions || [];
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

  // ===== DAILY & WEEKLY MEAL PLANNER STATE =====
  plannerMode = signal<'day' | 'week'>('day');
  selectedWeekDay = signal<string>('mon');
  weeklyOverviewMode = signal<boolean>(false);
  plannerPreset = signal<'eatclean' | 'protein' | 'family' | 'yogurt_detox'>('protein');
  nutritionView = signal<'landing' | 'onboarding' | 'result'>('landing');
  onboardingStep = signal<1 | 2 | 3 | 4 | 5>(1);
  onboardingCompleted = signal<boolean>(false);
  readonly TOTAL_ONBOARDING_STEPS = 5;
  readonly ONBOARDING_STEPS_LIST = [1, 2, 3, 4, 5] as const;

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

  singleDaySchedule = signal<DayMealPlanMap>({ breakfast: '', lunch: '', snack: '', dinner: '' });
  weeklySchedule = signal<Record<string, DayMealPlanMap>>({});

  // Dedicated detail view state (for viewing a dish or a meal plan on its own detail screen)
  selectedRecipeId = signal<string | null>(null);
  selectedPlanDetailId = signal<string | null>(null);
  activeGalleryImage = signal<string>('');

  loading = signal<boolean>(false);
  results = signal<RecipeResult[]>([]);
  allComputedRecipes = signal<RecipeResult[]>([]);
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
    const totalMacroKcal = Math.max(1, pKcal + cKcal + fKcal);
    const pPct = Math.round((pKcal / totalMacroKcal) * 100);
    const cPct = Math.round((cKcal / totalMacroKcal) * 100);
    const fPct = Math.max(0, 100 - pPct - cPct);
    const excessKcal = Math.max(0, pKcal + cKcal - kcal);
    return {
      pPct,
      cPct,
      fPct,
      fGrams: Math.round(fKcal / 9),
      overTarget: pKcal + cKcal > kcal,
      excessKcal,
    };
  });

  readonly parsedExcludeTerms = computed<string[]>(() => {
    const raw = (this.excludeIngredients() || '').trim();
    if (!raw) return [];
    return raw
      .split(/[,;/|\n]+/)
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter((s) => s.length >= 2);
  });

  setTargetDailyKcal(value: number | string): void {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const clampedKcal = Math.max(1000, Math.min(2800, Math.round(parsed / 50) * 50));
      this.targetDailyKcal.set(clampedKcal);
      const currentMacroKcal = this.targetProtein() * 4 + this.targetCarbs() * 4;
      const maxAllowedMacroKcal = clampedKcal * 0.85;
      if (currentMacroKcal > maxAllowedMacroKcal && currentMacroKcal > 0) {
        const scale = maxAllowedMacroKcal / currentMacroKcal;
        this.targetProtein.set(Math.max(20, Math.min(240, Math.round(this.targetProtein() * scale))));
        this.targetCarbs.set(Math.max(40, Math.min(300, Math.round(this.targetCarbs() * scale))));
      }
      this.schedulePlanRefresh();
    }
  }

  rebalanceMacrosToCalories(): void {
    const kcal = Math.max(1000, this.targetDailyKcal());
    const pKcal = this.targetProtein() * 4;
    const cKcal = this.targetCarbs() * 4;
    const totalPC = pKcal + cKcal;
    const targetPCKcal = kcal * 0.82;
    if (totalPC > 0) {
      const scale = targetPCKcal / totalPC;
      this.targetProtein.set(Math.max(20, Math.min(240, Math.round(this.targetProtein() * scale))));
      this.targetCarbs.set(Math.max(40, Math.min(300, Math.round(this.targetCarbs() * scale))));
    } else {
      this.targetProtein.set(Math.round((kcal * 0.3) / 4));
      this.targetCarbs.set(Math.round((kcal * 0.5) / 4));
    }
    this.schedulePlanRefresh();
  }

  setMacroTarget(kind: 'protein' | 'fiber' | 'carbs', value: number | string): number {
    const limits = kind === 'protein' ? [20, 240] : kind === 'fiber' ? [10, 60] : [40, 300];
    const current =
      kind === 'protein' ? this.targetProtein() : kind === 'fiber' ? this.targetFiber() : this.targetCarbs();
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || String(value).trim() === '') {
      return current;
    }
    const clamped = Math.max(limits[0], Math.min(limits[1], Math.round(parsed)));
    if (kind === 'protein') this.targetProtein.set(clamped);
    else if (kind === 'fiber') this.targetFiber.set(clamped);
    else this.targetCarbs.set(clamped);
    this.schedulePlanRefresh();
    return clamped;
  }

  queueMacroTarget(kind: 'protein' | 'fiber' | 'carbs', value: string): void {
    if (this.macroInputTimer) clearTimeout(this.macroInputTimer);
    if (!value.trim()) return;
    this.macroInputTimer = setTimeout(() => this.setMacroTarget(kind, value), 450);
  }

  commitMacroTarget(kind: 'protein' | 'fiber' | 'carbs', value: string, inputEl?: HTMLInputElement): void {
    if (this.macroInputTimer) clearTimeout(this.macroInputTimer);
    const clamped = this.setMacroTarget(kind, value);
    if (inputEl && inputEl.value !== String(clamped)) {
      inputEl.value = String(clamped);
    }
  }

  private schedulePlanRefresh(): void {
    this.saveOnboardingStateToStorage();
    if (this.nutritionView() === 'onboarding') return;
    if (!this.smartPlanConfigured()) return;
    if (this.planRefreshTimer) clearTimeout(this.planRefreshTimer);
    this.planRefreshTimer = setTimeout(() => this.generateSmartPlan(false, false), 220);
  }

  getCalorieStatusText(total: number, target: number): string {
    const diff = total - target;
    if (Math.abs(diff) <= 80) return 'Đạt chuẩn';
    if (diff > 80) return `Vượt ${diff} kcal`;
    return `Thiếu ${Math.abs(diff)} kcal`;
  }

  getProteinStatusText(total: number, target: number): string {
    if (total > target) return `Vượt ${total - target}g`;
    if (total === target) return 'Đạt';
    return `Thiếu ${target - total}g`;
  }

  getNutrientStatusText(actual: number, target: number): string {
    if (actual > target) return `Vượt ${actual - target}g`;
    if (actual === target) return 'Đạt';
    return `Thiếu ${target - actual}g`;
  }

  readonly selectedDetailRecipe = computed<RecipeResult | null>(() => {
    const id = this.selectedRecipeId();
    if (!id) return null;
    return this.results().find(r => r.id === id) || this.allComputedRecipes().find(r => r.id === id) || null;
  });

  readonly relatedRecipes = computed<RecipeResult[]>(() => {
    const current = this.selectedDetailRecipe();
    if (!current) return [];
    const source = this.results().length > 1 ? this.results() : this.allComputedRecipes();
    return source.filter(r => r.id !== current.id).slice(0, 3);
  });

  readonly mealPlanCards = computed<MealPlanCardView[]>(() => {
    const plans = this.mealPlansSignal();
    const allResults = this.results();
    const recipes = this.recipesDbSignal();
    const cat = this.catalogue();
    const aliases = this.ingredientAliasesSignal();

    return plans.map((plan) => {
      const planRecipes = plan.recipeIds
        .map(id => allResults.find(r => r.id === id))
        .filter((r): r is RecipeResult => !!r);

      const dbRecipes = plan.recipeIds
        .map(id => recipes.find(r => r.id === id))
        .filter((r): r is RecipeDbItem => !!r);

      const prodMap = new Map<string, ApiProduct>();
      for (const r of dbRecipes) {
        for (const ing of r.ingredients) {
          const p = matchCatalogueProduct(ing.name, cat, ing.product, aliases);
          if (p) prodMap.set(p._id || p.slug, p);
        }
      }
      const matchedProducts = Array.from(prodMap.values());
      const originalTotal = matchedProducts.reduce((s, p) => s + (p.priceNumber || 0), 0);
      const dealTotal = Math.round((originalTotal * (100 - plan.discountPercent)) / 100 / 1000) * 1000;
      const saved = Math.max(0, originalTotal - dealTotal);

      return {
        ...plan,
        image: plan.image || dbRecipes[0]?.image || this.heroConfig().fallbackFoodImage || '',
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
    const budget = this.budgetLimit();
    let list = [...this.results()];

    // 0. Budget limit filter (strictly by displayed Deal cost for the selected servings)
    if (budget && budget > 0) {
      list = list.filter((r) => this.dealCost(r) <= budget);
    }

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
    const emptySched: DayMealPlanMap = { breakfast: '', lunch: '', dinner: '', snack: '' };
    const sched = (isSingle ? this.singleDaySchedule() : (this.weeklySchedule()[dayKey] || this.weeklySchedule()['mon'])) || emptySched;
    const filtered = this.results();
    const all = this.allComputedRecipes();
    const lookupPool = filtered.length > 0 ? filtered : all;
    const activeMetas = this.getActiveSlotMetas();
    const weights = this.getMealSlotWeights(activeMetas);
    const targetKcal = Math.max(1000, this.targetDailyKcal());
    const count = activeMetas.length;

    const slots: MealSlotView[] = activeMetas.map((meta) => {
      const rec =
        filtered.find((r) => r.id === sched[meta.key]) ||
        all.find((r) => r.id === sched[meta.key]) ||
        lookupPool[0] ||
        null;
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
            const pKey = ing.product.slug || normalizeStr(ing.product.name) || ing.product._id;
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
      const formulaExplanation = `Dùng cho ${usedInSlots.join(' + ')} - Tổng ${agg.totalPortion}x khẩu phần (${this.servings()} người ăn) → Cần ~${agg.totalGrams}g. Quy cách gói ${p.weight || packGramSize + 'g'} → Cần mua ${neededPacks} ${this.getProductPackUnit(p)}.`;

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
    const goalCfg = this.HEALTH_GOALS.find((g) => g.id === preset);
    const dayTheme = isSingle
      ? (goalCfg?.dayTheme || '')
      : (goalCfg?.weekDayThemes?.[dayKey] || '');

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
    const dObj = this.WEEK_DAYS.find((d) => d.key === dKey) || this.WEEK_DAYS[0] || { key: dKey, label: dKey, short: dKey };
    return this.buildDayPlanView(dObj.key, `${dObj.label} (${this.mealsPerDay()} bữa/ngày)`);
  });

  readonly allWeekDaysPlans = computed<DayPlanComputedView[]>(() => {
    return this.WEEK_DAYS.map((d) => this.buildDayPlanView(d.key, d.label));
  });

  readonly weeklyPlanSummary = computed(() => {
    const days = this.allWeekDaysPlans();
    interface WeeklyProductAgg {
      product: ApiProduct;
      totalGrams: number;
      totalPortion: number;
      usedDays: Set<string>;
    }
    const prodAggMap = new Map<string, WeeklyProductAgg>();
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFiber = 0;
    for (const d of days) {
      totalCalories += d.totalCalories;
      totalProtein += d.totalProtein;
      totalFiber += d.totalFiber;
      for (const item of d.ingredientBreakdown) {
        const p = item.product;
        const pKey = p.slug || normalizeStr(p.name) || p._id;
        const existing = prodAggMap.get(pKey);
        if (existing) {
          existing.totalGrams += item.estimatedGramsNeeded || 0;
          existing.totalPortion = Math.round((existing.totalPortion + (item.totalPortionMultiplier || 0)) * 10) / 10;
          existing.usedDays.add(d.dayLabel);
        } else {
          prodAggMap.set(pKey, {
            product: p,
            totalGrams: item.estimatedGramsNeeded || 0,
            totalPortion: Math.round((item.totalPortionMultiplier || 0) * 10) / 10,
            usedDays: new Set([d.dayLabel]),
          });
        }
      }
    }
    const matchedProducts = Array.from(prodAggMap.values()).map((a) => a.product);
    const ownedMap = this.plannerOwnedIngredientIds();
    let originalPrice = 0;
    let alreadyInCartVal = 0;
    let missingOriginalPrice = 0;
    let alreadyInCartCount = 0;
    let missingCount = 0;

    const ingredientBreakdown: PlanIngredientBreakdown[] = Array.from(prodAggMap.values()).map((agg) => {
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
      const missingDeal = Math.round((missingOriginal * 0.8) / 1000) * 1000;

      originalPrice += totalPrice;
      alreadyInCartVal += inCartValue;
      missingOriginalPrice += missingOriginal;
      if (effectiveInCart > 0) alreadyInCartCount++;
      if (missingPacks > 0) missingCount++;

      const usedInSlots = Array.from(agg.usedDays);
      const formulaExplanation = `Dùng trong ${usedInSlots.join(', ')} - Tổng ${agg.totalPortion}x khẩu phần (${this.servings()} người ăn) → Cần ~${agg.totalGrams}g. Quy cách ${p.weight || packGramSize + 'g'} → Cần mua ${neededPacks} ${this.getProductPackUnit(p)}.`;

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

  setPlannerMode(mode: 'day' | 'week'): void {
    this.plannerMode.set(mode);
    if (mode === 'day') {
      this.weeklyOverviewMode.set(false);
    }
    this.saveOnboardingStateToStorage();
    this.schedulePlanRefresh();
  }

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
    this.saveOnboardingStateToStorage();
    this.computeRecipes();
    if (this.nutritionView() === 'result' && this.onboardingCompleted()) {
      this.generateSmartPlan(false, true);
    }
  }

  setExcludeIngredients(value: string): void {
    this.excludeIngredients.set(value);
    this.saveOnboardingStateToStorage();
    if (this.nutritionView() === 'onboarding') {
      this.computeRecipes();
    } else {
      this.findRecipes();
    }
  }

  getMacroPercent(actual: number, target: number): number {
    if (!target || target <= 0) return 100;
    return Math.min(100, Math.round((actual / target) * 100));
  }

  setStep(step: 1 | 2 | 3 | 4 | 5): void {
    this.goToOnboardingStep(step);
  }

  startOnboarding(step: 1 | 2 | 3 | 4 | 5 = 1): void {
    this.onboardingStep.set(step);
    this.nutritionView.set('onboarding');
    this.saveOnboardingStateToStorage();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: 'onboarding', step },
      queryParamsHandling: 'merge',
    });
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById('meal-planner-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 50);
    }
  }

  goToOnboardingStep(step: 1 | 2 | 3 | 4 | 5): void {
    this.onboardingStep.set(step);
    this.nutritionView.set('onboarding');
    this.saveOnboardingStateToStorage();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: 'onboarding', step },
      queryParamsHandling: 'merge',
    });
  }

  nextOnboardingStep(): void {
    const current = this.onboardingStep();
    if (current < 5) {
      const next = (current + 1) as 1 | 2 | 3 | 4 | 5;
      this.goToOnboardingStep(next);
    } else {
      this.completeOnboarding();
    }
  }

  prevOnboardingStep(): void {
    const current = this.onboardingStep();
    if (current > 1) {
      const prev = (current - 1) as 1 | 2 | 3 | 4 | 5;
      this.goToOnboardingStep(prev);
    } else {
      const targetView = this.onboardingCompleted() ? 'result' : 'landing';
      this.nutritionView.set(targetView);
      this.saveOnboardingStateToStorage();
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { view: targetView === 'result' ? 'result' : null, step: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  completeOnboarding(): void {
    if (this.macroInputTimer) {
      clearTimeout(this.macroInputTimer);
      this.macroInputTimer = undefined;
    }
    this.onboardingCompleted.set(true);
    this.nutritionView.set('result');
    this.saveOnboardingStateToStorage();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: 'result', step: null },
      queryParamsHandling: 'merge',
    });
    this.generateSmartPlan(true, true);
  }

  selectGoalOption(preset: 'eatclean' | 'protein' | 'family' | 'yogurt_detox'): void {
    if (this.plannerPreset() !== preset) {
      this.applyPlannerPreset(preset, this.nutritionView() !== 'onboarding');
    }
    this.saveOnboardingStateToStorage();
  }

  saveOnboardingStateToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const payload = {
        plannerPreset: this.plannerPreset(),
        plannerMode: this.plannerMode(),
        mealsPerDay: this.mealsPerDay(),
        servings: this.servings(),
        targetDailyKcal: this.targetDailyKcal(),
        targetProtein: this.targetProtein(),
        targetFiber: this.targetFiber(),
        targetCarbs: this.targetCarbs(),
        budgetLimit: this.budgetLimit(),
        excludeIngredients: this.excludeIngredients(),
        onboardingStep: this.onboardingStep(),
        onboardingCompleted: this.onboardingCompleted(),
        singleDaySchedule: this.singleDaySchedule(),
        weeklySchedule: this.weeklySchedule(),
      };
      localStorage.setItem('evergreen_nutrition_onboarding_v1', JSON.stringify(payload));
    } catch (_) { }
  }

  private restoreOnboardingStateFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem('evergreen_nutrition_onboarding_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (['eatclean', 'protein', 'family', 'yogurt_detox'].includes(parsed.plannerPreset)) {
          this.applyPlannerPreset(parsed.plannerPreset, false);
        }
        if (parsed.plannerMode === 'day' || parsed.plannerMode === 'week') {
          this.plannerMode.set(parsed.plannerMode);
        }
        if (parsed.mealsPerDay === 2 || parsed.mealsPerDay === 3 || parsed.mealsPerDay === 4) {
          this.mealsPerDay.set(parsed.mealsPerDay);
        }
        if (Number.isFinite(Number(parsed.servings))) {
          this.servings.set(Math.max(1, Math.min(20, Math.round(Number(parsed.servings)))));
        }
        if (Number.isFinite(Number(parsed.targetDailyKcal))) {
          this.targetDailyKcal.set(
            Math.max(1000, Math.min(2800, Math.round(Number(parsed.targetDailyKcal) / 50) * 50))
          );
        }
        if (Number.isFinite(Number(parsed.targetProtein))) {
          this.targetProtein.set(Math.max(20, Math.min(240, Math.round(Number(parsed.targetProtein)))));
        }
        if (Number.isFinite(Number(parsed.targetFiber))) {
          this.targetFiber.set(Math.max(10, Math.min(60, Math.round(Number(parsed.targetFiber)))));
        }
        if (Number.isFinite(Number(parsed.targetCarbs))) {
          this.targetCarbs.set(Math.max(40, Math.min(300, Math.round(Number(parsed.targetCarbs)))));
        }
        if (
          parsed.budgetLimit === null ||
          parsed.budgetLimit === 150000 ||
          parsed.budgetLimit === 250000 ||
          parsed.budgetLimit === 400000
        ) {
          this.budgetLimit.set(parsed.budgetLimit);
        }
        if (typeof parsed.excludeIngredients === 'string') {
          this.excludeIngredients.set(parsed.excludeIngredients);
        }
        if ([1, 2, 3, 4, 5].includes(parsed.onboardingStep)) {
          this.onboardingStep.set(parsed.onboardingStep);
        }
        if (typeof parsed.onboardingCompleted === 'boolean') {
          this.onboardingCompleted.set(parsed.onboardingCompleted);
          if (parsed.onboardingCompleted) {
            this.smartPlanConfigured.set(true);
          }
        }
        if (parsed.singleDaySchedule && typeof parsed.singleDaySchedule === 'object') {
          this.singleDaySchedule.set(parsed.singleDaySchedule);
        }
        if (parsed.weeklySchedule && typeof parsed.weeklySchedule === 'object') {
          this.weeklySchedule.set(parsed.weeklySchedule);
        }
      }
    } catch (_) { }
  }

  resetOnboardingPlan(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem('evergreen_nutrition_onboarding_v1');
      } catch (_) { }
    }
    this.onboardingCompleted.set(false);
    this.smartPlanConfigured.set(false);
    this.nutritionView.set('landing');
    this.budgetLimit.set(null);
    this.excludeIngredients.set('');
    this.applyPlannerPreset('protein', false);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: null, step: null },
      queryParamsHandling: 'merge',
    });
    this.addedToCart.set('Đã đặt lại thiết lập. Bạn có thể bắt đầu lên thực đơn mới bất kỳ lúc nào.');
    setTimeout(() => this.addedToCart.set(null), 3500);
  }

  getPresetLabel(preset?: string): string {
    const p = preset || this.plannerPreset();
    return this.HEALTH_GOALS.find((g) => g.id === p)?.title || '';
  }

  getPresetDescription(preset?: string): string {
    const p = preset || this.plannerPreset();
    return this.HEALTH_GOALS.find((g) => g.id === p)?.subtitle || '';
  }

  getPresetBadge(preset?: string): string {
    const p = preset || this.plannerPreset();
    return this.HEALTH_GOALS.find((g) => g.id === p)?.badge || '';
  }

  getPresetSummaryText(preset?: string): string {
    const p = preset || this.plannerPreset();
    return this.HEALTH_GOALS.find((g) => g.id === p)?.metrics || '';
  }

  applyPlannerPreset(
    preset: 'eatclean' | 'protein' | 'family' | 'yogurt_detox',
    runGenerate: boolean = true
  ): void {
    this.plannerPreset.set(preset);
    const goalCfg = this.HEALTH_GOALS.find((g) => g.id === preset);
    if (goalCfg) {
      this.mealsPerDay.set(goalCfg.mealsPerDay);
      this.targetDailyKcal.set(goalCfg.targetDailyKcal);
      this.targetProtein.set(goalCfg.targetProtein);
      this.targetFiber.set(goalCfg.targetFiber);
      this.targetCarbs.set(goalCfg.targetCarbs);
      this.priorityNutrients.set([...(goalCfg.priorityNutrients || [])]);
      if (goalCfg.defaultSingleDaySchedule) {
        this.singleDaySchedule.set(goalCfg.defaultSingleDaySchedule);
      }
      if (goalCfg.weeklySchedule) {
        this.weeklySchedule.set(goalCfg.weeklySchedule);
      }
    }
    this.smartPlanConfigured.set(true);
    if (runGenerate && this.nutritionView() !== 'onboarding') {
      this.generateSmartPlan(false, false);
    }
  }

  generateSmartPlan(shouldScroll: boolean = false, showToast: boolean = true): void {
    this.computeRecipes();
    const filteredPool = this.results();
    const fullPool = this.allComputedRecipes();
    const activeSlots = this.getActiveSlotMetas();
    const minNeeded = Math.max(4, activeSlots.length);

    let pool = filteredPool;
    if (pool.length < minNeeded && fullPool.length > 0) {
      const existingIds = new Set(pool.map((r) => r.id));
      const cheapestExtras = [...fullPool]
        .filter((r) => !existingIds.has(r.id))
        .sort((a, b) => this.dealCost(a) - this.dealCost(b))
        .slice(0, minNeeded - pool.length);
      pool = [...pool, ...cheapestExtras];
    }

    if (pool.length === 0) return;
    this.smartPlanConfigured.set(true);
    const optimizedPlan = this.optimizeMealPlan(pool);
    this.singleDaySchedule.set(optimizedPlan);

    const newSchedule: Record<string, DayMealPlanMap> = {};
    const usedByEarlierDays: string[] = [];
    const previousDayPlans: DayMealPlanMap[] = [];
    this.WEEK_DAYS.forEach((day) => {
      const plan = this.optimizeMealPlan(pool, usedByEarlierDays, previousDayPlans);
      newSchedule[day.key] = plan;
      previousDayPlans.push(plan);
      for (const s of activeSlots) {
        if (plan[s.key]) usedByEarlierDays.push(plan[s.key]);
      }
    });
    this.weeklySchedule.set(newSchedule);
    if (this.onboardingCompleted()) {
      this.saveOnboardingStateToStorage();
    }
    if (showToast) {
      const modeLabel =
        this.plannerMode() === 'day'
          ? `Thực đơn Ngày (${this.mealsPerDay()} bữa)`
          : `Thực đơn Cả Tuần 7 Ngày (${this.mealsPerDay()} bữa/ngày)`;
      const budgetNote = this.budgetLimit() ? ` - Ngân sách ≤ ${this.budgetLimit()! / 1000}k/món` : '';
      this.addedToCart.set(
        `Đã thiết lập ${modeLabel} theo mục tiêu: ${this.targetDailyKcal()} kcal/ngày - Đạm ${this.targetProtein()}g - Chất xơ ${this.targetFiber()}g${budgetNote}!`
      );
      setTimeout(() => this.addedToCart.set(null), 3500);
    }

    // CHỈ cuộn mượt xuống khi người dùng chủ động nhấn nút cuối cùng
    if (shouldScroll && typeof window !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById('active-day-plan-preview');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }

  private optimizeMealPlan(
    pool: RecipeResult[],
    previouslyUsed: string[] = [],
    previousDayPlans: DayMealPlanMap[] = []
  ): DayMealPlanMap {
    const slots = this.getActiveSlotMetas();
    const weights = this.getMealSlotWeights(slots);
    const target = {
      calories: Math.max(1000, this.targetDailyKcal()),
      protein: Math.max(1, this.targetProtein()),
      fiber: Math.max(1, this.targetFiber()),
      carbs: Math.max(1, this.targetCarbs()),
    };
    const budget = this.budgetLimit();
    const priorities = this.priorityNutrients();
    const lightIds = new Set(this.plannerConfigSignal().lightRecipeIds || []);
    if (slots.length === 0) {
      return { breakfast: pool[0].id, lunch: pool[0].id, snack: pool[0].id, dinner: pool[0].id };
    }
    const recipeCandidates = pool.length <= 20
      ? pool
      : [...pool]
        .sort((a, b) => this.recipeTargetDistance(a, target, slots.length) - this.recipeTargetDistance(b, target, slots.length))
        .slice(0, 20);
    let best: RecipeResult[] = [];
    let bestScore = Number.NEGATIVE_INFINITY;
    const yesterdayPlan = previousDayPlans.length > 0 ? previousDayPlans[previousDayPlans.length - 1] : null;
    const yesterdayActiveIds = yesterdayPlan
      ? new Set(slots.map((s) => yesterdayPlan[s.key]))
      : new Set<string>();

    const evaluatePlan = (recipes: RecipeResult[]): void => {
      const totals = recipes.reduce((sum, recipe, idx) => {
        const slotKey = slots[idx]?.key || 'lunch';
        const mealWeight = weights[slotKey] || (1 / Math.max(1, slots.length));
        const slotTargetKcal = target.calories * mealWeight;
        const baseKcal = Math.max(1, recipe.calories || 420);
        const portionMultiplier = Math.round((slotTargetKcal / baseKcal) * 10) / 10;
        const dishCost = this.dealCost(recipe);
        return {
          calories: sum.calories + Math.round(baseKcal * portionMultiplier),
          protein: sum.protein + Math.round(this.parseMacroNum(recipe.macros.protein) * portionMultiplier),
          fiber: sum.fiber + Math.round(this.parseMacroNum(recipe.macros.fiber) * portionMultiplier),
          carbs: sum.carbs + Math.round(this.parseMacroNum(recipe.macros.carbs) * portionMultiplier),
          totalDishCost: sum.totalDishCost + dishCost,
          overBudgetCount: sum.overBudgetCount + (budget && budget > 0 && dishCost > budget ? 1 : 0),
        };
      }, { calories: 0, protein: 0, fiber: 0, carbs: 0, totalDishCost: 0, overBudgetCount: 0 });
      const error =
        2 * Math.abs(totals.calories - target.calories) / target.calories +
        (priorities.includes('protein') ? 3 : 2) * Math.abs(totals.protein - target.protein) / target.protein +
        (priorities.includes('fiber') ? 2.5 : 1.5) * Math.abs(totals.fiber - target.fiber) / target.fiber +
        (priorities.includes('lowcarb') ? 1.5 : 1.2) * Math.abs(totals.carbs - target.carbs) / target.carbs;
      const avgDishCost = totals.totalDishCost / Math.max(1, recipes.length);
      const budgetPenalty =
        budget && budget > 0
          ? totals.overBudgetCount * 3.5 +
          (avgDishCost > budget ? ((avgDishCost - budget) / budget) * 2.5 : (avgDishCost / budget) * 0.45)
          : 0;
      const repeats = recipes.length - new Set(recipes.map((recipe) => recipe.id)).size;

      // Penalize repeating meals across the 7-day schedule so each day of the week is distinct and varied
      const reusePenalty = recipes.reduce((sum, recipe, idx) => {
        const slotKey = slots[idx]?.key || 'lunch';
        const isLightSlot = slotKey === 'breakfast' || slotKey === 'snack';
        const weeklyCount = previouslyUsed.filter((id) => id === recipe.id).length;
        const sameSlotInWeekCount = previousDayPlans.filter((p) => p[slotKey] === recipe.id).length;
        const inYesterday = yesterdayActiveIds.has(recipe.id) ? 1.35 : 0;
        const sameSlotYesterday = yesterdayPlan && yesterdayPlan[slotKey] === recipe.id ? 2.2 : 0;
        const freqWeight = isLightSlot ? 0.35 : 0.65;
        return sum + weeklyCount * freqWeight + sameSlotInWeekCount * 0.5 + inYesterday + sameSlotYesterday;
      }, 0);

      const priorityBonus = recipes.reduce((sum, recipe, index) => {
        const text = normalizeStr(`${recipe.name} ${recipe.description} ${recipe.ingredients.map((item) => item.name).join(' ')}`);
        const lightSlot = slots[index].key === 'breakfast' || slots[index].key === 'snack';
        const slotBonus = lightSlot ? (lightIds.has(recipe.id) ? 0.35 : 0) : (lightIds.has(recipe.id) ? 0 : 0.30);
        return sum + slotBonus +
          (priorities.includes('probiotic') && (text.includes('sua chua') || text.includes('hy lap')) ? 0.08 : 0) +
          (priorities.includes('omega3') && (text.includes('ca hoi') || text.includes('bo')) ? 0.08 : 0) +
          (priorities.includes('vitamin') && (text.includes('dau tay') || text.includes('cam') || text.includes('ca rot')) ? 0.08 : 0);
      }, 0);
      const score = -error - budgetPenalty - repeats * 4.0 - reusePenalty + priorityBonus;
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
    const slotTargetKcal = target.calories / perMeal;
    const baseKcal = Math.max(1, recipe.calories || 420);
    const portionMultiplier = Math.round((slotTargetKcal / baseKcal) * 10) / 10;
    const scaledP = this.parseMacroNum(recipe.macros.protein) * portionMultiplier;
    const scaledF = this.parseMacroNum(recipe.macros.fiber) * portionMultiplier;
    const scaledC = this.parseMacroNum(recipe.macros.carbs) * portionMultiplier;
    return 0.8 * Math.abs(baseKcal - slotTargetKcal) / target.calories +
      2.0 * Math.abs(scaledP - target.protein / perMeal) / target.protein +
      1.6 * Math.abs(scaledF - target.fiber / perMeal) / target.fiber +
      1.2 * Math.abs(scaledC - target.carbs / perMeal) / target.carbs;
  }

  swapMealInSlot(slotKey: MealSlotKey, dayKey?: string): void {
    const isDayMode = this.plannerMode() === 'day';
    const all = this.results();
    if (all.length === 0) return;

    const currentSched = (isDayMode
      ? this.singleDaySchedule()
      : (this.weeklySchedule()[dayKey || this.selectedWeekDay()] || this.weeklySchedule()['mon'])) || {
      breakfast: '',
      lunch: '',
      dinner: '',
      snack: '',
    };
    const currentId = currentSched[slotKey];

    // Pick appropriate pool for snack/breakfast vs main meals
    const lightIds = new Set(this.plannerConfigSignal().lightRecipeIds || []);
    let pool = all;
    if (slotKey === 'snack' || slotKey === 'breakfast') {
      const lightPool = all.filter((r) => lightIds.has(r.id) || (r.calories || 0) <= 350);
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
    if (this.onboardingCompleted()) {
      this.saveOnboardingStateToStorage();
    }
  }

  assignRecipeToPlanner(recipe: RecipeResult): void {
    const lightIds = new Set(this.plannerConfigSignal().lightRecipeIds || []);
    const isLight = lightIds.has(recipe.id) || (recipe.calories || 0) <= 350;
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

    if (this.nutritionView() !== 'result') {
      this.onboardingCompleted.set(true);
      this.nutritionView.set('result');
    }
    this.saveOnboardingStateToStorage();

    setTimeout(() => {
      if (typeof document !== 'undefined') {
        (
          document.getElementById('active-day-plan-preview') ||
          document.getElementById('meal-planner-section')
        )?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
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
      if (s.recipe) this.recordRecentMeal(s.recipe.id, 'Đã lên thực đơn & mua gần đây');
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
    if (inCart) return 'Đang có nguyên liệu trong giỏ';
    if (this.getRecentScore(recipe) > 0) return 'Đã mua nguyên liệu gần đây';
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
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('xanhla_recent_meals_v1') : null;
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') {
        this.recentMealsMap.set(parsed);
      }
    } catch {
      this.recentMealsMap.set({});
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

  private recordRecentMeal(recipeId: string, label = 'Vừa chọn / Đã mua gần đây'): void {
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
    } catch { }
  }

  ngOnInit(): void {
    // 1. Tự động phục hồi cấu hình mục tiêu đã lưu trên localStorage
    this.restoreOnboardingStateFromStorage();

    const initialParams = this.route.snapshot.queryParamMap;
    const initialView = initialParams.get('view');
    const initialStep = initialParams.get('step');
    if (initialView === 'onboarding' || initialStep) {
      this.nutritionView.set('onboarding');
      if (initialStep && ['1', '2', '3', '4', '5'].includes(initialStep)) {
        this.onboardingStep.set(Number(initialStep) as 1 | 2 | 3 | 4 | 5);
      }
    } else if (initialView === 'landing') {
      this.nutritionView.set('landing');
    } else if (initialView === 'result') {
      this.onboardingCompleted.set(true);
      this.nutritionView.set('result');
    } else {
      // A saved plan keeps its settings, but must not open the results view by itself.
      // Show personalized results only after the user completes setup or explicitly requests view=result.
      this.nutritionView.set('landing');
    }

    this.loading.set(true);
    forkJoin({
      nutrition: this.api
        .get<{
          success: boolean;
          data: {
            hero?: NutritionHeroConfig;
            goals: GoalItem[];
            mealPlans?: MealPlanDeal[];
            ingredientAliases?: IngredientAliasItem[];
            recipeDefaults?: RecipeDefaultsConfig;
            quickSearchTags?: QuickSearchTag[];
            plannerConfig?: NutritionPlannerConfig;
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
                ingredientAliases: [] as IngredientAliasItem[],
                recipeDefaults: undefined as RecipeDefaultsConfig | undefined,
                quickSearchTags: [] as QuickSearchTag[],
                plannerConfig: undefined as NutritionPlannerConfig | undefined,
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
        if (nutrition.data.goals?.length) this.goalsSignal.set(nutrition.data.goals);
        if (nutrition.data.mealPlans?.length) this.mealPlansSignal.set(nutrition.data.mealPlans);
        if (nutrition.data.ingredientAliases?.length) {
          this.ingredientAliasesSignal.set(nutrition.data.ingredientAliases);
        }
        if (nutrition.data.recipeDefaults) {
          this.recipeDefaultsSignal.set(nutrition.data.recipeDefaults);
        }
        if (nutrition.data.quickSearchTags?.length) {
          this.quickSearchTagsSignal.set(nutrition.data.quickSearchTags);
        }
        if (nutrition.data.plannerConfig) {
          this.plannerConfigSignal.set(nutrition.data.plannerConfig);
          const dbGoals = nutrition.data.plannerConfig.healthGoals || [];
          const matchedPreset = dbGoals.find((g) => g.id === this.plannerPreset()) || dbGoals[0];
          const hasStoredOnboarding =
            typeof window !== 'undefined' &&
            !!window.localStorage?.getItem('evergreen_nutrition_onboarding_v1');
          if (!hasStoredOnboarding && matchedPreset) {
            this.applyPlannerPreset(matchedPreset.id, false);
          } else if (matchedPreset) {
            if (!this.singleDaySchedule()?.breakfast && matchedPreset.defaultSingleDaySchedule) {
              this.singleDaySchedule.set(matchedPreset.defaultSingleDaySchedule);
            }
            if (!this.weeklySchedule()?.['mon'] && matchedPreset.weeklySchedule) {
              this.weeklySchedule.set(matchedPreset.weeklySchedule);
            }
          }
        }
        if (nutrition.data.recipes?.length) {
          this.recipesDbSignal.set(nutrition.data.recipes);
        }
        this.loadRecentMealsHistory(nutrition.data.recentOrderedItems);
      } else {
        this.loadRecentMealsHistory();
      }
      if (products?.data?.length) {
        this.catalogue.set(products.data);
      }
      this.computeRecipes();
      if (this.onboardingCompleted() && this.nutritionView() === 'result') {
        const monPlan = this.weeklySchedule()?.['mon'];
        const hasPlan = monPlan && monPlan.breakfast && monPlan.lunch;
        if (!hasPlan) {
          this.generateSmartPlan(false, false);
        }
      }
      this.loading.set(false);

      // Watch query params (?recipe=... or ?plan=... or ?view=... or ?step=...)
      this.route.queryParamMap.subscribe((params) => {
        const rId = params.get('recipe');
        const pId = params.get('plan');
        const viewParam = params.get('view');
        const stepParam = params.get('step');
        if (rId) {
          this.openRecipeDetail(rId, false);
        } else if (pId) {
          this.openPlanDetail(pId, false);
        } else {
          this.selectedRecipeId.set(null);
          this.selectedPlanDetailId.set(null);

          if (viewParam === 'onboarding' || (stepParam && ['1', '2', '3', '4', '5'].includes(stepParam))) {
            this.nutritionView.set('onboarding');
            if (stepParam && ['1', '2', '3', '4', '5'].includes(stepParam)) {
              this.onboardingStep.set(Number(stepParam) as 1 | 2 | 3 | 4 | 5);
            }
          } else if (viewParam === 'result') {
            this.onboardingCompleted.set(true);
            this.nutritionView.set('result');
            this.generateSmartPlan(false, false);
          } else if (viewParam === 'landing') {
            this.nutritionView.set('landing');
          } else {
            // Returning to the plain /nutrition route always returns to the landing view.
            this.nutritionView.set('landing');
          }
        }
      });
    });
  }

  onImageError(event: Event, fallbackUrl = ''): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.dataset['fallbackApplied']) return;
    const resolvedFallback =
      fallbackUrl || this.heroConfig().fallbackFoodImage || this.recipesDbSignal()[0]?.image || '';
    if (resolvedFallback && img.src !== resolvedFallback) {
      img.dataset['fallbackApplied'] = '1';
      img.src = resolvedFallback;
    }
  }

  openRecipeDetail(recipeId: string, updateUrl = true): void {
    if (this.allComputedRecipes().length === 0) {
      this.computeRecipes();
    }
    const found =
      this.results().find(r => r.id === recipeId) ||
      this.allComputedRecipes().find(r => r.id === recipeId);
    if (found) {
      this.recordRecentMeal(recipeId, 'Vừa xem / Đã chọn gần đây');
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
      this.recordRecentMeal(rId, 'Vừa mua trong gói Combo');
    }
    this.voucher.copyCode(plan.voucherCode);
    this.addedToCart.set(
      `Đã thêm trọn bộ "${plan.name}" (${plan.matchedProducts.length} nguyên liệu, Giá Deal ${plan.dealTotalText}) và sao chép mã ${plan.voucherCode}!`
    );
    setTimeout(() => this.addedToCart.set(null), 4000);
  }

  updateServings(newVal: number | string, inputEl?: HTMLInputElement): void {
    const parsed = Number(newVal);
    const clamped = Number.isFinite(parsed) && String(newVal).trim() !== ''
      ? Math.max(1, Math.min(20, Math.round(parsed)))
      : this.servings();
    this.servings.set(clamped);
    if (inputEl && inputEl.value !== String(clamped)) {
      inputEl.value = String(clamped);
    }
    this.saveOnboardingStateToStorage();
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
    const updater = (list: RecipeResult[]) =>
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
            buyPacksOverride: undefined,
          };
        });

        return {
          ...recipe,
          servings: newServings,
          ingredients: updatedIngredients,
        };
      });

    this.results.update(updater);
    this.allComputedRecipes.update(updater);
  }

  findRecipes(): void {
    this.activePlanId.set(null);
    this.loading.set(true);
    setTimeout(() => {
      this.computeRecipes();
      this.loading.set(false);
    }, 250);
  }

  private matchesExcludedIngredient(ingredientText: string, rawTerm: string): boolean {
    const cleanTermDiacritics = lowerKeepDiacritics(rawTerm);
    const cleanTermNorm = normalizeStr(rawTerm);
    if (!cleanTermNorm || cleanTermNorm.length < 2) return false;

    const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hasDiacritics = cleanTermDiacritics !== cleanTermNorm;

    if (hasDiacritics) {
      const targetDiacritics = lowerKeepDiacritics(ingredientText);
      const rx = new RegExp(`(^|[\\s,()/.-])${escapeRx(cleanTermDiacritics)}($|[\\s,()/.-])`, 'i');
      return rx.test(targetDiacritics);
    }

    const targetNorm = normalizeStr(ingredientText);
    const rxNorm = new RegExp(`(^|[\\s,()/.-])${escapeRx(cleanTermNorm)}($|[\\s,()/.-])`, 'i');
    return rxNorm.test(targetNorm);
  }

  getBaseBudgetCost(recipe: RecipeResult): number {
    if (!recipe || !recipe.ingredients) return 0;
    const baseCost = recipe.ingredients
      .filter((i) => i.selected && !i.owned && i.product)
      .reduce((sum, i) => {
        const packGrams = parseGramWeight(i.product?.weight || i.product?.name) || 350;
        const rawGrams = parseFloat(i.amount) || 0;
        const multiplier = i.unit && i.unit.toLowerCase().includes('kg') ? 1000 : 1;
        const singleServingGrams = (rawGrams * multiplier) / Math.max(1, recipe.servings || 1);
        const baseTwoPersonGrams = singleServingGrams * 2;
        const basePacks = packGrams > 0 && baseTwoPersonGrams > 0 ? Math.max(1, Math.ceil(baseTwoPersonGrams / packGrams)) : 1;
        return sum + (i.product?.priceNumber || 0) * basePacks;
      }, 0);
    return Math.round((baseCost * 0.9) / 1000) * 1000;
  }

  private computeRecipes(priorityRecipeIds?: string[]): void {
    const selected = this.selectedGoals();
    const targets = this.goalTargets();
    const currentServings = Math.max(1, this.servings());
    const currentMeals = Math.max(1, this.mealsCount());
    const excludePhrases = this.parsedExcludeTerms();

    const recipesDb = this.recipesDbSignal();
    const goalsList = this.goalsSignal();

    const matchedRecipes = recipesDb.filter((recipe) => {
      if (excludePhrases.length > 0) {
        const hasExcluded = recipe.ingredients.some((ing) => {
          const fullIngText = `${ing.name} ${ing.product?.name || ''}`;
          return excludePhrases.some((phrase) => this.matchesExcludedIngredient(fullIngText, phrase));
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
    const aliases = this.ingredientAliasesSignal();
    const defaults = this.recipeDefaultsSignal();

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
        const matchedProd = matchCatalogueProduct(ing.name, currentCatalogue, ing.product, aliases);

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
        cookTime: recipe.cookTime || defaults?.cookTime || '',
        difficulty: recipe.difficulty || defaults?.difficulty || '',
        calories: recipe.calories || defaults?.calories || 0,
        macros: recipe.macros || defaults?.macros || { protein: '', carbs: '', fat: '', fiber: '', vitamins: '' },
        chefTips: recipe.chefTips || defaults?.chefTips || '',
        steps: recipe.steps?.length ? recipe.steps : (defaults?.steps || []),
        ingredients,
        nutritionNote: recipe.nutritionNote,
        goalsTags: recipe.goalsTags,
        goalsMet,
        explanation: explanation.length > 0 ? explanation : undefined,
      };
    });

    recipeResults.sort((a, b) => b.matchScore - a.matchScore);
    this.allComputedRecipes.set(recipeResults);

    const budget = this.budgetLimit();
    const finalResults =
      budget && budget > 0
        ? recipeResults.filter((r) => this.dealCost(r) <= budget)
        : recipeResults;

    this.results.set(finalResults);
    this.hasSearched.set(true);
  }

  private updateRecipeIngredients(recipeId: string, transform: (ing: IngredientItem, recipe: RecipeResult) => IngredientItem): void {
    const updater = (list: RecipeResult[]) =>
      list.map((recipe) => {
        if (recipe.id !== recipeId) return recipe;
        return {
          ...recipe,
          ingredients: recipe.ingredients.map((ing) => transform(ing, recipe)),
        };
      });
    this.results.update(updater);
    this.allComputedRecipes.update(updater);
  }

  toggleIngredient(recipeId: string, ingredientName: string): void {
    this.updateRecipeIngredients(recipeId, (ing) =>
      ing.name === ingredientName ? { ...ing, selected: !ing.selected } : ing
    );
  }

  toggleOwned(recipeId: string, ingredientName: string): void {
    this.updateRecipeIngredients(recipeId, (ing) =>
      ing.name === ingredientName ? { ...ing, owned: !ing.owned } : ing
    );
  }

  adjustIngredientPacks(recipeId: string, ingredientName: string, delta: number): void {
    this.updateRecipeIngredients(recipeId, (ing, recipe) => {
      if (ing.name !== ingredientName || !ing.product) return ing;
      const base = this.getIngredientMissingQty({ ...ing, selected: true, owned: false }, recipe.servings, recipe.meals);
      const maxStock = typeof ing.product.stock === 'number' && ing.product.stock > 0 ? Math.floor(ing.product.stock) : 99;
      const next = Math.max(1, Math.min(maxStock, (base || 1) + delta));
      return { ...ing, buyPacksOverride: next, selected: true };
    });
  }

  getReadyDetailIngredients(recipe: RecipeResult): IngredientItem[] {
    if (!recipe) return [];
    return recipe.ingredients.filter(
      (i) => i.owned || (i.product && this.isIngredientFullyInCart(i, recipe.servings, recipe.meals))
    );
  }

  getMissingDetailIngredients(recipe: RecipeResult): IngredientItem[] {
    if (!recipe) return [];
    return recipe.ingredients.filter(
      (i) => !i.owned && (!i.product || !this.isIngredientFullyInCart(i, recipe.servings, recipe.meals))
    );
  }

  getDisplayBuyPacks(item: IngredientItem, recipe: RecipeResult): number {
    if (!item.product) return 0;
    if (typeof item.buyPacksOverride === 'number' && item.buyPacksOverride > 0) {
      return item.buyPacksOverride;
    }
    const computed = this.getIngredientNeededPacks(item, recipe.servings, recipe.meals) - this.getCartQty(item.product);
    return Math.max(1, computed);
  }

  getDetailPackLabel(item: IngredientItem): string {
    return item.product?.weight || item.product?.packSize || '1 phần';
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
    if (typeof item.buyPacksOverride === 'number' && item.buyPacksOverride > 0) {
      return item.buyPacksOverride;
    }
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

    // Clear manual pack overrides after adding so future missing counts re-sync with cart
    this.updateRecipeIngredients(recipe.id, (ing) =>
      ing.buyPacksOverride !== undefined ? { ...ing, buyPacksOverride: undefined } : ing
    );

    // Tự động chỉ tick chọn các nguyên liệu thuộc món này (tạm bỏ tick các món khác trong giỏ)
    this.cart.selectOnlyRecipeItems(recipe.ingredients.filter(i => i.selected && !i.owned));

    this.lastAddedRecipe.set(recipe);
    this.recordRecentMeal(recipe.id, 'Vừa mua nguyên liệu món này');
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
    this.recordRecentMeal(recipe.id, 'Đang thanh toán nguyên liệu món này');

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
