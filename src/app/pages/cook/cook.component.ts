import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { onlineOrderProducts } from '../../shared/data/xanh-la.data';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

export interface UserIngredient {
  name: string;
  qty: string;
  unit: string;
}

export interface CookResult {
  id: string;
  name: string;
  image: string;
  description: string;
  prepTime: number;
  cookTime: number;
  servingBase: number;
  steps: string[];
  ingredients: RecipeIngredient[];
  readiness: 'ready' | 'almost' | 'needs-more';
}

export interface RecipeIngredient {
  name: string;
  amountPer1Serving: number;
  unit: string;
  inFridge: boolean; // true if user has it
  product: any | null; // matched ApiProduct or null
  selected: boolean;
}

interface RawRecipe {
  id: string;
  name: string;
  image: string;
  description: string;
  prepTime: number;
  cookTime: number;
  servingBase: number;
  steps: string[];
  ingredients: { name: string; amountPer1Serving: number; unit: string }[];
}

const RECIPE_DB: RawRecipe[] = [
  {
    id: 'canh-chua-ca-hoi',
    name: 'Canh chua cá hồi thanh mát',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80',
    description: 'Vị chua thanh của me và cà chua chín mọng hòa quyện cùng từng thớ thịt cá hồi tươi mềm ngọt, bổ sung dồi dào Omega-3.',
    prepTime: 15,
    cookTime: 20,
    servingBase: 2,
    steps: [
      'Rửa sạch cá hồi với nước muối loãng và lát gừng, cắt miếng vuông vừa ăn.',
      'Cà chua rửa sạch bổ múi cau, rau thơm (ngò gai, ngò rí) rửa sạch cắt nhỏ.',
      'Phi thơm tỏi băm trên chảo, cho một nửa cà chua vào xào mềm tạo màu nước canh tự nhiên.',
      'Đổ 700ml nước đun sôi bùng, cho cá hồi vào nấu lửa vừa trong 6-8 phút.',
      'Cho phần cà chua còn lại vào, nêm nước mắm và gia vị vừa khẩu vị, rắc rau thơm rồi tắt bếp.'
    ],
    ingredients: [
      { name: 'Cá hồi tươi', amountPer1Serving: 150, unit: 'g' },
      { name: 'Cà chua', amountPer1Serving: 1, unit: 'quả' },
      { name: 'Dưa leo tươi', amountPer1Serving: 0.5, unit: 'quả' },
      { name: 'Rau cải', amountPer1Serving: 80, unit: 'g' },
    ]
  },
  {
    id: 'ga-xao-rau-cai',
    name: 'Gà ta xào rau cải thìa',
    image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80',
    description: 'Thịt gà ta săn chắc xào cùng rau cải thìa tươi giòn mọng nước, đậm đà hương tỏi thơm cho bữa cơm thanh lành.',
    prepTime: 10,
    cookTime: 15,
    servingBase: 2,
    steps: [
      'Thịt gà lọc xương hoặc thái miếng vừa ăn, ướp chút hạt nêm, tiêu và dầu hào trong 10 phút.',
      'Rau cải rửa sạch từng bẹ, ngâm nước muối loãng rồi để ráo, cắt khúc vừa miệng.',
      'Làm nóng chảo với chút dầu hạt cải, phi thơm tỏi đập dập rồi xào gà trên lửa lớn đến khi chín tới.',
      'Cho tiếp rau cải vào đảo nhanh tay khoảng 2-3 phút để giữ trọn sắc xanh và độ giòn ngọt.',
      'Rắc thêm chút tiêu đen xay rồi dọn ra đĩa thưởng thức nóng cùng cơm gạo lứt.'
    ],
    ingredients: [
      { name: 'Gà ta thả vườn', amountPer1Serving: 160, unit: 'g' },
      { name: 'Rau cải', amountPer1Serving: 150, unit: 'g' },
      { name: 'Cà rốt', amountPer1Serving: 0.5, unit: 'củ' },
    ]
  },
  {
    id: 'bo-xay-mat-ong',
    name: 'Sinh tố bơ Hass mật ong',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
    description: 'Thức uống bổ dưỡng từ bơ sáp Hass dẻo thơm quyện cùng mật ong hoa rừng nguyên chất, nạp trọn chất béo lành mạnh.',
    prepTime: 5,
    cookTime: 5,
    servingBase: 1,
    steps: [
      'Dùng dao cắt đôi quả bơ Hass theo chiều dọc, khẽ xoay nhẹ tách hạt rồi nạo lấy phần thịt sáp vàng.',
      'Cho bơ vào cối xay sinh tố cùng mật ong, chút sữa chua hoặc sữa hạt nguyên chất.',
      'Thêm một ít đá viên sạch, bật máy xay nhuyễn mịn trong 35-45 giây.',
      'Rót ra ly thưởng thức ngay để tận hưởng trọn vẹn vị béo ngậy ngọt ngào tự nhiên.'
    ],
    ingredients: [
      { name: 'Quả bơ Hass', amountPer1Serving: 1, unit: 'quả' },
      { name: 'Cà chua', amountPer1Serving: 0.5, unit: 'quả' },
    ]
  },
  {
    id: 'ca-rot-xao-thit-bo',
    name: 'Cà rốt xào thịt bò thăn mềm',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
    description: 'Thịt bò Mỹ thăn mềm ngọt xào nhanh lửa lớn cùng cà rốt đỏ giòn, giàu vitamin A và khoáng chất cho cả nhà.',
    prepTime: 12,
    cookTime: 10,
    servingBase: 2,
    steps: [
      'Thịt bò thăn thái lát mỏng ngang thớ, ướp với tỏi băm, một thìa dầu ăn và tiêu để thịt giữ độ mềm ngọt.',
      'Cà rốt nạo vỏ, thái sợi dày hoặc tỉa hoa thái lát mỏng đẹp mắt.',
      'Đun nóng chảo với chút dầu ăn, trút thịt bò vào xào nhanh lửa to trong 90 giây rồi múc ra đĩa riêng.',
      'Dùng lại chảo, cho cà rốt vào xào vừa chín tới cùng 2 thìa nước dùng để cà rốt mọng nước.',
      'Trút lại thịt bò vào chảo đảo đều thêm 30 giây, nêm nếm vừa ăn rồi rắc hành ngò thơm.'
    ],
    ingredients: [
      { name: 'Bò Mỹ thăn', amountPer1Serving: 130, unit: 'g' },
      { name: 'Cà rốt', amountPer1Serving: 1, unit: 'củ' },
      { name: 'Rau cải', amountPer1Serving: 60, unit: 'g' },
    ]
  },
  {
    id: 'op-la-ca-chua',
    name: 'Ốp la sốt cà chua thảo mộc',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80',
    description: 'Bữa sáng nhanh gọn nhưng đong đầy năng lượng với trứng ốp la lòng đào sốt cà chua đỏ tươi sánh quyện.',
    prepTime: 5,
    cookTime: 10,
    servingBase: 1,
    steps: [
      'Cà chua đỏ rửa sạch, thái hạt lựu nhỏ để nhanh mềm khi nấu sốt.',
      'Phi thơm hành tỏi băm nhỏ với dầu ô liu, cho cà chua vào đảo nhuyễn tạo sốt sánh đỏ.',
      'Nêm chút xíu muối, đường tự nhiên và tiêu đen cho tròn vị chua ngọt hài hòa.',
      'Tạo 2 khoảng trống nhỏ trong chảo sốt, khéo léo đập trứng tươi vào giữa.',
      'Đậy nắp chảo đun lửa nhỏ 2-3 phút đến khi lòng trắng vừa đông mà lòng đào vẫn sánh dẻo.'
    ],
    ingredients: [
      { name: 'Cà chua', amountPer1Serving: 2, unit: 'quả' },
      { name: 'Rau cải', amountPer1Serving: 50, unit: 'g' },
      { name: 'Dưa leo tươi', amountPer1Serving: 0.5, unit: 'quả' },
    ]
  },
  {
    id: 'salad-bap-cai-tuoi',
    name: 'Salad bắp cải thanh mát sốt mè',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80',
    description: 'Món salad giòn rụm từ rau cải tươi, dưa leo và cà chua chín mọng giúp cân bằng tiêu hóa và giữ vóc dáng thon gọn.',
    prepTime: 10,
    cookTime: 0,
    servingBase: 2,
    steps: [
      'Rau cải và bắp cải non rửa sạch, thái sợi mỏng rồi ngâm nước đá lạnh 5 phút để giữ độ giòn sần sật.',
      'Dưa leo thái lát mỏng, cà chua rửa sạch bổ đôi hoặc cắt múi cau nhỏ.',
      'Vớt rau ra để thật ráo nước rồi cho toàn bộ vào tô thủy tinh lớn.',
      'Rưới sốt mè rang hoặc sốt dầu giấm chua ngọt lên trên, trộn nhẹ tay bằng đũa.',
      'Bày ra đĩa sâu lòng và dùng ngay để cảm nhận độ tươi mát mọng nước của từng loại nông sản.'
    ],
    ingredients: [
      { name: 'Rau cải', amountPer1Serving: 150, unit: 'g' },
      { name: 'Cà chua', amountPer1Serving: 1, unit: 'quả' },
      { name: 'Dưa leo tươi', amountPer1Serving: 1, unit: 'quả' },
      { name: 'Cà rốt', amountPer1Serving: 0.5, unit: 'củ' },
    ]
  }
];

