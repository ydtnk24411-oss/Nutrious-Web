import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError } from 'rxjs';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { ApiService } from '../../shared/services/api.service';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

export interface IngredientItem {
  name: string;
  amount: string;
  unit: string;
  product: ApiProduct | null;
  selected: boolean;
  owned: boolean;
}

export interface RecipeResult {
  id: string;
  name: string;
  image: string;
  description: string;
  matchScore: number;
  servings: number;
  prepTime: string;
  ingredients: IngredientItem[];
  nutritionNote: string;
  goalsMet: string[];
  explanation?: string[];
}

export interface RecipeDbItem {
  id: string;
  name: string;
  image: string;
  description: string;
  prepTime: string;
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

export const GOAL_ICONS: Record<string, string> = {
  protein: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8c0 2.2-1.8 4-4 4-1.1 0-2.1-.4-2.8-1.1"/><path d="M3 8c0 2.2 1.8 4 4 4 1.1 0 2.1-.4 2.8-1.1"/><path d="M12 20V4"/><path d="M8 16l4 4 4-4"/></svg>',
  fiber: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22l14-14"/><path d="M4 8l14 14"/><path d="M18 4v4"/><path d="M18 8h4"/></svg>',
  vitamin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/></svg>',
  mineral: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M12 2v20"/><path d="M2 12h20"/></svg>',
  variety: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  balance: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M4 6h16"/><path d="M4 18h16"/><path d="M12 7l4-4"/><path d="M12 7l-4-4"/><path d="M12 17l4 4"/><path d="M12 17l-4-4"/></svg>',
};

function formatProductSlug(slug?: string, id?: string): string {
  const raw = (slug || id || '').trim();
  if (!raw) return '/online-ordering';
  return raw.startsWith('/') ? raw : `/product-page/${raw}`;
}

function toCartProduct(p: ApiProduct): XanhLaProduct {
  return {
    id: p._id || p.slug,
    name: p.name,
    slug: formatProductSlug(p.slug, p._id),
    price: p.price,
    priceNumber: p.priceNumber || 0,
    image: p.image,
    category: p.categoryId,
    categoryVi: '',
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
    ['tom su', ['tom su', 'tom the']],
    ['qua bo', ['qua bo', 'avocado']],
    ['bo hass', ['qua bo', 'hass']],
    ['thit bo', ['bo bap my', 'bo than', 'bo my', 'beef']],
    ['bo my', ['bo bap my', 'bo than', 'bo my']],
    ['thit ga', ['ga ta', 'dui ga', 'chicken', 'uc ga']],
    ['ga ta', ['ga ta', 'dui ga', 'chicken']],
    ['ca rot', ['ca rot', 'carrot']],
    ['cai thia', ['cai thia', 'bok choy']],
    ['cai xanh', ['cai xanh', 'rau cai']],
    ['cai ngot', ['cai ngot', 'rau cai']],
    ['ca chua', ['ca chua', 'tomato']],
    ['ot chuong', ['ot chuong', 'bell pepper']],
    ['nam dong co', ['nam dong co', 'nam']],
    ['dau tay', ['dau tay', 'strawberry']],
    ['xoai cat', ['xoai cat', 'xoai']],
    ['sa tuoi', ['sa tuoi', 'gung tuoi']],
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

  readonly GOAL_ICONS = GOAL_ICONS;

  // Dynamic data loaded from MongoDB via /api/nutrition and /api/products
  private goalsSignal = signal<GoalItem[]>([]);
  private recipesDbSignal = signal<RecipeDbItem[]>([]);
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
  loading = signal<boolean>(false);
  results = signal<RecipeResult[]>([]);
  addedToCart = signal<string | null>(null);
  hasSearched = signal<boolean>(false);

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      nutrition: this.api
        .get<{ success: boolean; data: { goals: GoalItem[]; recipes: RecipeDbItem[] } }>('/nutrition')
        .pipe(catchError(() => of({ success: false, data: { goals: [], recipes: [] } }))),
      products: this.productApi
        .getAll({ limit: 0 })
        .pipe(catchError(() => of({ success: false, total: 0, page: 1, pages: 1, data: [] as ApiProduct[] }))),
    }).subscribe(({ nutrition, products }) => {
      if (nutrition?.data) {
        this.goalsSignal.set(nutrition.data.goals || []);
        this.recipesDbSignal.set(nutrition.data.recipes || []);
      }
      if (products?.data) {
        this.catalogue.set(products.data);
      }
      this.computeRecipes();
      this.loading.set(false);
    });
  }

  isGoalSelected(id: string): boolean {
    return this.selectedGoals().includes(id);
  }

  toggleGoal(id: string): void {
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
          const scaledAmount = originalIng.amountPer1Serving * newServings;
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
    this.loading.set(true);
    setTimeout(() => {
      this.computeRecipes();
      this.loading.set(false);
    }, 300);
  }

  private computeRecipes(): void {
    const selected = this.selectedGoals();
    const targets = this.goalTargets();
    const currentServings = Math.max(1, this.servings());
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
        matchScore = Math.min(100, Math.max(65, baseScore));

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
        const scaledAmount = ing.amountPer1Serving * currentServings;
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

      return {
        id: recipe.id,
        name: recipe.name,
        image: recipe.image,
        description: recipe.description,
        matchScore,
        servings: currentServings,
        prepTime: recipe.prepTime,
        ingredients,
        nutritionNote: recipe.nutritionNote,
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
    return recipe.ingredients
      .filter((i) => i.selected && !i.owned && i.product)
      .reduce((sum, i) => sum + (i.product?.priceNumber || 0), 0);
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

    for (const item of toAdd) {
      if (item.product) {
        this.cart.addItem(toCartProduct(item.product), 1);
      }
    }

    this.addedToCart.set(
      `Đã thêm ${toAdd.length} nguyên liệu cho món "${recipe.name}" vào giỏ hàng!`
    );
    setTimeout(() => this.addedToCart.set(null), 3500);
  }

  addSingleToCart(product: ApiProduct): void {
    this.cart.addItem(toCartProduct(product), 1);
    this.addedToCart.set(`Đã thêm "${product.name}" vào giỏ hàng!`);
    setTimeout(() => this.addedToCart.set(null), 2500);
  }
}
