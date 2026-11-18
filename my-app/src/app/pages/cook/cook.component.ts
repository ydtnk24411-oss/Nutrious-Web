import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { ApiService } from '../../shared/services/api.service';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

export type IngredientUnit = 'g' | 'kg' | 'quả' | 'củ' | 'bó' | 'gói' | 'phần';

export interface CookUnitOption {
  value: IngredientUnit;
  label: string;
}

export interface CookQuickIngredient {
  query: string;
  label: string;
}

export interface UserIngredient {
  name: string;
  productId?: string | null;
  product?: ApiProduct | null;
  qty: number;
  unit: IngredientUnit;
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
  requiredAmount: number;
  availableAmount: number;
  missingAmount: number;
  inFridge: boolean; // true only when user's quantity covers requiredAmount
  hasPartial: boolean; // true when user has some but less than requiredAmount
  product: ApiProduct | null; // matched ApiProduct or null
  productId?: string | null;
  buyQuantity: number; // recommended packs/units to buy for missingAmount
  packLabel: string;
  isOutOfStock: boolean;
  selected: boolean;
}

interface RawRecipeIngredient {
  name: string;
  amountPer1Serving: number;
  unit: string;
  keywords?: string[];
  categoryHint?: string;
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

function removeVietnameseTones(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function normalizeKeepTones(str: string): string {
  return (str || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[()\-/,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesCookCategoryHint(
  prod: ApiProduct,
  hint: string | undefined,
  categoryHintsMap: Record<string, string[]>
): boolean | null {
  if (!hint) return null;
  const hints = categoryHintsMap[hint];
  if (!hints || hints.length === 0) return null;
  const prodCat = removeVietnameseTones(`${prod.category || ''} ${prod.categoryVi || ''}`);
  if (!prodCat) return null;
  return hints.some(h => prodCat.includes(h));
}

function containsWholePhrase(textNorm: string, phraseNorm: string): boolean {
  if (!textNorm || !phraseNorm) return false;
  if (textNorm === phraseNorm) return true;
  const escaped = phraseNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`).test(textNorm);
}

function normalizeUnit(raw?: string): IngredientUnit {
  const s = removeVietnameseTones(raw || '');
  if (s === 'kg') return 'kg';
  if (s === 'qua' || s === 'trai') return 'quả';
  if (s === 'cu') return 'củ';
  if (s === 'bo' || s === 'cay' || s === 'nhanh') return 'bó';
  if (s === 'goi' || s === 'hop' || s === 'khay' || s === 'tui' || s === 'nai' || s === 'chum') return 'gói';
  if (s === 'phan' || s === 'suat') return 'phần';
  return 'g';
}

function gramsPerCountUnit(ingName: string, unit: string, packGramsFallback = 250): number {
  const u = normalizeUnit(unit);
  const name = removeVietnameseTones(ingName);
  if (u === 'g') return 1;
  if (u === 'kg') return 1000;
  if (u === 'quả') {
    if (name.includes('bo')) return 250;
    if (name.includes('dua')) return 150;
    if (name.includes('ca chua bi')) return 20;
    if (name.includes('ca chua')) return 100;
    return 120;
  }
  if (u === 'củ') {
    if (name.includes('ca rot')) return 150;
    return 150;
  }
  if (u === 'bó') return 300;
  if (u === 'gói' || u === 'phần') return packGramsFallback;
  return 200;
}

function parseWeightString(weightStr?: string): { qty: number; unit: IngredientUnit; label: string } | null {
  const raw = String(weightStr || '').trim();
  const m = raw.match(/(\d+(?:[.,]\d+)?)\s*(kg|gr|g|qua|quả|cu|củ|bo|bó|goi|gói)/i);
  if (!m) return null;
  const qty = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = normalizeUnit(m[2]);
  return { qty, unit, label: `${qty}${unit === 'g' || unit === 'kg' ? unit : ' ' + unit}` };
}

function inferDefaultQtyUnit(name: string, prod?: ApiProduct | null): { qty: number; unit: IngredientUnit } {
  const parsed = parseWeightString(prod?.weight);
  if (parsed) return { qty: parsed.qty, unit: parsed.unit };
  const n = removeVietnameseTones(name);
  if (n.includes('ca chua bi')) return { qty: 200, unit: 'g' };
  if (n.includes('ca chua') || n.includes('dua leo') || n.includes('dua chuot')) return { qty: 2, unit: 'quả' };
  if (n.includes('bo hass') || n.includes('qua bo')) return { qty: 1, unit: 'quả' };
  if (n.includes('ca rot')) return { qty: 1, unit: 'củ' };
  if (n.includes('rau cai') || n.includes('cai thia')) return { qty: 300, unit: 'g' };
  return { qty: 200, unit: 'g' };
}

function convertQty(
  qty: number,
  fromUnit: string,
  toUnit: string,
  ingName: string,
  packGramsFallback = 250
): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const fromNorm = normalizeUnit(fromUnit);
  const toNorm = normalizeUnit(toUnit);
  if (fromNorm === toNorm) return qty;
  const fromGrams = qty * gramsPerCountUnit(ingName, fromNorm, packGramsFallback);
  const targetPerUnit = gramsPerCountUnit(ingName, toNorm, packGramsFallback);
  return targetPerUnit > 0 ? fromGrams / targetPerUnit : qty;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function isApiProductOutOfStock(p: ApiProduct | null | undefined): boolean {
  if (!p) return false;
  if (p.isActive === false) return true;
  if (p.isCombo) {
    if (p.comboStatus === 'paused' || p.comboStatus === 'hidden') return true;
    const s = typeof p.availableStock === 'number' ? p.availableStock : p.stock;
    return typeof s === 'number' && s <= 0;
  }
  return typeof p.stock === 'number' && p.stock <= 0;
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
    stock: typeof p.availableStock === 'number' ? p.availableStock : p.stock,
    availableStock: p.availableStock,
    comboStatus: p.comboStatus,
    isCombo: p.isCombo,
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
  unitOptions = signal<CookUnitOption[]>([]);

  // ── Signals ──────────────────────────────────────────────
  inputText = signal('');
  inputQty = signal<number>(200);
  inputUnit = signal<IngredientUnit>('g');
  private manualQtyEdited = false;
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
  catalogueLoading = signal(true);
  recipesDb = signal<RawRecipe[]>([]);
  recipesLoading = signal(true);
  recipesLoadError = signal<string | null>(null);
  categoryHints = signal<Record<string, string[]>>({});
  quickIngredients = signal<CookQuickIngredient[]>([]);
  failedProductImages = signal<Record<string, true>>({});
  hasSearched = signal(false);

  unmatchedIngredients = computed(() => {
    const catalogue = this.catalogueProducts();
    const recipes = this.recipesDb();
    return this.myIngredients().filter(userIng => {
      return !recipes.some(recipe =>
        recipe.ingredients.some(ing => {
          const matchedProd = this.resolveCatalogueProduct(ing, catalogue);
          const resolvedProductId = matchedProd?._id || ing.productId || null;
          return this.doesUserIngredientMatch(userIng, ing, resolvedProductId, matchedProd);
        })
      );
    });
  });

  unmatchedIngredientNames = computed(() =>
    this.unmatchedIngredients().map(i => i.name).join(', ')
  );

  // ── Dual-Input Photo & Vision Signals ────────────────────
  selectedImageBase64 = signal<string | null>(null);
  selectedImageName = signal<string | null>(null);
  isAnalyzingImage = signal(false);
  isDragging = signal(false);
  detectedFromImage = signal<UserIngredient[]>([]);
  visionMessage = signal<string | null>(null);
  visionError = signal(false);

  // ── Lifecycle ───────────────────────────────────────────
  ngOnInit(): void {
    this.catalogueLoading.set(true);
    this.productApi.getAll({ limit: 0, isCombo: 'false' }).subscribe({
      next: (res) => {
        this.catalogueProducts.set(res?.data || []);
        this.catalogueLoading.set(false);
        this.tryFinishPendingSearch();
      },
      error: () => {
        this.catalogueProducts.set([]);
        this.catalogueLoading.set(false);
        this.tryFinishPendingSearch();
      }
    });

    this.recipesLoading.set(true);
    this.recipesLoadError.set(null);
    this.api.get<{
      success: boolean;
      data?: RawRecipe[];
      config?: {
        unitOptions?: CookUnitOption[];
        categoryHints?: Record<string, string[]>;
        quickIngredients?: CookQuickIngredient[];
      };
    }>('/recipes').subscribe({
      next: (res) => {
        this.recipesDb.set(Array.isArray(res?.data) ? res.data : []);
        this.unitOptions.set(Array.isArray(res?.config?.unitOptions) ? res.config.unitOptions : []);
        this.categoryHints.set(res?.config?.categoryHints || {});
        this.quickIngredients.set(Array.isArray(res?.config?.quickIngredients) ? res.config.quickIngredients : []);
        this.recipesLoading.set(false);
        this.tryFinishPendingSearch();
      },
      error: () => {
        this.recipesDb.set([]);
        this.recipesLoading.set(false);
        this.recipesLoadError.set('Không tải được danh sách công thức từ MongoDB. Vui lòng thử lại sau.');
        this.tryFinishPendingSearch();
      }
    });
  }

  private tryFinishPendingSearch(): void {
    if (this.hasSearched() && !this.catalogueLoading() && !this.recipesLoading()) {
      this.results.set(this.computeRecipeResults());
      this.loading.set(false);
    }
  }

  scrollToInput(): void {
    if (typeof document !== 'undefined') {
      const el = document.querySelector('.xanhla-dual-input-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  onInputTextChange(value: string): void {
    this.inputText.set(value);
    if (!this.manualQtyEdited && value.trim().length >= 2) {
      const def = inferDefaultQtyUnit(value);
      this.inputQty.set(def.qty);
      this.inputUnit.set(def.unit);
    }
  }

  onManualQtyInput(raw: string | number): void {
    const val = Number(raw);
    this.manualQtyEdited = true;
    this.inputQty.set(Number.isFinite(val) && val > 0 ? val : 1);
  }

  onManualUnitChange(unit: string): void {
    this.manualQtyEdited = true;
    this.inputUnit.set(normalizeUnit(unit));
  }

  setServings(next: number): void {
    const clamped = Math.max(1, Math.min(10, Math.round(next)));
    this.servings.set(clamped);
    if (this.hasSearched()) {
      this.results.set(this.computeRecipeResults());
    }
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

  private upsertFridgeIngredient(entry: UserIngredient): void {
    const current = this.myIngredients();
    const entryNorm = removeVietnameseTones(entry.name);
    const idx = current.findIndex(i =>
      (i.productId && entry.productId && i.productId === entry.productId) ||
      removeVietnameseTones(i.name) === entryNorm
    );
    if (idx >= 0) {
      this.myIngredients.update(list => list.map((item, i) => {
        if (i !== idx) return item;
        const addedInSameUnit = convertQty(entry.qty, entry.unit, item.unit, item.name);
        return {
          ...item,
          qty: round1(item.qty + addedInSameUnit),
        };
      }));
    } else {
      this.myIngredients.update(list => [...list, entry]);
    }
    if (this.hasSearched()) {
      this.results.set(this.computeRecipeResults());
    }
  }

  selectProductSuggestion(prod: ApiProduct): void {
    const def = inferDefaultQtyUnit(prod.name, prod);
    const qty = this.manualQtyEdited ? this.inputQty() : def.qty;
    const unit = this.manualQtyEdited ? this.inputUnit() : def.unit;
    this.upsertFridgeIngredient({
      name: prod.name,
      productId: prod._id,
      product: prod,
      qty: qty > 0 ? qty : def.qty,
      unit,
    });
    this.resetManualInput();
  }

  addIngredient(customName?: string): void {
    const isQuick = customName !== undefined;
    const raw = (isQuick ? customName : this.inputText()).trim();
    if (!raw) return;

    const catalogue = this.catalogueProducts();
    const rawTone = normalizeKeepTones(raw);
    const knownRecipeIng = this.recipesDb().flatMap(r => r.ingredients).find(
      ing => normalizeKeepTones(ing.name) === rawTone
    );
    const matched = knownRecipeIng
      ? this.resolveCatalogueProduct(knownRecipeIng, catalogue)
      : this.resolveCatalogueProduct({ name: raw, amountPer1Serving: 1, unit: 'g' }, catalogue);

    const def = inferDefaultQtyUnit(matched ? matched.name : raw, matched);
    const qty = !isQuick && this.manualQtyEdited ? this.inputQty() : def.qty;
    const unit = !isQuick && this.manualQtyEdited ? this.inputUnit() : def.unit;

    this.upsertFridgeIngredient({
      name: matched ? matched.name : raw,
      productId: matched ? matched._id : null,
      product: matched,
      qty: qty > 0 ? qty : def.qty,
      unit,
    });
    if (!isQuick) {
      this.resetManualInput();
    }
  }

  private resetManualInput(): void {
    this.inputText.set('');
    this.inputQty.set(200);
    this.inputUnit.set('g');
    this.manualQtyEdited = false;
  }

  updateIngredientQty(name: string, rawVal: string | number): void {
    const parsed = Number(rawVal);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const norm = removeVietnameseTones(name);
    const nextQty = round1(parsed);
    this.myIngredients.update(list => list.map(i =>
      removeVietnameseTones(i.name) === norm ? { ...i, qty: nextQty } : i
    ));
    this.detectedFromImage.update(list => list.map(i =>
      removeVietnameseTones(i.name) === norm ? { ...i, qty: nextQty } : i
    ));
    if (this.hasSearched()) {
      this.results.set(this.computeRecipeResults());
    }
  }

  updateIngredientUnit(name: string, rawUnit: string): void {
    const unit = normalizeUnit(rawUnit);
    const norm = removeVietnameseTones(name);
    this.myIngredients.update(list => list.map(i =>
      removeVietnameseTones(i.name) === norm ? { ...i, unit } : i
    ));
    this.detectedFromImage.update(list => list.map(i =>
      removeVietnameseTones(i.name) === norm ? { ...i, unit } : i
    ));
    if (this.hasSearched()) {
      this.results.set(this.computeRecipeResults());
    }
  }

  removeIngredient(name: string): void {
    this.myIngredients.update(list => list.filter(i => removeVietnameseTones(i.name) !== removeVietnameseTones(name)));
    // Also remove from detected list if present
    this.detectedFromImage.update(list => list.filter(i => removeVietnameseTones(i.name) !== removeVietnameseTones(name)));
    if (this.hasSearched()) {
      this.results.set(this.computeRecipeResults());
    }
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
    this.visionError.set(false);
  }

  retryAnalyzeImage(): void {
    const base64 = this.selectedImageBase64();
    if (base64 && !this.isAnalyzingImage()) {
      this.analyzeImage(base64);
    }
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
    this.visionError.set(false);
    this.detectedFromImage.set([]);
    this.visionMessage.set('Đang gửi ảnh tới Gemini AI để nhận diện nguyên liệu...');

    this.api.post<{ success: boolean; ingredients?: any[]; message?: string; total?: number }>('/chatbot/detect-ingredients', {
      image: imageBase64
    }).subscribe({
      next: (res) => {
        this.isAnalyzingImage.set(false);
        if (!res?.success) {
          this.visionError.set(true);
          this.detectedFromImage.set([]);
          this.visionMessage.set(
            res?.message ||
              'Gemini hiện tại đang gặp vấn đề, không nhận diện được ảnh. Bạn đợi ít phút rồi thử lại hoặc thêm nguyên liệu thủ công nhé.'
          );
          return;
        }

        if (Array.isArray(res.ingredients) && res.ingredients.length > 0) {
          const newDetected: UserIngredient[] = [];
          const currentList = this.myIngredients();

          for (const item of res.ingredients) {
            const rawName = item.name || item.rawName;
            if (!rawName) continue;

            // Use backend scored product match; never fall back to naive substring matching across categories
            let prod: ApiProduct | null = null;
            if (item.product) {
              prod = item.product;
            } else if (item.productId) {
              prod = this.catalogueProducts().find(p => p._id === item.productId) || null;
            }

            const def = inferDefaultQtyUnit(prod ? prod.name : rawName, prod);
            const rawQty = Number(item.qty);
            const resolvedQty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : def.qty;
            const resolvedUnit = item.unit ? normalizeUnit(item.unit) : def.unit;

            const userIng: UserIngredient = {
              name: prod ? prod.name : rawName,
              productId: prod ? prod._id : (item.productId || null),
              product: prod,
              qty: resolvedQty,
              unit: resolvedUnit,
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
          this.visionMessage.set(`Gemini Vision đã nhận diện thành công ${newDetected.length} nguyên liệu trong ảnh!`);
          if (this.hasSearched()) {
            this.results.set(this.computeRecipeResults());
          }
        } else {
          this.detectedFromImage.set([]);
          this.visionMessage.set('Gemini AI không phát hiện nguyên liệu nấu ăn rõ ràng trong ảnh này. Bạn có thể chọn ảnh khác hoặc thêm thủ công bên trên.');
        }
      },
      error: (err) => {
        this.isAnalyzingImage.set(false);
        this.visionError.set(true);
        this.detectedFromImage.set([]);
        const serverMsg = err?.error?.message;
        if (serverMsg) {
          this.visionMessage.set(serverMsg);
        } else if (err?.status === 0) {
          this.visionMessage.set(
            'Không kết nối được tới máy chủ backend để gọi Gemini AI. Bạn hãy kiểm tra server đã chạy (npm run dev trong service/) hoặc đợi ít phút rồi thử lại.'
          );
        } else if (err?.status === 413) {
          this.visionMessage.set('Ảnh tải lên quá lớn (vượt giới hạn 10MB). Vui lòng chọn ảnh nhẹ hơn.');
        } else {
          this.visionMessage.set(
            'Gemini hiện tại đang gặp vấn đề, không nhận diện được ảnh. Bạn đợi ít phút rồi thử lại hoặc thêm nguyên liệu thủ công nhé.'
          );
        }
      }
    });
  }

  // ── Method 3: Search & Recipe Priority Calculation ──────
  findRecipes(): void {
    this.loading.set(true);
    this.hasSearched.set(true);

    if (
      (this.catalogueLoading() && this.catalogueProducts().length === 0) ||
      (this.recipesLoading() && this.recipesDb().length === 0)
    ) {
      return;
    }

    setTimeout(() => {
      this.results.set(this.computeRecipeResults());
      this.loading.set(false);
    }, 450);
  }

  private resolveCatalogueProduct(ing: RawRecipeIngredient, catalogue: ApiProduct[]): ApiProduct | null {
    const baseName = ing.name.replace(/\([^)]*\)/g, '').trim();
    const ingTone = normalizeKeepTones(baseName);
    const ingNorm = removeVietnameseTones(baseName);
    const kwsTone = (ing.keywords || []).map(normalizeKeepTones).filter(Boolean);
    const kwsNorm = (ing.keywords || []).map(removeVietnameseTones).filter(Boolean);

    let bestProd: ApiProduct | null = null;
    let bestScore = 0;

    for (const prod of catalogue) {
      if (prod.isCombo) continue;

      let score = 0;
      if (ing.productId && prod._id === ing.productId) {
        score = 500;
      } else {
        const prodTone = normalizeKeepTones(prod.name);
        const prodNorm = removeVietnameseTones(prodTone);

        let nameScore = 0;
        if (containsWholePhrase(prodTone, ingTone)) {
          nameScore = 150 + (prodTone.startsWith(ingTone) ? 30 : 0);
        } else {
          for (const kw of kwsTone) {
            if (containsWholePhrase(prodTone, kw)) {
              nameScore = Math.max(nameScore, 100 + kw.length * 2 + (prodTone.startsWith(kw) ? 25 : 0));
            }
          }
        }

        if (nameScore === 0) {
          if (ingNorm.length >= 4 && containsWholePhrase(prodNorm, ingNorm)) {
            nameScore = 65;
          } else {
            for (const kw of kwsNorm) {
              if (kw.length >= 4 && containsWholePhrase(prodNorm, kw)) {
                nameScore = Math.max(nameScore, 50 + kw.length);
              }
            }
          }
        }

        if (nameScore === 0) continue;

        score = nameScore;
        const catMatch = matchesCookCategoryHint(prod, ing.categoryHint, this.categoryHints());
        if (catMatch === true) score += 50;
        else if (catMatch === false) score -= 120;

        if (!isApiProductOutOfStock(prod)) score += 25;
        if (prod.image) score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestProd = prod;
      }
    }

    return bestScore >= 60 ? bestProd : null;
  }

  private doesUserIngredientMatch(
    u: UserIngredient,
    ing: RawRecipeIngredient,
    resolvedProductId: string | null,
    matchedProd: ApiProduct | null
  ): boolean {
    const idMatch = Boolean(
      (u.productId && resolvedProductId && u.productId === resolvedProductId) ||
      (u.product && matchedProd && (u.product._id === matchedProd._id || (u.product as any).id === matchedProd._id))
    );
    if (idMatch) return true;

    // Tránh ghép nhầm nếu sản phẩm user thuộc nhóm khác hẳn (vd: Bơ Sáp (fruits) với Bò Mỹ thăn (meat))
    if (u.product) {
      const userCatMatch = matchesCookCategoryHint(u.product, ing.categoryHint, this.categoryHints());
      if (userCatMatch === false) return false;
    }

    const uTone = normalizeKeepTones(u.name);
    const uNorm = removeVietnameseTones(uTone);
    const baseName = ing.name.replace(/\([^)]*\)/g, '').trim();
    const ingTone = normalizeKeepTones(baseName);
    const ingNorm = removeVietnameseTones(baseName);
    const kwsTone = (ing.keywords || []).map(normalizeKeepTones).filter(Boolean);
    const kwsNorm = (ing.keywords || []).map(removeVietnameseTones).filter(Boolean);

    if (
      containsWholePhrase(uTone, ingTone) ||
      containsWholePhrase(ingTone, uTone) ||
      kwsTone.some(kw => containsWholePhrase(uTone, kw) || (kw.length >= 4 && containsWholePhrase(kw, uTone)))
    ) {
      return true;
    }

    return (
      (uNorm.length >= 4 && (containsWholePhrase(uNorm, ingNorm) || containsWholePhrase(ingNorm, uNorm))) ||
      kwsNorm.some(kw => kw.length >= 4 && (containsWholePhrase(uNorm, kw) || (uNorm.length >= 4 && containsWholePhrase(kw, uNorm))))
    );
  }

  private computeRecipeResults(): CookResult[] {
    const userIngredients = this.myIngredients();
    const avoid = removeVietnameseTones(this.avoidText());
    const maxT = this.maxTime();
    const catalogue = this.catalogueProducts();
    const matchedResults: CookResult[] = [];

    if (userIngredients.length === 0) {
      return [];
    }

    for (const raw of this.recipesDb()) {
      const totalDuration = raw.prepTime + raw.cookTime;
      if (maxT !== null && maxT > 0 && totalDuration > maxT) {
        continue;
      }

      if (avoid) {
        const hasAvoid = raw.ingredients.some(ing =>
          removeVietnameseTones(ing.name).includes(avoid) ||
          (ing.keywords || []).some(k => removeVietnameseTones(k).includes(avoid))
        );
        if (hasAvoid) continue;
      }

      let coverageSum = 0;
      const ingredients: RecipeIngredient[] = raw.ingredients.map(ing => {
        const matchedProd = this.resolveCatalogueProduct(ing, catalogue);
        const resolvedProductId = matchedProd?._id || ing.productId || null;

        const requiredAmount = this.scaledAmount(ing.amountPer1Serving, raw.servingBase);

        // Cộng dồn tất cả nguyên liệu khớp trong tủ lạnh (quy đổi về đơn vị công thức)
        let availableAmount = 0;
        for (const u of userIngredients) {
          if (!this.doesUserIngredientMatch(u, ing, resolvedProductId, matchedProd)) continue;

          const uParsedPack = parseWeightString(u.product?.weight);
          const uPackGrams = uParsedPack ? convertQty(uParsedPack.qty, uParsedPack.unit, 'g', u.name) : 250;
          availableAmount += convertQty(u.qty, u.unit, ing.unit, ing.name, uPackGrams);
        }
        availableAmount = round1(availableAmount);

        const missingAmount = Math.max(0, round1(requiredAmount - availableAmount));
        const inFridge = missingAmount <= 0;
        const hasPartial = availableAmount > 0 && missingAmount > 0;
        const ratio = requiredAmount > 0 ? Math.min(1, availableAmount / requiredAmount) : 1;
        coverageSum += ratio;

        const outOfStock = isApiProductOutOfStock(matchedProd);
        const parsedPack = parseWeightString(matchedProd?.weight);
        let packSizeInRecipeUnit = 1;
        let packLabel = '1 phần';
        if (parsedPack) {
          const convertedPack = convertQty(parsedPack.qty, parsedPack.unit, ing.unit, ing.name);
          packSizeInRecipeUnit = convertedPack > 0 ? convertedPack : 1;
          packLabel = parsedPack.label;
        } else if (matchedProd) {
          const defPack = inferDefaultQtyUnit(matchedProd.name, matchedProd);
          const convertedDef = convertQty(defPack.qty, defPack.unit, ing.unit, ing.name);
          packSizeInRecipeUnit = convertedDef > 0 ? convertedDef : 1;
          packLabel = `${defPack.qty}${defPack.unit === 'g' || defPack.unit === 'kg' ? defPack.unit : ' ' + defPack.unit}`;
        }

        let buyQuantity = missingAmount > 0 && matchedProd && !outOfStock
          ? Math.max(1, Math.ceil(missingAmount / packSizeInRecipeUnit))
          : 0;
        if (matchedProd && typeof matchedProd.stock === 'number' && matchedProd.stock > 0) {
          buyQuantity = Math.min(buyQuantity, Math.floor(matchedProd.stock));
        }

        return {
          name: ing.name,
          amountPer1Serving: ing.amountPer1Serving,
          unit: ing.unit,
          requiredAmount,
          availableAmount,
          missingAmount,
          inFridge,
          hasPartial,
          product: matchedProd,
          productId: resolvedProductId,
          buyQuantity,
          packLabel,
          isOutOfStock: outOfStock,
          selected: !inFridge && Boolean(matchedProd) && !outOfStock && buyQuantity > 0
        };
      });

      const total = ingredients.length;
      const matchPercentage = total > 0 ? Math.round((coverageSum / total) * 100) : 0;

      // Chỉ hiển thị món ăn có mức khớp > 0%; mức đỏ chỉ áp dụng cho (0% < matchPercentage < 33%)
      if (matchPercentage <= 0) {
        continue;
      }

      let priority: 'high' | 'medium' | 'low';
      if (matchPercentage >= 66) priority = 'high';
      else if (matchPercentage >= 33) priority = 'medium';
      else priority = 'low';

      const missingCount = ingredients.filter(i => !i.inFridge).length;
      let readiness: 'ready' | 'almost' | 'needs-more';
      if (missingCount === 0 && total > 0) readiness = 'ready';
      else if (matchPercentage >= 50) readiness = 'almost';
      else readiness = 'needs-more';

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

    return matchedResults;
  }

  // ── Card Interaction & "I Already Have This" Feature ────
  toggleExpand(id: string): void {
    this.expandedId.update(curr => (curr === id ? null : id));
  }

  missingIngredients(recipe: CookResult): RecipeIngredient[] {
    return recipe.ingredients.filter(i => !i.inFridge);
  }

  hasIngredients(recipe: CookResult): RecipeIngredient[] {
    return recipe.ingredients.filter(i => i.inFridge || i.hasPartial);
  }

  markAsAlreadyHave(recipe: CookResult, ing: RecipeIngredient): void {
    const targetName = ing.product ? ing.product.name : ing.name;
    const targetUnit = normalizeUnit(ing.unit);
    const norm = removeVietnameseTones(targetName);
    const existingIdx = this.myIngredients().findIndex(i =>
      (i.productId && ing.productId && i.productId === ing.productId) ||
      removeVietnameseTones(i.name) === norm ||
      removeVietnameseTones(i.name) === removeVietnameseTones(ing.name)
    );

    if (existingIdx >= 0) {
      this.myIngredients.update(list => list.map((item, idx) =>
        idx === existingIdx
          ? { ...item, qty: ing.requiredAmount, unit: targetUnit }
          : item
      ));
    } else {
      this.myIngredients.update(list => [
        ...list,
        {
          name: targetName,
          productId: ing.productId || null,
          product: ing.product,
          qty: ing.requiredAmount,
          unit: targetUnit
        }
      ]);
    }

    this.results.set(this.computeRecipeResults());
    this.addedFeedback.set(`Đã cập nhật đủ ${ing.requiredAmount} ${ing.unit} "${ing.name}" trong bếp!`);
    setTimeout(() => this.addedFeedback.set(null), 3000);
  }

  totalMissingCost(recipe: CookResult): number {
    return this.missingIngredients(recipe)
      .filter(i => i.selected && i.product && !i.isOutOfStock && i.buyQuantity > 0)
      .reduce((sum, i) => sum + ((i.product?.priceNumber || 0) * i.buyQuantity), 0);
  }

  toggleIngredientSelect(recipeId: string, name: string): void {
    this.results.update(list => list.map(r => {
      if (r.id !== recipeId) return r;
      return {
        ...r,
        ingredients: r.ingredients.map(ing =>
          ing.name === name && !ing.isOutOfStock ? { ...ing, selected: !ing.selected } : ing
        )
      };
    }));
  }

  adjustMissingBuyQty(recipeId: string, name: string, delta: number): void {
    this.results.update(list => list.map(r => {
      if (r.id !== recipeId) return r;
      return {
        ...r,
        ingredients: r.ingredients.map(ing => {
          if (ing.name !== name || ing.isOutOfStock) return ing;
          const maxStock = typeof ing.product?.stock === 'number' && ing.product.stock > 0
            ? Math.floor(ing.product.stock)
            : 99;
          const next = Math.max(1, Math.min(maxStock, ing.buyQuantity + delta));
          return { ...ing, buyQuantity: next, selected: true };
        })
      };
    }));
  }

  addMissingToCart(recipe: CookResult): void {
    const missingSelected = this.missingIngredients(recipe).filter(
      i => i.selected && i.product && !i.isOutOfStock && i.buyQuantity > 0
    );
    if (missingSelected.length === 0) {
      this.addedFeedback.set('Chưa chọn nguyên liệu nào đang còn hàng tại Evergreen Mart.');
      setTimeout(() => this.addedFeedback.set(null), 3000);
      return;
    }

    let totalUnits = 0;
    const qtyByProdSlug = new Map<string, { prod: ApiProduct; qty: number }>();

    for (const ing of missingSelected) {
      const prod = ing.product!;
      const slug = prod.slug || prod._id;
      const existing = qtyByProdSlug.get(slug);
      if (existing) {
        existing.qty = Math.max(existing.qty, ing.buyQuantity);
      } else {
        qtyByProdSlug.set(slug, { prod, qty: ing.buyQuantity });
      }
    }

    for (const entry of qtyByProdSlug.values()) {
      this.cart.addItem(toCartProduct(entry.prod), entry.qty);
      totalUnits += entry.qty;
    }

    this.addedFeedback.set(`Đã thêm ${qtyByProdSlug.size} loại nguyên liệu (${totalUnits} phần) còn thiếu vào giỏ hàng!`);
    setTimeout(() => this.addedFeedback.set(null), 4000);
  }

  scaledAmount(amount: number, servingBase: number): number {
    const scaled = (amount * this.servings()) / (servingBase || 1);
    return Math.round(scaled * 10) / 10;
  }

  hasValidImage(url?: string): boolean {
    const clean = (url || '').trim();
    return Boolean(clean) && !this.failedProductImages()[clean];
  }

  onProductImgError(url?: string): void {
    const clean = (url || '').trim();
    if (!clean) return;
    this.failedProductImages.update(map => ({ ...map, [clean]: true }));
  }
}
