import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';
import { onlineOrderProducts } from '../../shared/data/xanh-la.data';

export interface IngredientItem {
  name: string;
  amount: string;
  unit: string;
  product: ApiProduct | null; // null if not in catalogue
  selected: boolean;
  owned: boolean; // user marked as 'I have this'
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

export const GOALS: GoalItem[] = [
  { id: 'protein', label: 'Bổ sung protein', icon: '🥩', unit: 'g', min: 0, max: 200, step: 5, default: 50 },
  { id: 'fiber',   label: 'Bổ sung chất xơ', icon: '🥦', unit: 'g', min: 0, max: 50, step: 1, default: 10 },
  { id: 'vitamin', label: 'Bổ sung vitamin', icon: '🍊', unit: 'mg', min: 0, max: 500, step: 10, default: 50 },
  { id: 'mineral', label: 'Bổ sung khoáng chất', icon: '💊', unit: 'mg', min: 0, max: 1000, step: 50, default: 200 },
  { id: 'variety', label: 'Đa dạng thực phẩm', icon: '🌈', unit: '', min: 0, max: 0, step: 0, default: 0 },
  { id: 'balance', label: 'Bữa ăn cân bằng', icon: '⚖️', unit: '', min: 0, max: 0, step: 0, default: 0 },
];

export const GOAL_ICONS: Record<string, string> = {
  protein: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8c0 2.2-1.8 4-4 4-1.1 0-2.1-.4-2.8-1.1"/><path d="M3 8c0 2.2 1.8 4 4 4 1.1 0 2.1-.4 2.8-1.1"/><path d="M12 20V4"/><path d="M8 16l4 4 4-4"/></svg>',
  fiber: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22l14-14"/><path d="M4 8l14 14"/><path d="M18 4v4"/><path d="M18 8h4"/></svg>',
  vitamin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/></svg>',
  mineral: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M12 2v20"/><path d="M2 12h20"/></svg>',
  variety: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  balance: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M4 6h16"/><path d="M4 18h16"/><path d="M12 7l4-4"/><path d="M12 7l-4-4"/><path d="M12 17l4 4"/><path d="M12 17l-4-4"/></svg>',
};

export const RECIPE_DB: RecipeDbItem[] = [
  {
    id: 'ca-hoi-ap-chao',
    name: 'Cá hồi áp chảo rau xanh',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80',
    description: 'Cá hồi tươi áp chảo xém vàng thơm bơ tỏi, kèm rau xanh giòn ngọt thanh mát và dưa leo tươi mát.',
    prepTime: '20 phút',
    servingBase: 1,
    nutritionNote: 'Giàu đạm nạc chất lượng cao, axit béo Omega-3 tốt cho tim mạch và chất xơ tự nhiên.',
    goalsTags: ['protein', 'mineral', 'balance'],
    ingredients: [
      { name: 'Cá Hồi Tươi', amountPer1Serving: 150, unit: 'g' },
      { name: 'Baby Bok Choy', amountPer1Serving: 100, unit: 'g' },
      { name: 'Dưa Leo Tươi', amountPer1Serving: 1, unit: 'quả' },
    ],
  },
  {
    id: 'salad-ga-nuong',
    name: 'Salad gà nướng',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
    description: 'Ức gà nướng thảo mộc xé nhỏ, trộn cùng cà chua chín mọng và dưa leo tươi giòn thanh nhẹ.',
    prepTime: '25 phút',
    servingBase: 1,
    nutritionNote: 'Cung cấp nguồn protein nạc ít béo, dồi dào chất xơ và kali giúp giữ dáng, thanh lọc cơ thể.',
    goalsTags: ['protein', 'fiber', 'balance'],
    ingredients: [
      { name: 'Gà Ta Thả Vườn', amountPer1Serving: 150, unit: 'g' },
      { name: 'Cà Chua Đỏ', amountPer1Serving: 1, unit: 'quả' },
      { name: 'Dưa Leo Tươi', amountPer1Serving: 1, unit: 'quả' },
    ],
  },
  {
    id: 'canh-bap-cai-thit-bo',
    name: 'Canh bắp cải thịt bò',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80',
    description: 'Bắp cải tươi giòn ngọt nấu cùng thịt bò Mỹ đậm đà, bổ sung cà rốt ngọt thanh ấm bụng.',
    prepTime: '30 phút',
    servingBase: 1,
    nutritionNote: 'Cung cấp sắt hữu cơ, đạm cao cấp, vitamin C và chất xơ hỗ trợ hệ tiêu hoá.',
    goalsTags: ['protein', 'fiber', 'mineral', 'balance'],
    ingredients: [
      { name: 'Bò Mỹ Thăn', amountPer1Serving: 120, unit: 'g' },
      { name: 'Organic Heirloom Kale', amountPer1Serving: 150, unit: 'g' },
      { name: 'Cà Rốt Ngọt', amountPer1Serving: 80, unit: 'g' },
    ],
  },
  {
    id: 'bo-xay-sinh-to',
    name: 'Bơ xay sinh tố',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&q=80',
    description: 'Sinh tố bơ Hass béo ngậy kết hợp chuối tiêu thơm lừng tự nhiên, cung cấp năng lượng sảng khoái.',
    prepTime: '10 phút',
    servingBase: 1,
    nutritionNote: 'Nguồn chất béo thực vật lành mạnh không bão hoà đơn, giàu vitamin E, B6 và kali tự nhiên.',
    goalsTags: ['vitamin', 'fiber', 'variety'],
    ingredients: [
      { name: 'Quả Bơ Hass', amountPer1Serving: 1, unit: 'quả' },
      { name: 'Chuối Tiêu', amountPer1Serving: 1, unit: 'quả' },
    ],
  },
  {
    id: 'ca-rot-xao-thit-ga',
    name: 'Cà rốt xào thịt gà',
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80',
    description: 'Thịt gà mềm thơm xào cùng cà rốt tươi ngon thái sợi, gia vị vừa vặn, màu sắc bắt mắt.',
    prepTime: '20 phút',
    servingBase: 1,
    nutritionNote: 'Cực kỳ giàu beta-caroten (tiền vitamin A) sáng mắt và chất đạm phát triển cơ bắp.',
    goalsTags: ['protein', 'vitamin', 'variety'],
    ingredients: [
      { name: 'Gà Ta Thả Vườn', amountPer1Serving: 140, unit: 'g' },
      { name: 'Cà Rốt Ngọt', amountPer1Serving: 120, unit: 'g' },
    ],
  },
];

function toCartProduct(p: ApiProduct): XanhLaProduct {
  return {
    id: p._id || p.slug,
    name: p.name,
    slug: p.slug,
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
  const keywordMap: Record<string, string[]> = {
    'ca hoi': ['ca hoi', 'salmon'],
    'ga': ['ga ta', 'chicken', 'uc ga'],
    'thit ga': ['ga ta', 'chicken', 'uc ga'],
    'bo': ['bo my', 'ribeye', 'beef'],
    'thit bo': ['bo my', 'ribeye', 'beef'],
    'qua bo': ['qua bo', 'avocado'],
    'bo hass': ['qua bo', 'hass'],
    'ca rot': ['ca rot', 'carrot'],
    'bap cai': ['bap cai', 'kale', 'bok choy', 'cabbage'],
    'rau xanh': ['bok choy', 'kale', 'rau'],
    'rau cai': ['bok choy', 'kale'],
    'ca chua': ['ca chua', 'tomato'],
    'dua leo': ['dua leo', 'cucumber'],
    'chuoi': ['chuoi', 'banana'],
  };

  for (const [key, aliases] of Object.entries(keywordMap)) {
    if (target.includes(key) || key.includes(target)) {
      match = catalogue.find((p) => {
        const pNorm = normalizeStr(p.name);
        return aliases.some((a) => pNorm.includes(a));
      });
      if (match) return match;
    }
  }

  // 3. Match individual significant words
  const words = target.split(/\s+/).filter((w) => w.length >= 3);
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

  readonly GOALS = GOALS;
  readonly GOAL_ICONS = GOAL_ICONS;

  // Signals as specified
  selectedGoals = signal<string[]>([]);
  goalTargets = signal<Record<string, number>>({});
  servings = signal<number>(2);
  mealsCount = signal<number>(1);
  budgetLimit = signal<number | null>(null);
  excludeIngredients = signal<string>('');
  loading = signal<boolean>(false);
  results = signal<RecipeResult[]>([]);
  addedToCart = signal<string | null>(null);

  // Internal catalogue storage and search state
  catalogue = signal<ApiProduct[]>([]);
  hasSearched = signal<boolean>(false);

  ngOnInit(): void {
    // Convert fallback products into ApiProduct shape
    const fallbackList: ApiProduct[] = onlineOrderProducts.map((p) => ({
      _id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      priceNumber: p.priceNumber,
      image: p.image,
categoryId: '',
description: p.description,
      stock: 50,
      isActive: true,
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
      createdAt: new Date().toISOString(),
    }));

    this.catalogue.set(fallbackList);

    // Call productApi to get real catalogue
    this.productApi.getAll({ limit: 0 }).subscribe({
      next: (res) => {
        if (res && res.data && res.data.length > 0) {
          this.catalogue.set(res.data);
        }
      },
      error: () => {
        // Fallback already pre-set
      },
    });

    // Run initial search with default goals so page has lively recipes ready
    this.findRecipes();
  }

  isGoalSelected(id: string): boolean {
    return this.selectedGoals().includes(id);
  }

  toggleGoal(id: string): void {
    const goals = this.selectedGoals();
    const isSelected = goals.includes(id);
    const newGoals = isSelected ? goals.filter((g) => g !== id) : [...goals, id];
    this.selectedGoals.set(newGoals);

    // Initialize default target when selecting, remove when deselecting
    const targets = { ...this.goalTargets() };
    if (!isSelected) {
      const goal = GOALS.find((g) => g.id === id);
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
    targets[goalId] = value;
    this.goalTargets.set(targets);
  }

  getGoalUnit(goalId: string): string {
    const goal = GOALS.find((g) => g.id === goalId);
    return goal?.unit || '';
  }

  hasNumericTarget(goalId: string): boolean {
    const goal = GOALS.find((g) => g.id === goalId);
    return goal?.unit !== '';
  }

  adjustServings(recipeId: string, delta: number): void {
    this.results.update((list) =>
      list.map((recipe) => {
        if (recipe.id !== recipeId) return recipe;

        const newServings = Math.max(1, Math.min(10, recipe.servings + delta));
        const currentCatalogue = this.catalogue();

        // Recalculate ingredient amounts
        const updatedIngredients = recipe.ingredients.map((ing) => {
          const originalRecipe = RECIPE_DB.find((r) => r.id === recipeId);
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
      const selected = this.selectedGoals();
      const targets = this.goalTargets();
      const currentServings = Math.max(1, this.servings());
      const excludeRaw = normalizeStr(this.excludeIngredients());
      const excludeKeywords = excludeRaw
        ? excludeRaw.split(/[,;\s]+/).map((s) => s.trim()).filter((s) => s.length >= 2)
        : [];

      // Filter RECIPE_DB where at least 1 goalsTags overlaps selectedGoals (or return all if selectedGoals is empty)
      let matchedRecipes = RECIPE_DB.filter((recipe) => {
        // Exclude ingredients filter
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

      // Compute RecipeResult[]
      const recipeResults: RecipeResult[] = matchedRecipes.map((recipe) => {
        // Match score calculation based on selected goals and numeric targets
        let matchScore = 95;
        const explanation: string[] = [];

        if (selected.length > 0) {
          const common = recipe.goalsTags.filter((g) => selected.includes(g));
          const baseScore = Math.round((common.length / selected.length) * 100);
          matchScore = Math.min(100, Math.max(65, baseScore));

          // Add explanation for each matched goal
          common.forEach((tagId) => {
            const goal = GOALS.find((g) => g.id === tagId);
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

        // Goals met labels
        const goalsMet = recipe.goalsTags
          .map((tagId) => GOALS.find((g) => g.id === tagId)?.label || tagId);

        // Scaled ingredients with catalogue matching
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

      // Sort by match score
      recipeResults.sort((a, b) => b.matchScore - a.matchScore);

      // Filter by budget if specified
      const budget = this.budgetLimit();
      const finalResults = (budget && budget > 0)
        ? recipeResults.filter((r) => this.totalCost(r) <= budget)
        : recipeResults;

      this.results.set(finalResults);
      this.hasSearched.set(true);
      this.loading.set(false);
    }, 800);
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
