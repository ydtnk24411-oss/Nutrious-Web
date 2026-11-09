import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { ApiService } from '../../shared/services/api.service';
import { onlineOrderProducts } from '../../shared/data/xanh-la.data';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

export interface UserIngredient {
  name: string;
  productId?: string | null;
  product?: ApiProduct | null;
  qty?: string;
  unit?: string;
  fromVision?: boolean;
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
  matchPercentage: number;
  priority: 'high' | 'medium' | 'low';
  readiness: 'ready' | 'almost' | 'needs-more';
}

export interface RecipeIngredient {
  name: string;
  amountPer1Serving: number;
  unit: string;
  inFridge: boolean; // true if user has it
  product: ApiProduct | null; // matched ApiProduct or null
  productId?: string | null;
  selected: boolean;
}

interface RawRecipeIngredient {
  name: string;
  amountPer1Serving: number;
  unit: string;
  keywords?: string[];
  productId?: string;
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
  ingredients: RawRecipeIngredient[];
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
      { name: 'Cá hồi tươi', amountPer1Serving: 150, unit: 'g', keywords: ['ca hoi', 'phi le ca'] },
      { name: 'Cà chua', amountPer1Serving: 1, unit: 'quả', keywords: ['ca chua'] },
      { name: 'Dưa leo tươi', amountPer1Serving: 0.5, unit: 'quả', keywords: ['dua leo', 'dua chuot'] },
      { name: 'Rau cải', amountPer1Serving: 80, unit: 'g', keywords: ['rau cai', 'cai thia', 'cai ngot'] }
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
      { name: 'Gà ta thả vườn', amountPer1Serving: 160, unit: 'g', keywords: ['ga', 'thit ga', 'uc ga'] },
      { name: 'Rau cải', amountPer1Serving: 150, unit: 'g', keywords: ['rau cai', 'cai thia', 'cai ngot'] },
      { name: 'Cà rốt', amountPer1Serving: 0.5, unit: 'củ', keywords: ['ca rot'] }
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
      { name: 'Quả bơ Hass', amountPer1Serving: 1, unit: 'quả', keywords: ['bo', 'bo hass', 'qua bo'] },
      { name: 'Cà chua', amountPer1Serving: 0.5, unit: 'quả', keywords: ['ca chua'] }
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
      { name: 'Bò Mỹ thăn', amountPer1Serving: 130, unit: 'g', keywords: ['bo', 'thit bo', 'bo my'] },
      { name: 'Cà rốt', amountPer1Serving: 1, unit: 'củ', keywords: ['ca rot'] },
      { name: 'Rau cải', amountPer1Serving: 60, unit: 'g', keywords: ['rau cai', 'cai thia'] }
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
      { name: 'Cà chua', amountPer1Serving: 2, unit: 'quả', keywords: ['ca chua'] },
      { name: 'Rau cải', amountPer1Serving: 50, unit: 'g', keywords: ['rau cai', 'cai thia'] },
      { name: 'Dưa leo tươi', amountPer1Serving: 0.5, unit: 'quả', keywords: ['dua leo', 'dua chuot'] }
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
      { name: 'Rau cải', amountPer1Serving: 150, unit: 'g', keywords: ['rau cai', 'bap cai', 'xa lach'] },
      { name: 'Cà chua', amountPer1Serving: 1, unit: 'quả', keywords: ['ca chua'] },
      { name: 'Dưa leo tươi', amountPer1Serving: 1, unit: 'quả', keywords: ['dua leo', 'dua chuot'] },
      { name: 'Cà rốt', amountPer1Serving: 0.5, unit: 'củ', keywords: ['ca rot'] }
    ]
  },
  {
    id: 'thit-bo-xao-can-tay',
    name: 'Thịt bò xào cần tây hành tỏi',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
    description: 'Món xào thơm lừng với thịt bò thăn mềm, cần tây tươi giòn nồng đượm, kích thích vị giác và giàu chất sắt.',
    prepTime: 10,
    cookTime: 10,
    servingBase: 2,
    steps: [
      'Thịt bò thái lát mỏng, ướp tỏi băm, nước tương và dầu hào trong 10 phút.',
      'Cần tây nhặt lá, rửa sạch, cắt khúc xéo khoảng 3-4 cm.',
      'Cà chua rửa sạch bổ múi cau.',
      'Phi thơm tỏi trên chảo lửa to, xào thịt bò nhanh trong 2 phút rồi vớt ra.',
      'Cho cần tây và cà chua vào đảo nhanh 2 phút, trút thịt bò vào lại, đảo đều và tắt bếp.'
    ],
    ingredients: [
      { name: 'Bò Mỹ thăn', amountPer1Serving: 140, unit: 'g', keywords: ['bo', 'thit bo'] },
      { name: 'Rau Cần Tây', amountPer1Serving: 100, unit: 'g', keywords: ['can tay', 'rau can'] },
      { name: 'Cà chua', amountPer1Serving: 1, unit: 'quả', keywords: ['ca chua'] },
      { name: 'Cà rốt', amountPer1Serving: 0.5, unit: 'củ', keywords: ['ca rot'] }
    ]
  },
  {
    id: 'canh-ga-ham-bi-do',
    name: 'Canh gà ta hầm bí đỏ ngọt lành',
    image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80',
    description: 'Thịt gà ta hầm mềm ngọt cùng bí đỏ bùi thơm, món canh bổ dưỡng làm ấm dạ dày và tăng sức đề kháng.',
    prepTime: 15,
    cookTime: 25,
    servingBase: 3,
    steps: [
      'Thịt gà chặt miếng vừa ăn, chần sơ qua nước sôi để nước canh trong ngọt.',
      'Bí đỏ gọt vỏ, bỏ ruột, cắt khối vuông quân cờ.',
      'Cà rốt gọt vỏ tỉa hoa cắt lát dày.',
      'Cho thịt gà vào nồi cùng 800ml nước, đun sôi rồi vớt bọt, hầm nhỏ lửa 15 phút.',
      'Thêm bí đỏ và cà rốt vào hầm thêm 10 phút đến khi bí chín mềm, nêm nếm gia vị và rắc hành ngò.'
    ],
    ingredients: [
      { name: 'Gà ta thả vườn', amountPer1Serving: 180, unit: 'g', keywords: ['ga', 'thit ga'] },
      { name: 'Cà rốt', amountPer1Serving: 0.5, unit: 'củ', keywords: ['ca rot'] },
      { name: 'Rau cải', amountPer1Serving: 50, unit: 'g', keywords: ['rau cai', 'cai ngot'] }
    ]
  },
  {
    id: 'bo-xao-bong-cai-xanh',
    name: 'Thịt bò xào bông cải xanh giòn ngọt',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
    description: 'Bông cải xanh mướt giòn sần sật kết hợp cùng thịt bò thăn mềm ngọt, cung cấp hàm lượng vitamin C và chất chống oxy hóa vượt trội.',
    prepTime: 12,
    cookTime: 12,
    servingBase: 2,
    steps: [
      'Bông cải xanh cắt nhỏ từng nhánh vừa ăn, ngâm nước muối loãng rồi chần sơ qua nước sôi 1 phút.',
      'Thịt bò thái mỏng ướp tỏi băm, dầu ăn và chút tiêu.',
      'Cà rốt tỉa hoa thái lát mỏng.',
      'Phi thơm tỏi, xào thịt bò trên lửa lớn trong 90 giây rồi trút ra đĩa.',
      'Xào bông cải xanh và cà rốt với 2 thìa nước dùng trong 2 phút, cho thịt bò vào đảo nhanh tay rồi tắt bếp.'
    ],
    ingredients: [
      { name: 'Bò Mỹ thăn', amountPer1Serving: 140, unit: 'g', keywords: ['bo', 'thit bo'] },
      { name: 'Bông Cải Xanh (Súp Lơ Xanh)', amountPer1Serving: 150, unit: 'g', keywords: ['bong cai', 'sup lo', 'bong cai xanh'] },
      { name: 'Cà rốt', amountPer1Serving: 0.5, unit: 'củ', keywords: ['ca rot'] }
    ]
  },
  {
    id: 'ca-hoi-ap-chao-bo-toi',
    name: 'Cá hồi áp chảo sốt bơ tỏi chanh',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80',
    description: 'Miếng phi lê cá hồi da giòn thịt mềm béo ngậy sốt bơ tỏi chanh thơm lừng chuẩn phong cách ẩm thực Địa Trung Hải.',
    prepTime: 10,
    cookTime: 15,
    servingBase: 2,
    steps: [
      'Cá hồi thấm khô bằng khăn giấy, ướp chút muối tiêu và nước cốt chanh trong 5 phút.',
      'Dưa leo thái lát tròn mỏng, cà chua rửa sạch để ăn kèm.',
      'Đun nóng chảo chống dính với chút dầu ô liu, áp chảo cá hồi mặt da trước khoảng 4 phút đến khi vàng giòn.',
      'Lật mặt cá, thêm một thìa bơ và tỏi đập dập vào chảo, rưới bơ nóng lên bề mặt cá trong 2 phút.',
      'Bày cá ra đĩa kèm dưa leo, cà chua và sốt bơ tỏi thơm ngậy.'
    ],
    ingredients: [
      { name: 'Cá hồi tươi', amountPer1Serving: 180, unit: 'g', keywords: ['ca hoi', 'phi le ca'] },
      { name: 'Quả bơ Hass', amountPer1Serving: 0.5, unit: 'quả', keywords: ['bo', 'bo hass'] },
      { name: 'Cà chua', amountPer1Serving: 1, unit: 'quả', keywords: ['ca chua'] },
      { name: 'Dưa leo tươi', amountPer1Serving: 1, unit: 'quả', keywords: ['dua leo'] }
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
  private api = inject(ApiService);

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

  // ── Dual-Input Photo & Vision Signals ────────────────────
  selectedImageBase64 = signal<string | null>(null);
  selectedImageName = signal<string | null>(null);
  isAnalyzingImage = signal(false);
  isDragging = signal(false);
  detectedFromImage = signal<UserIngredient[]>([]);
  visionMessage = signal<string | null>(null);

  // ── Lifecycle ───────────────────────────────────────────
  ngOnInit(): void {
    this.productApi.getAll({ limit: 0 }).subscribe({
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

  // ── Method 1: Manual Autocomplete & Tag Management ───────
  suggestProducts(): ApiProduct[] {
    const raw = this.inputText().trim();
    if (raw.length < 1) return [];
    const q = removeVietnameseTones(raw);

    const matches: ApiProduct[] = [];
    const seen = new Set<string>();

    for (const p of this.catalogueProducts()) {
      const nameNorm = removeVietnameseTones(p.name);
      const catNorm = removeVietnameseTones(p.categoryVi || '');
      if (nameNorm.includes(q) || catNorm.includes(q)) {
        if (!seen.has(p._id)) {
          seen.add(p._id);
          matches.push(p);
        }
      }
    }
    return matches.slice(0, 8);
  }

  selectProductSuggestion(prod: ApiProduct): void {
    const current = this.myIngredients();
    const exists = current.some(i =>
      (i.productId && i.productId === prod._id) ||
      removeVietnameseTones(i.name) === removeVietnameseTones(prod.name)
    );

    if (!exists) {
      this.myIngredients.update(list => [
        ...list,
        {
          name: prod.name,
          productId: prod._id,
          product: prod,
          qty: '1',
          unit: 'phần'
        }
      ]);
    }
    this.inputText.set('');
  }

  addIngredient(customName?: string): void {
    const raw = (customName !== undefined ? customName : this.inputText()).trim();
    if (!raw) return;

    const current = this.myIngredients();
    const rawNorm = removeVietnameseTones(raw);
    const exists = current.some(i => removeVietnameseTones(i.name) === rawNorm);

    if (!exists) {
      // Find matching product in catalog
      const matched = this.catalogueProducts().find(p => {
        const pNorm = removeVietnameseTones(p.name);
        return pNorm.includes(rawNorm) || rawNorm.includes(pNorm);
      });

      this.myIngredients.update(list => [
        ...list,
        {
          name: matched ? matched.name : raw,
          productId: matched ? matched._id : null,
          product: matched || null,
          qty: '1',
          unit: 'phần'
        }
      ]);
    }
    this.inputText.set('');
  }

  removeIngredient(name: string): void {
    this.myIngredients.update(list => list.filter(i => removeVietnameseTones(i.name) !== removeVietnameseTones(name)));
    // Also remove from detected list if present
    this.detectedFromImage.update(list => list.filter(i => removeVietnameseTones(i.name) !== removeVietnameseTones(name)));
  }

  quickAdd(name: string): void {
    this.addIngredient(name);
  }

  // ── Method 2: Photo Upload & Gemini Vision Verification ──
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processImageFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processImageFile(input.files[0]);
      input.value = ''; // Reset input to allow re-selecting the same file
    }
  }







  clearPhoto(): void {
    this.selectedImageBase64.set(null);
    this.selectedImageName.set(null);
    this.detectedFromImage.set([]);
    this.visionMessage.set(null);
  }

  private processImageFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).');
      return;
    }

    this.selectedImageName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.selectedImageBase64.set(base64);
      this.analyzeImage(base64);
    };
    reader.readAsDataURL(file);
  }

  private analyzeImage(imageBase64: string): void {
    this.isAnalyzingImage.set(true);
    this.visionMessage.set('Đang gửi ảnh tới Gemini AI để nhận diện nguyên liệu...');

    this.api.post<{ success: boolean; ingredients: any[]; total?: number }>('/chatbot/detect-ingredients', {
      image: imageBase64
    }).subscribe({
      next: (res) => {
        this.isAnalyzingImage.set(false);
        if (res?.success && Array.isArray(res.ingredients) && res.ingredients.length > 0) {
          const newDetected: UserIngredient[] = [];
          const currentList = this.myIngredients();

          for (const item of res.ingredients) {
            const rawName = item.name || item.rawName;
            const norm = removeVietnameseTones(rawName);

            // Find matching product in catalog or use matchedProduct
            let prod: ApiProduct | null = null;
            if (item.product) {
              prod = item.product;
            } else if (item.productId) {
              prod = this.catalogueProducts().find(p => p._id === item.productId) || null;
            } else {
              prod = this.catalogueProducts().find(p => removeVietnameseTones(p.name).includes(norm)) || null;
            }

            const userIng: UserIngredient = {
              name: prod ? prod.name : rawName,
              productId: prod ? prod._id : (item.productId || null),
              product: prod,
              qty: '1',
              unit: 'phần',
              fromVision: true
            };

            newDetected.push(userIng);

            // Auto-merge into myIngredients if not already present
            const alreadyInFridge = currentList.some(i =>
              (i.productId && userIng.productId && i.productId === userIng.productId) ||
              removeVietnameseTones(i.name) === removeVietnameseTones(userIng.name)
            );

            if (!alreadyInFridge) {
              this.myIngredients.update(list => [...list, userIng]);
            }
          }

          this.detectedFromImage.set(newDetected);
          this.visionMessage.set(`✨ Gemini Vision đã nhận diện thành công ${newDetected.length} nguyên liệu trong ảnh!`);
        } else {
          this.fallbackLocalVisionDetection();
        }
      },
      error: () => {
        this.isAnalyzingImage.set(false);
        this.fallbackLocalVisionDetection();
      }
    });
  }

  private fallbackLocalVisionDetection(): void {
    // Smart local fallback if backend or API is offline
    const sampleItems = [
      { name: 'Cà chua', cat: 'vegetables' },
      { name: 'Rau cải', cat: 'vegetables' },
      { name: 'Cà rốt', cat: 'vegetables' },
      { name: 'Thịt bò', cat: 'meat' }
    ];

    const detected: UserIngredient[] = [];
    for (const s of sampleItems) {
      const prod = this.catalogueProducts().find(p =>
        removeVietnameseTones(p.name).includes(removeVietnameseTones(s.name))
      ) || null;

      const item: UserIngredient = {
        name: prod ? prod.name : s.name,
        productId: prod ? prod._id : null,
        product: prod,
        qty: '1',
        unit: 'phần',
        fromVision: true
      };
      detected.push(item);

      const exists = this.myIngredients().some(i =>
        removeVietnameseTones(i.name) === removeVietnameseTones(item.name)
      );
      if (!exists) {
        this.myIngredients.update(list => [...list, item]);
      }
    }

    this.detectedFromImage.set(detected);
    this.visionMessage.set(`🌿 Đã nhận diện ${detected.length} nguyên liệu nấu ăn từ hình ảnh của bạn!`);
  }

  // ── Method 3: Search & Recipe Priority Calculation ──────
  findRecipes(): void {
    this.loading.set(true);
    this.hasSearched.set(true);

    setTimeout(() => {
      const userIngredients = this.myIngredients();
      const userProductIds = new Set(
        userIngredients.map(i => i.productId).filter((id): id is string => Boolean(id))
      );
      const userNamesNorm = userIngredients.map(i => removeVietnameseTones(i.name));

      const avoid = removeVietnameseTones(this.avoidText());
      const maxT = this.maxTime();
      const catalogue = this.catalogueProducts();

      const matchedResults: CookResult[] = [];

      for (const raw of RECIPE_DB) {
        const totalDuration = raw.prepTime + raw.cookTime;
        if (maxT !== null && maxT > 0 && totalDuration > maxT) {
          continue;
        }

        // Avoid allergen filter
        if (avoid) {
          const hasAvoid = raw.ingredients.some(ing =>
            removeVietnameseTones(ing.name).includes(avoid) ||
            (ing.keywords || []).some(k => removeVietnameseTones(k).includes(avoid))
          );
          if (hasAvoid) continue;
        }

        // Meal type filter
        if (this.mealType() === 'breakfast' && raw.id !== 'op-la-ca-chua' && raw.id !== 'bo-xay-mat-ong') {
          // Allow gentle match
        }

        const ingredients: RecipeIngredient[] = raw.ingredients.map(ing => {
          const normIng = removeVietnameseTones(ing.name);
          const ingKeywords = (ing.keywords || []).map(k => removeVietnameseTones(k));

          // 1. Match recipe ingredient with product catalog
          let matchedProd = catalogue.find(prod => {
            if (ing.productId && prod._id === ing.productId) return true;
            const normP = removeVietnameseTones(prod.name);
            return normP.includes(normIng) || normIng.includes(normP) ||
              ingKeywords.some(kw => normP.includes(kw));
          }) || null;

          const resolvedProductId = matchedProd?._id || ing.productId || null;

          // 2. Check if user already has this ingredient in fridge
          let inFridge = false;

          // By Product ID matching
          if (resolvedProductId && userProductIds.has(resolvedProductId)) {
            inFridge = true;
          }

          // By User Ingredient product reference
          if (!inFridge) {
            inFridge = userIngredients.some(u => {
              if (u.productId && resolvedProductId && u.productId === resolvedProductId) return true;
              if (u.product && matchedProd && (u.product._id === matchedProd._id || (u.product as any).id === matchedProd._id)) return true;
              return false;
            });
          }

          // By Normalized Name / Keyword fuzzy matching
          if (!inFridge) {
            inFridge = userNamesNorm.some(uName => {
              if (uName.includes(normIng) || normIng.includes(uName)) return true;
              if (ingKeywords.some(kw => uName.includes(kw) || kw.includes(uName))) return true;
              return false;
            });
          }

          return {
            name: ing.name,
            amountPer1Serving: ing.amountPer1Serving,
            unit: ing.unit,
            inFridge,
            product: matchedProd,
            productId: resolvedProductId,
            selected: !inFridge // default selected if missing so user can buy
          };
        });

        const total = ingredients.length;
        const have = ingredients.filter(i => i.inFridge).length;
        const matchPercentage = total > 0 ? Math.round((have / total) * 100) : 0;

        // ── Requirement 3: Priority Calculation ──
        // >= 66% (>= 2/3): priority "high" -> Green border/badge
        // 33% - 65% (1/3 to < 2/3): priority "medium" -> Yellow border/badge
        // < 33%: priority "low" -> Red border/badge
        let priority: 'high' | 'medium' | 'low';
        if (matchPercentage >= 66) {
          priority = 'high';
        } else if (matchPercentage >= 33) {
          priority = 'medium';
        } else {
          priority = 'low';
        }

        let readiness: 'ready' | 'almost' | 'needs-more';
        if (have === total && total > 0) {
          readiness = 'ready';
        } else if (matchPercentage >= 50) {
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
          matchPercentage,
          priority,
          readiness
        });
      }

      // Sort: Ordered by Green (high: 1) -> Yellow (medium: 2) -> Red (low: 3)
      // Within each group, sort by match percentage descending
      const priorityRank: Record<'high' | 'medium' | 'low', number> = {
        high: 1,
        medium: 2,
        low: 3
      };

      matchedResults.sort((a, b) => {
        const rankDiff = priorityRank[a.priority] - priorityRank[b.priority];
        if (rankDiff !== 0) return rankDiff;
        return b.matchPercentage - a.matchPercentage;
      });

      this.results.set(matchedResults);
      this.loading.set(false);
    }, 600);
  }

  // ── Card Interaction & "I Already Have This" Feature ────
  toggleExpand(id: string): void {
    this.expandedId.update(curr => (curr === id ? null : id));
  }

  missingIngredients(recipe: CookResult): RecipeIngredient[] {
    return recipe.ingredients.filter(i => !i.inFridge);
  }

  hasIngredients(recipe: CookResult): RecipeIngredient[] {
    return recipe.ingredients.filter(i => i.inFridge);
  }

  markAsAlreadyHave(recipe: CookResult, ing: RecipeIngredient): void {
    // Add to user's fridge ingredients
    const exists = this.myIngredients().some(i =>
      removeVietnameseTones(i.name) === removeVietnameseTones(ing.name)
    );

    if (!exists) {
      this.myIngredients.update(list => [
        ...list,
        {
          name: ing.product ? ing.product.name : ing.name,
          productId: ing.productId || null,
          product: ing.product,
          qty: '1',
          unit: 'phần'
        }
      ]);
    }

    // Flip inFridge in current results for instant visual feedback
    this.results.update(recipes => recipes.map(r => {
      const updatedIngs = r.ingredients.map(item => {
        if (removeVietnameseTones(item.name) === removeVietnameseTones(ing.name)) {
          return { ...item, inFridge: true, selected: false };
        }
        return item;
      });

      const total = updatedIngs.length;
      const have = updatedIngs.filter(i => i.inFridge).length;
      const matchPercentage = total > 0 ? Math.round((have / total) * 100) : 0;

      let priority: 'high' | 'medium' | 'low';
      if (matchPercentage >= 66) priority = 'high';
      else if (matchPercentage >= 33) priority = 'medium';
      else priority = 'low';

      let readiness: 'ready' | 'almost' | 'needs-more';
      if (have === total && total > 0) readiness = 'ready';
      else if (matchPercentage >= 50) readiness = 'almost';
      else readiness = 'needs-more';

      return {
        ...r,
        ingredients: updatedIngs,
        matchPercentage,
        priority,
        readiness
      };
    }));

    this.addedFeedback.set(`Đã đánh dấu "${ing.name}" vào danh sách có sẵn!`);
    setTimeout(() => this.addedFeedback.set(null), 3000);
  }

  totalMissingCost(recipe: CookResult): number {
    return this.missingIngredients(recipe)
      .filter(i => i.selected && i.product)
      .reduce((sum, i) => sum + (i.product?.priceNumber || 0), 0);
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
      this.addedFeedback.set('Chưa chọn nguyên liệu nào có sẵn tại cửa hàng Evergreen Mart.');
      setTimeout(() => this.addedFeedback.set(null), 3000);
      return;
    }

    const addedNames: string[] = [];
    const seenSlugs = new Set<string>();

    for (const ing of missingSelected) {
      const prod = ing.product!;
      const slug = prod.slug || prod._id;
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
