import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NutritionComponent } from './nutrition.component';
import { ApiProduct, ProductApiService } from '../../shared/services/product-api.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { CartService } from '../../shared/services/cart.service';

const MOCK_PRODUCTS: ApiProduct[] = [
  {
    _id: 'p-salmon',
    name: 'Cá Hồi Na Uy Fillet Tươi',
    slug: 'ca-hoi-na-uy-fillet-tuoi',
    price: '165.000đ',
    priceNumber: 165000,
    image: '/images/salmon.jpg',
    categoryId: 'cat-seafood',
    description: '',
    stock: 20,
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
    weight: '300g',
    createdAt: '2026-11-12T00:00:00.000Z',
  },
  {
    _id: 'p-yogurt',
    name: 'Sữa Chua Hy Lạp Hữu Cơ Không Đường',
    slug: 'sua-chua-hy-lap-huu-co',
    price: '45.000đ',
    priceNumber: 45000,
    image: '/images/yogurt.jpg',
    categoryId: 'cat-dairy',
    description: '',
    stock: 20,
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
    weight: '400g',
    createdAt: '2026-11-12T00:00:00.000Z',
  },
];

const MOCK_NUTRITION_RESPONSE = {
  success: true,
  data: {
    hero: {
      kicker: 'Trợ Lý Thực Đơn Khoa Học',
      title: 'Dinh dưỡng thông minh',
      subtitle: 'Thực đơn cân bằng dinh dưỡng',
      bannerImage: '/images/hero.jpg',
      fallbackFoodImage: '/images/fallback.jpg',
    },
    goals: [
      { id: 'protein', label: 'Bổ sung protein', icon: 'P', unit: 'g', min: 0, max: 200, step: 5, default: 50 },
      { id: 'fiber', label: 'Bổ sung chất xơ', icon: 'F', unit: 'g', min: 0, max: 50, step: 1, default: 10 },
    ],
    mealPlans: [],
    ingredientAliases: [
      { keyword: 'cá hồi', slug: 'ca-hoi-na-uy-fillet-tuoi', excludeKeyword: '' },
      { keyword: 'sữa chua hy lạp', slug: 'sua-chua-hy-lap-huu-co', excludeKeyword: '' },
    ],
    recipes: [
      {
        id: 'sua-chua-hy-lap-trai-cay',
        name: 'Bát sữa chua Hy Lạp trái cây',
        image: '/images/yogurt-bowl.jpg',
        description: 'Bữa sáng nhẹ bụng giàu lợi khuẩn',
        prepTime: '5 phút',
        cookTime: '0 phút',
        difficulty: 'Rất dễ',
        calories: 310,
        macros: { protein: '18g', carbs: '32g', fat: '11g', fiber: '8g', vitamins: 'Canxi, Probiotics' },
        servingBase: 1,
        nutritionNote: 'Tốt tiêu hóa',
        goalsTags: ['protein', 'fiber', 'balance'],
        ingredients: [{ name: 'Sữa Chua Hy Lạp Hữu Cơ Không Đường', amountPer1Serving: 150, unit: 'g' }],
      },
      {
        id: 'ca-hoi-ap-chao',
        name: 'Cá hồi áp chảo cải thìa',
        image: '/images/salmon-dish.jpg',
        description: 'Giàu đạm và Omega-3',
        prepTime: '10 phút',
        cookTime: '10 phút',
        difficulty: 'Dễ nấu',
        calories: 460,
        macros: { protein: '36g', carbs: '14g', fat: '22g', fiber: '6g', vitamins: 'Omega-3' },
        servingBase: 1,
        nutritionNote: 'Tốt tim mạch',
        goalsTags: ['protein', 'balance'],
        ingredients: [{ name: 'Cá Hồi Na Uy Fillet Tươi', amountPer1Serving: 150, unit: 'g' }],
      },
      {
        id: 'bo-ap-chao-bong-cai',
        name: 'Thăn bò áp chảo bông cải',
        image: '/images/beef-dish.jpg',
        description: 'Bữa trưa tăng cơ',
        prepTime: '10 phút',
        cookTime: '12 phút',
        difficulty: 'Dễ nấu',
        calories: 450,
        macros: { protein: '38g', carbs: '16g', fat: '18g', fiber: '7g', vitamins: 'Sắt' },
        servingBase: 1,
        nutritionNote: 'Giàu sắt và đạm',
        goalsTags: ['protein', 'fiber'],
        ingredients: [{ name: 'Sữa Chua Hy Lạp Hữu Cơ Không Đường', amountPer1Serving: 100, unit: 'g' }],
      },
      {
        id: 'sinh-to-dau-xoai',
        name: 'Sinh tố dâu xoài',
        image: '/images/smoothie.jpg',
        description: 'Bữa phụ vitamin',
        prepTime: '5 phút',
        cookTime: '5 phút',
        difficulty: 'Rất dễ',
        calories: 255,
        macros: { protein: '11g', carbs: '46g', fat: '3g', fiber: '7g', vitamins: 'Vitamin C' },
        servingBase: 1,
        nutritionNote: 'Sáng da',
        goalsTags: ['fiber', 'vitamin'],
        ingredients: [{ name: 'Sữa Chua Hy Lạp Hữu Cơ Không Đường', amountPer1Serving: 100, unit: 'g' }],
      },
    ],
  },
};

