import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { CookComponent } from './cook.component';
import { API_BASE } from '../../shared/services/api.service';
import { ApiProduct, ProductApiService } from '../../shared/services/product-api.service';

function makeProduct(overrides: Partial<ApiProduct>): ApiProduct {
  return {
    _id: 'prod-default',
    name: 'Sản phẩm mẫu',
    slug: 'san-pham-mau',
    price: '25.000₫',
    priceNumber: 25000,
    image: '',
    categoryId: 'cat-1',
    description: '',
    stock: 10,
    isActive: true,
    container: '',
    cutType: '',
    cutting: '',
    packSize: '',
    packaging: '',
    preparation: '',
    quantity: '',
    ripeness: '',
    sizeGroup: '',
    thickness: '',
    type: '',
    weight: '500g',
    createdAt: '2026-11-12T00:00:00.000Z',
    ...overrides,
  };
}

const MOCK_RECIPES_RESPONSE = {
  success: true,
  total: 4,
  data: [
    {
      id: 'canh-chua-ca-hoi',
      name: 'Canh chua cá hồi thanh mát',
      image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80',
      description: 'Vị chua thanh của me và cà chua chín mọng.',
      prepTime: 15,
      cookTime: 20,
      servingBase: 2,
      steps: ['Sơ chế cá hồi và cà chua.', 'Nấu canh chín vừa ăn.'],
      ingredients: [
        { name: 'Cá hồi tươi', amountPer1Serving: 150, unit: 'g', categoryHint: 'seafood', keywords: ['cá hồi', 'phi lê cá hồi'] },
        { name: 'Cà chua', amountPer1Serving: 1, unit: 'quả', categoryHint: 'vegetables', keywords: ['cà chua', 'cà chua bi'] },
        { name: 'Dưa leo tươi', amountPer1Serving: 0.5, unit: 'quả', categoryHint: 'vegetables', keywords: ['dưa leo', 'dưa chuột'] },
        { name: 'Rau cải', amountPer1Serving: 80, unit: 'g', categoryHint: 'vegetables', keywords: ['rau cải', 'cải ngọt', 'cải thìa', 'cải xanh'] },
      ],
    },
    {
      id: 'bo-xay-mat-ong',
      name: 'Sinh tố bơ Hass mật ong',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
      description: 'Thức uống bổ dưỡng từ bơ sáp Hass.',
      prepTime: 5,
      cookTime: 5,
      servingBase: 1,
      steps: ['Xay nhuyễn bơ Hass cùng mật ong.'],
      ingredients: [
        { name: 'Quả bơ Hass', amountPer1Serving: 1, unit: 'quả', categoryHint: 'fruits', keywords: ['bơ', 'quả bơ', 'bơ sáp', 'bơ hass'] },
        { name: 'Cà chua', amountPer1Serving: 0.5, unit: 'quả', categoryHint: 'vegetables', keywords: ['cà chua', 'cà chua bi'] },
      ],
    },
    {
      id: 'canh-ga-ham-bi-do',
      name: 'Canh gà ta hầm bí đỏ ngọt lành',
      image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80',
      description: 'Thịt gà ta hầm mềm ngọt cùng bí đỏ.',
      prepTime: 15,
      cookTime: 25,
      servingBase: 3,
      steps: ['Hầm gà ta và bí đỏ đến khi chín mềm.'],
      ingredients: [
        { name: 'Gà ta thả vườn', amountPer1Serving: 180, unit: 'g', categoryHint: 'meat', keywords: ['gà ta', 'thịt gà', 'ức gà', 'đùi gà'] },
        { name: 'Cà rốt', amountPer1Serving: 0.5, unit: 'củ', categoryHint: 'vegetables', keywords: ['cà rốt'] },
      ],
    },
    {
      id: 'bo-xao-bong-cai-xanh',
      name: 'Thịt bò xào bông cải xanh giòn ngọt',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
      description: 'Bông cải xanh mướt kết hợp thịt bò thăn.',
      prepTime: 12,
      cookTime: 12,
      servingBase: 2,
      steps: ['Xào nhanh thịt bò và bông cải xanh.'],
      ingredients: [
        { name: 'Bò Mỹ thăn', amountPer1Serving: 140, unit: 'g', categoryHint: 'meat', keywords: ['thịt bò', 'bò mỹ', 'bò úc', 'bò'] },
        { name: 'Bông Cải Xanh (Súp Lơ Xanh)', amountPer1Serving: 150, unit: 'g', categoryHint: 'vegetables', keywords: ['bông cải xanh', 'súp lơ xanh', 'bông cải'] },
        { name: 'Cà rốt', amountPer1Serving: 0.5, unit: 'củ', categoryHint: 'vegetables', keywords: ['cà rốt'] },
      ],
    },
  ],
  config: {
    unitOptions: [
      { value: 'g', label: 'g' },
      { value: 'kg', label: 'kg' },
      { value: 'quả', label: 'quả' },
      { value: 'củ', label: 'củ' },
      { value: 'bó', label: 'bó' },
      { value: 'gói', label: 'gói' },
      { value: 'phần', label: 'phần' },
    ],
    categoryHints: {
      vegetables: ['vegetables', 'rau cu', 'rau xanh', 'cu qua', 'nam'],
      fruits: ['fruits', 'trai cay'],
      meat: ['meat', 'thit'],
      seafood: ['seafood', 'hai san', 'ca'],
    },
    quickIngredients: [
      { query: 'Cà chua', label: '+ Cà chua' },
      { query: 'Bò Mỹ thăn', label: '+ Thịt bò' },
    ],
  },
};