function removeVietnameseTones(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function toCartProduct(p: any): XanhLaProduct {
  return {
    id: p._id || p.id || p.slug,
    name: p.name,
    slug: p.slug?.startsWith('/') ? p.slug : `/product-page/${p.slug || p.id || 'san-pham'}`,
    price: p.price || (p.priceNumber ? p.priceNumber.toLocaleString('vi-VN') + 'đ' : '35.000đ'),
    priceNumber: p.priceNumber || 35000,
    image: p.image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
    category: (p.category as any) || 'Vegetables',
    categoryVi: p.categoryVi || 'Nông sản sạch',
    container: p.container || 'Khay',
    cutType: p.cutType || 'Tươi nguyên',
    cutting: p.cutting || 'Cắt miếng',
    packSize: p.packSize || 'Gói',
    packaging: p.packaging || 'Túi sinh học',
    preparation: p.preparation || 'Sơ chế sẵn',
    quantity: p.quantity || '1',
    ripeness: p.ripeness || 'Chín tự nhiên',
    sizeGroup: p.sizeGroup || 'Vừa',
    thickness: p.thickness || 'Vừa',
    type: p.type || 'Fresh',
    weight: p.weight || '500g',
    description: p.description || p.name,
    options: p.options || [],
  };
}

@Component({
  selector: 'app-cook',
  standalone: true,
  imports: [ShellComponent, RouterLink, CommonModule, FormsModule],
  templateUrl: './cook.component.html',
  styleUrl: './cook.component.css'
})
export class CookComponent implements OnInit {
  protected cart = inject(CartService);
  private productApi = inject(ProductApiService);

  // ── Signals ──────────────────────────────────────────────
  inputText = signal('');
  myIngredients = signal<UserIngredient[]>([]);
  servings = signal(2);
  maxTime = signal<number | null>(null);
  mealType = signal('');
  avoidText = signal('');
  loading = signal(false);
  results = signal<CookResult[]>([]);
  expandedId = signal<string | null>(null);
  addedFeedback = signal<string | null>(null);
  catalogueProducts = signal<ApiProduct[]>([]);
  hasSearched = signal(false);

  // ── Lifecycle ───────────────────────────────────────────
  ngOnInit(): void {
    this.productApi.getAll({ limit: 100 }).subscribe({
      next: (res) => {
        if (res?.data && res.data.length > 0) {
          this.catalogueProducts.set(res.data);
        } else {
          this.catalogueProducts.set(onlineOrderProducts as unknown as ApiProduct[]);
        }
      },
      error: () => {
        this.catalogueProducts.set(onlineOrderProducts as unknown as ApiProduct[]);
      }
    });
  }

  // ── Ingredients Management ──────────────────────────────
  addIngredient(customName?: string): void {
    const raw = (customName !== undefined ? customName : this.inputText()).trim();
    if (!raw) return;

    const current = this.myIngredients();
    const cleanLower = raw.toLowerCase();
    const exists = current.some(i => i.name.toLowerCase() === cleanLower);

    if (!exists) {
      this.myIngredients.update(list => [...list, { name: raw, qty: '1', unit: 'phần' }]);
    }
    this.inputText.set('');
  }

  removeIngredient(name: string): void {
    this.myIngredients.update(list => list.filter(i => i.name.toLowerCase() !== name.toLowerCase()));
  }

  suggestIngredients(): string[] {
    const q = removeVietnameseTones(this.inputText());
    if (q.length < 2) return [];

    const matchedNames = new Set<string>();
    for (const p of this.catalogueProducts()) {
      if (removeVietnameseTones(p.name).includes(q)) {
        matchedNames.add(p.name);
      }
    }
    // Also include canonical ingredients from RECIPE_DB for helpful discovery
    for (const recipe of RECIPE_DB) {
      for (const ing of recipe.ingredients) {
        if (removeVietnameseTones(ing.name).includes(q)) {
          matchedNames.add(ing.name);
        }
      }
    }

    return Array.from(matchedNames).slice(0, 8);
  }

  quickAdd(name: string): void {
    this.addIngredient(name);
  }

  // ── Recipe Search & Readiness ───────────────────────────
  findRecipes(): void {
    this.loading.set(true);
    this.hasSearched.set(true);

    setTimeout(() => {
      const userList = this.myIngredients().map(i => removeVietnameseTones(i.name));
      const avoid = removeVietnameseTones(this.avoidText());
      const maxT = this.maxTime();
      const currentServings = this.servings();
      const catalogue = this.catalogueProducts();

      const matchedResults: CookResult[] = [];

      for (const raw of RECIPE_DB) {
        const totalDuration = raw.prepTime + raw.cookTime;
        if (maxT !== null && maxT > 0 && totalDuration > maxT) {
          continue;
        }

        // Avoid ingredient filter
        if (avoid) {
          const hasAvoid = raw.ingredients.some(ing => removeVietnameseTones(ing.name).includes(avoid));
          if (hasAvoid) continue;
        }

        // Meal type filter (if specified)
        if (this.mealType() === 'breakfast' && raw.id !== 'op-la-ca-chua' && raw.id !== 'bo-xay-mat-ong') {
          // Allow flexible soft match or keep
        }

        const ingredients: RecipeIngredient[] = raw.ingredients.map(ing => {
          const normIng = removeVietnameseTones(ing.name);
          // Check if in user fridge
          const inFridge = userList.some(userIng =>
            userIng.includes(normIng) || normIng.includes(userIng)
          );

          // Fuzzy match to catalogue product
          const matchedProd = catalogue.find(prod => {
            const normProd = removeVietnameseTones(prod.name);
            return normProd.includes(normIng) || normIng.includes(normProd);
          }) || null;

          return {
            name: ing.name,
            amountPer1Serving: ing.amountPer1Serving,
            unit: ing.unit,
            inFridge,
            product: matchedProd,
            selected: !inFridge // default selected if missing so user can buy
          };
        });

        const have = ingredients.filter(i => i.inFridge).length;
        const total = ingredients.length;

        let readiness: 'ready' | 'almost' | 'needs-more';
        if (have === total && total > 0) {
          readiness = 'ready';
        } else if (total > 0 && have >= total * 0.7) {
          readiness = 'almost';
        } else {
          readiness = 'needs-more';
        }

        matchedResults.push({
          id: raw.id,
          name: raw.name,
          image: raw.image,
          description: raw.description,
          prepTime: raw.prepTime,
          cookTime: raw.cookTime,
          servingBase: raw.servingBase,
          steps: raw.steps,
          ingredients,
          readiness
        });
      }

      // Sort: ready first (1), almost (2), needs-more (3). Within group, have count desc.
      const rankMap: Record<'ready' | 'almost' | 'needs-more', number> = {
        'ready': 1,
        'almost': 2,
        'needs-more': 3
      };

      matchedResults.sort((a, b) => {
        const rankDiff = rankMap[a.readiness] - rankMap[b.readiness];
        if (rankDiff !== 0) return rankDiff;
        const haveA = a.ingredients.filter(i => i.inFridge).length;
        const haveB = b.ingredients.filter(i => i.inFridge).length;
        return haveB - haveA;
      });

      this.results.set(matchedResults);
      this.loading.set(false);
    }, 800);
  }

  // ── Card Interaction ─────────────────────────────────────
  toggleExpand(id: string): void {
    this.expandedId.update(curr => (curr === id ? null : id));
  }

  missingIngredients(recipe: CookResult): RecipeIngredient[] {
    return recipe.ingredients.filter(i => !i.inFridge);
  }

  hasIngredients(recipe: CookResult): RecipeIngredient[] {
    return recipe.ingredients.filter(i => i.inFridge);
  }

  totalMissingCost(recipe: CookResult): number {
    return this.missingIngredients(recipe)
      .filter(i => i.selected && i.product)
      .reduce((sum, i) => sum + (i.product.priceNumber || 0), 0);
  }

  toggleIngredientSelect(recipeId: string, name: string): void {
    this.results.update(list => list.map(r => {
      if (r.id !== recipeId) return r;
      return {
        ...r,
        ingredients: r.ingredients.map(ing =>
          ing.name === name ? { ...ing, selected: !ing.selected } : ing
        )
      };
    }));
  }

  addMissingToCart(recipe: CookResult): void {
    const missingSelected = this.missingIngredients(recipe).filter(i => i.selected && i.product);
    if (missingSelected.length === 0) {
      this.addedFeedback.set('Chưa chọn nguyên liệu nào có sẵn tại cửa hàng Xanh Lá.');
      setTimeout(() => this.addedFeedback.set(null), 3000);
      return;
    }

    const addedNames: string[] = [];
    const seenSlugs = new Set<string>();

    for (const ing of missingSelected) {
      const prod = ing.product;
      const slug = prod.slug || prod.id;
      if (!seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        this.cart.addItem(toCartProduct(prod), 1);
        addedNames.push(prod.name);
      }
    }

    this.addedFeedback.set(`Đã thêm ${addedNames.length} món nguyên liệu vào giỏ hàng!`);
    setTimeout(() => this.addedFeedback.set(null), 4000);
  }

  scaledAmount(amount: number, servingBase: number): number {
    const scaled = (amount * this.servings()) / (servingBase || 1);
    return Math.round(scaled * 10) / 10;
  }
}