describe('NutritionComponent', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [NutritionComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ProductApiService,
          useValue: { getAll: () => of({ success: true, total: 2, page: 1, pages: 1, data: MOCK_PRODUCTS }) },
        },
        {
          provide: VoucherService,
          useValue: {
            copyCode: jasmine.createSpy('copyCode'),
            publicVouchers: signal([]),
          },
        },
        {
          provide: CartService,
          useValue: {
            items: signal([]),
            itemCount: signal(0),
            currentUser: signal(null),
            addItem: jasmine.createSpy('addItem'),
            ensureItemsSelected: jasmine.createSpy('ensureItemsSelected'),
            selectOnlyRecipeItems: jasmine.createSpy('selectOnlyRecipeItems'),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('provides full onboarding goals, weekDays, mealSlots, and quickSearchTags even when /api/nutrition omits plannerConfig', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(NutritionComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/nutrition'));
    req.flush(MOCK_NUTRITION_RESPONSE);
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    expect(comp.HEALTH_GOALS.length).toBe(4);
    expect(comp.WEEK_DAYS.length).toBe(7);
    expect(comp.MEAL_SLOTS_META.length).toBe(4);
    expect(comp.quickSearchTags.length).toBe(7);
    expect(comp.results().length).toBe(4);

    comp.completeOnboarding();
    const dayPlan = comp.activeDayPlan();
    expect(comp.nutritionView()).toBe('result');
    expect(dayPlan.slots.length).toBe(4);
    expect(dayPlan.totalCalories).toBeGreaterThan(0);
    expect(comp.allWeekDaysPlans().length).toBe(7);
  });

  it('restores result view from localStorage and self-heals broken empty weeklySchedule', () => {
    localStorage.setItem(
      'evergreen_nutrition_onboarding_v1',
      JSON.stringify({
        plannerPreset: 'eatclean',
        plannerMode: 'week',
        mealsPerDay: 3,
        servings: 2,
        onboardingCompleted: true,
        singleDaySchedule: { breakfast: 'ca-hoi-ap-chao', lunch: 'ca-hoi-ap-chao', dinner: 'ca-hoi-ap-chao', snack: 'ca-hoi-ap-chao' },
        weeklySchedule: {},
      })
    );

    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(NutritionComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/nutrition'));
    req.flush(MOCK_NUTRITION_RESPONSE);
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    expect(comp.nutritionView()).toBe('result');
    expect(Object.keys(comp.weeklySchedule()).length).toBe(7);
    const dayPlan = comp.activeDayPlan();
    expect(dayPlan.slots.length).toBe(3);
    expect(dayPlan.totalCalories).toBeGreaterThan(0);
  });

  it('strictly filters recipes by budgetLimit and multi-word allergy phrases', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(NutritionComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/nutrition'));
    req.flush(MOCK_NUTRITION_RESPONSE);
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    comp.setBudgetQuick(150000);
    expect(comp.results().every((r) => comp.dealCost(r) <= 150000)).toBeTrue();
    expect(comp.results().some((r) => r.id === 'ca-hoi-ap-chao')).toBeFalse();

    comp.setBudgetQuick(null);
    comp.excludeIngredients.set('cá hồi');
    (comp as any).computeRecipes();
    expect(comp.results().some((r) => r.id === 'ca-hoi-ap-chao')).toBeFalse();
    expect(comp.results().some((r) => r.id === 'sua-chua-hy-lap-trai-cay')).toBeTrue();
  });
});