function flushRecipesRequest(httpMock: HttpTestingController): void {
  const req = httpMock.expectOne(`${API_BASE}/recipes`);
  expect(req.request.method).toBe('GET');
  req.flush(MOCK_RECIPES_RESPONSE);
}

describe('CookComponent', () => {
  let httpMock: HttpTestingController;

  const mockProducts: ApiProduct[] = [
    makeProduct({ _id: 'banana-1', name: 'Chuối Laba Đà Lạt Tươi', slug: 'chuoi-laba', category: 'fruits', categoryVi: 'Trái cây' }),
    makeProduct({ _id: 'seafood-1', name: 'Cá Nục Chuối Hấp Sẵn', slug: 'ca-nuc-chuoi', category: 'seafood', categoryVi: 'Cá & Hải sản' }),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CookComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ProductApiService,
          useValue: { getAll: () => of({ success: true, total: mockProducts.length, data: mockProducts }) },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match(() => true);
  });

  it('should display Gemini Vision detected banana ingredient without switching to unrelated seafood products', () => {
    const fixture = TestBed.createComponent(CookComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushRecipesRequest(httpMock);

    (component as any).selectedImageBase64.set('data:image/webp;base64,AAAA');
    (component as any).analyzeImage('data:image/webp;base64,AAAA');

    const req = httpMock.expectOne(`${API_BASE}/chatbot/detect-ingredients`);
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      ingredients: [
        {
          name: 'Chuối Laba Đà Lạt Tươi',
          rawName: 'Chuối',
          category: 'fruits',
          qty: 5,
          unit: 'quả',
          productId: 'banana-1',
          product: mockProducts[0],
        },
      ],
      total: 1,
    });
    fixture.detectChanges();

    expect((component as any).visionError()).toBeFalse();
    expect((component as any).detectedFromImage().length).toBe(1);
    expect((component as any).detectedFromImage()[0].name).toBe('Chuối Laba Đà Lạt Tươi');
    expect((component as any).detectedFromImage()[0].qty).toBe(5);
    expect((component as any).detectedFromImage()[0].unit).toBe('quả');

    const badgeText = fixture.nativeElement.querySelector('.preview-tag-badge')?.textContent;
    expect(badgeText).toContain('Đã nhận diện bởi Gemini AI');
  });

  it('should show clear error card without fake 4-ingredient fallback and allow retry when Gemini Vision API fails', () => {
    const fixture = TestBed.createComponent(CookComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushRecipesRequest(httpMock);

    (component as any).selectedImageBase64.set('data:image/webp;base64,AAAA');
    (component as any).analyzeImage('data:image/webp;base64,AAAA');

    const req = httpMock.expectOne(`${API_BASE}/chatbot/detect-ingredients`);
    req.flush(
      {
        success: false,
        code: 'GEMINI_UNAVAILABLE',
        message: 'Gemini hiện tại đang gặp vấn đề, không nhận diện được ảnh. Bạn đợi ít phút rồi thử lại nhé.',
      },
      { status: 503, statusText: 'Service Unavailable' }
    );
    fixture.detectChanges();

    expect((component as any).visionError()).toBeTrue();
    expect((component as any).detectedFromImage().length).toBe(0);
    expect((component as any).myIngredients().length).toBe(0);
    expect((component as any).visionMessage()).toBe(
      'Gemini hiện tại đang gặp vấn đề, không nhận diện được ảnh. Bạn đợi ít phút rồi thử lại nhé.'
    );

    const badge = fixture.nativeElement.querySelector('.preview-tag-badge');
    expect(badge?.classList.contains('is-error')).toBeTrue();
    expect(badge?.textContent).toContain('Kết nối Gemini AI lỗi');

    const errorCard = fixture.nativeElement.querySelector('.vision-error-card[role="alert"]');
    expect(errorCard).toBeTruthy();
    expect(errorCard.textContent).toContain('Gemini hiện tại đang gặp vấn đề, không nhận diện được ảnh');
    expect(fixture.nativeElement.querySelector('.detected-badge-count')).toBeFalsy();

    const retryBtn = errorCard.querySelector('.btn-retry-vision') as HTMLButtonElement | null;
    expect(retryBtn).toBeTruthy();
    retryBtn!.click();

    const retryReq = httpMock.expectOne(`${API_BASE}/chatbot/detect-ingredients`);
    expect(retryReq.request.method).toBe('POST');
    retryReq.flush({
      success: true,
      ingredients: [
        {
          name: 'Chuối Laba Đà Lạt Tươi',
          rawName: 'Chuối',
          category: 'fruits',
          qty: 3,
          unit: 'quả',
          productId: 'banana-1',
          product: mockProducts[0],
        },
      ],
      total: 1,
    });
    fixture.detectChanges();

    expect((component as any).visionError()).toBeFalse();
    expect((component as any).detectedFromImage().length).toBe(1);
    expect((component as any).detectedFromImage()[0].name).toBe('Chuối Laba Đà Lạt Tươi');
  });

  it('should show chef-upcoming message instead of red 0% recipe cards when ingredients match no recipe', () => {
    const fixture = TestBed.createComponent(CookComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushRecipesRequest(httpMock);

    (component as any).myIngredients.set([
      {
        name: 'Chuối Laba Đà Lạt Tươi',
        productId: 'banana-1',
        product: mockProducts[0],
        qty: 3,
        unit: 'quả',
        fromVision: true,
      },
    ]);

    const computedResults = (component as any).computeRecipeResults();
    (component as any).hasSearched.set(true);
    (component as any).results.set(computedResults);
    fixture.detectChanges();

    expect(computedResults.length).toBe(0);
    expect((component as any).unmatchedIngredients().length).toBe(1);

    const upcomingCard = fixture.nativeElement.querySelector('.xanhla-upcoming-card');
    expect(upcomingCard).toBeTruthy();
    expect(upcomingCard.textContent).toContain('Chưa có công thức phù hợp');
    expect(upcomingCard.textContent).toContain('Đầu bếp đang triển khai thêm');
    expect(fixture.nativeElement.querySelector('.xanhla-recipe-card')).toBeFalsy();
  });

  it('should classify red priority strictly for (0% < matchPercentage < 33%) and render compact card header style', () => {
    const fixture = TestBed.createComponent(CookComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushRecipesRequest(httpMock);
    fixture.detectChanges();

    expect((component as any).unitOptions().length).toBe(7);
    expect((component as any).quickIngredients().length).toBe(2);

    (component as any).myIngredients.set([
      {
        name: 'Cà chua',
        productId: null,
        product: null,
        qty: 1,
        unit: 'quả',
      },
    ]);

    const computedResults = (component as any).computeRecipeResults();
    (component as any).hasSearched.set(true);
    (component as any).results.set(computedResults);
    fixture.detectChanges();

    expect(computedResults.length).toBeGreaterThan(0);
    expect(computedResults.every((r: any) => r.matchPercentage > 0)).toBeTrue();
    const lowTier = computedResults.filter((r: any) => r.matchPercentage < 33);
    expect(lowTier.every((r: any) => r.priority === 'low')).toBeTrue();

    expect(fixture.nativeElement.querySelector('.results-legend')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.recipe-readiness-pill')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.xanhla-card-footer-row')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.xanhla-card-top-row .xanhla-card-meta .meta-svg').length).toBeGreaterThanOrEqual(3);
    expect(fixture.nativeElement.querySelectorAll('.xanhla-card-top-row .xanhla-card-meta .meta-divider').length).toBeGreaterThanOrEqual(2);
    expect(fixture.nativeElement.querySelector('.xanhla-card-top-row .xanhla-card-meta')?.textContent).toContain('Khẩu phần:');
  });

  it('should display product thumbnails inside both ready and missing ingredient lists when expanded', () => {
    const fixture = TestBed.createComponent(CookComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushRecipesRequest(httpMock);

    (component as any).catalogueProducts.set([
      makeProduct({
        _id: 'tomato-1',
        name: 'Cà Chua Bi Đà Lạt',
        slug: 'ca-chua-bi',
        image: '/images/products/ca-chua.jpg',
        category: 'vegetables',
      }),
      makeProduct({
        _id: 'avocado-1',
        name: 'Quả Bơ Hass',
        slug: 'qua-bo-hass',
        image: '/images/products/bo-hass.jpg',
        category: 'fruits',
      }),
    ]);

    (component as any).myIngredients.set([
      { name: 'Cà chua', productId: 'tomato-1', product: null, qty: 1, unit: 'quả' },
    ]);

    const computedResults = (component as any).computeRecipeResults();
    (component as any).hasSearched.set(true);
    (component as any).results.set(computedResults);
    (component as any).toggleExpand('bo-xay-mat-ong');
    fixture.detectChanges();

    const readyThumbs = fixture.nativeElement.querySelectorAll('.xanhla-fridge-box .ing-thumb-img');
    const missingThumbs = fixture.nativeElement.querySelectorAll('.xanhla-missing-box .missing-thumb-img');
    expect(readyThumbs.length).toBe(1);
    expect(missingThumbs.length).toBe(1);
  });

  it('should match Bò Mỹ thăn to beef and Bông Cải Xanh to broccoli instead of Bơ Sáp or Cải Xanh', () => {
    const fixture = TestBed.createComponent(CookComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushRecipesRequest(httpMock);

    (component as any).catalogueProducts.set([
      makeProduct({ _id: 'avocado-1', name: 'Bơ Sáp', category: 'fruits', categoryVi: 'Trái cây', priceNumber: 48000, image: '/a.jpg' }),
      makeProduct({ _id: 'beef-1', name: 'Thịt Bò Bắp Mỹ Nhập Khẩu', category: 'meat', categoryVi: 'Thịt', priceNumber: 135000, image: '/b.jpg' }),
      makeProduct({ _id: 'caixanh-1', name: 'Cải Xanh', category: 'vegetables', categoryVi: 'Rau củ', priceNumber: 18000, image: '/c.jpg' }),
      makeProduct({ _id: 'broccoli-1', name: 'Bông Cải Xanh Đà Lạt', category: 'vegetables', categoryVi: 'Rau củ', priceNumber: 28000, image: '/d.jpg' }),
    ]);

    (component as any).myIngredients.set([
      { name: 'Bò Mỹ thăn', productId: 'beef-1', product: null, qty: 200, unit: 'g' },
    ]);

    const computedResults = (component as any).computeRecipeResults();
    const broccoliRecipe = computedResults.find((r: any) => r.id === 'bo-xao-bong-cai-xanh');
    expect(broccoliRecipe).toBeTruthy();

    const beefIng = broccoliRecipe.ingredients.find((i: any) => i.name === 'Bò Mỹ thăn');
    const broccoliIng = broccoliRecipe.ingredients.find((i: any) => i.name.includes('Bông Cải Xanh'));
    expect(beefIng.product?._id).toBe('beef-1');
    expect(broccoliIng.product?._id).toBe('broccoli-1');
  });

  it('should recompute results with prices and images once async catalogue products finish loading', () => {
    const delayedProducts$ = new Subject<{ success: boolean; total: number; data: ApiProduct[] }>();
    const productApi = TestBed.inject(ProductApiService) as any;
    productApi.getAll = () => delayedProducts$.asObservable();

    const fixture = TestBed.createComponent(CookComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushRecipesRequest(httpMock);

    (component as any).myIngredients.set([
      { name: 'Gà ta thả vườn', productId: null, product: null, qty: 200, unit: 'g' },
    ]);
    (component as any).findRecipes();
    expect((component as any).loading()).toBeTrue();
    expect((component as any).results().length).toBe(0);

    delayedProducts$.next({
      success: true,
      total: 2,
      data: [
        makeProduct({ _id: 'chicken-1', name: 'Gà Ta Thả Vườn Nguyên Con', category: 'meat', price: '95.000 ₫', priceNumber: 95000, image: '/ga.jpg' }),
        makeProduct({ _id: 'carrot-1', name: 'Cà Rốt Baby Đà Lạt', category: 'vegetables', price: '22.000 ₫', priceNumber: 22000, image: '/carot.jpg' }),
      ],
    });
    delayedProducts$.complete();
    fixture.detectChanges();

    expect((component as any).loading()).toBeFalse();
    const gaCanh = (component as any).results().find((r: any) => r.id === 'canh-ga-ham-bi-do');
    expect(gaCanh).toBeTruthy();
    expect((component as any).totalMissingCost(gaCanh)).toBe(22000);
    expect(gaCanh.ingredients.find((i: any) => i.name === 'Gà ta thả vườn')?.product?.image).toBe('/ga.jpg');
  });

  it('should consider cart items in recipe availability and show pack conversion equivalents for missing items', () => {
    const fixture = TestBed.createComponent(CookComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushRecipesRequest(httpMock);

    const tomatoProd = makeProduct({
      _id: 'tomato-1',
      name: 'Cà Chua Bi',
      slug: 'ca-chua-bi',
      category: 'vegetables',
      weight: '500g',
      priceNumber: 25000,
    });
    const avocadoProd = makeProduct({
      _id: 'avocado-1',
      name: 'Bơ Sáp',
      slug: 'bo-sap',
      category: 'fruits',
      weight: '500g',
      priceNumber: 48000,
    });

    (component as any).catalogueProducts.set([tomatoProd, avocadoProd]);

    // User has 1 avocado in fridge, for 10 servings of Sinh tố bơ Hass (cần 10 quả)
    (component as any).servings.set(10);
    (component as any).myIngredients.set([
      { name: 'Quả bơ Hass', productId: null, product: null, qty: 1, unit: 'quả' },
    ]);

    // Cart already has 2 packs of Cà Chua Bi (500g x 2 = 1000g ~ 10 quả)
    const cart = (component as any).cart;
    (cart as any)._currentUser.set({ _id: 'u-1', name: 'Test User', email: 'test@example.com' });
    cart.addItem({
      id: 'tomato-1',
      name: 'Cà Chua Bi',
      slug: '/product-page/ca-chua-bi',
      priceNumber: 25000,
      weight: '500g',
    }, 2);

    const computedResults = (component as any).computeRecipeResults();
    const boRecipe = computedResults.find((r: any) => r.id === 'bo-xay-mat-ong');
    expect(boRecipe).toBeTruthy();

    const avocadoIng = boRecipe.ingredients.find((i: any) => i.name === 'Quả bơ Hass');
    const tomatoIng = boRecipe.ingredients.find((i: any) => i.name === 'Cà chua');

    // Avocado: needs 10, has 1 in fridge -> missing 9. 500g pack ~ 2 avocados -> buyQuantity = 5 packs (~10 avocados)
    expect(avocadoIng.requiredAmount).toBe(10);
    expect(avocadoIng.availableAmount).toBe(1);
    expect(avocadoIng.missingAmount).toBe(9);
    expect(avocadoIng.buyQuantity).toBe(5);
    expect(avocadoIng.buyQuantityEquivalent).toBe('≈ 10 quả');
    expect(avocadoIng.packEquivalent).toBe('≈ 2 quả/phần');

    // Tomato: needs 5, cart has 2 packs (10 quả) -> inCartPacks: 2, missing: 0 -> inFridge/ready is true!
    expect(tomatoIng.requiredAmount).toBe(5);
    expect(tomatoIng.inCartPacks).toBe(2);
    expect(tomatoIng.missingAmount).toBe(0);
    expect(tomatoIng.inFridge).toBeTrue();
  });
});

