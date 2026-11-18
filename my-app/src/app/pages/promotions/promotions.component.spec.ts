import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PromotionsComponent } from './promotions.component';
import { API_BASE, ApiService } from '../../shared/services/api.service';
import { FlashSaleApiService, FlashSaleItem } from '../../shared/services/flash-sale-api.service';
import { ProductApiService } from '../../shared/services/product-api.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { Voucher } from '../../shared/models/xanh-la.models';

const MOCK_FLASH_SALES: FlashSaleItem[] = [
  {
    _id: 'fs-1',
    productId: 'p-1',
    name: 'Bắp Cải Trắng',
    slug: 'bap-cai-trang-da-lat',
    category: 'Rau củ',
    description: 'Bắp cải trắng Đà Lạt giòn ngọt.',
    image: 'https://example.com/cabbage.jpg',
    originalPrice: 20000,
    flashSalePrice: 13000,
    discountPercent: 35,
    totalQuantity: 60,
    soldQuantity: 28,
    soldPercent: 47,
    stock: 20,
    isSoldOut: false,
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2027-12-31T00:00:00.000Z',
    isActive: true,
  },
  {
    _id: 'fs-2',
    productId: 'p-2',
    name: 'Ba Chỉ Bò Mỹ Cắt Lát Lẩu',
    slug: 'ba-chi-bo-my',
    category: 'Thịt tươi',
    description: 'Ba chỉ bò Mỹ mềm ngọt.',
    image: 'https://example.com/beef.jpg',
    originalPrice: 125000,
    flashSalePrice: 85000,
    discountPercent: 32,
    totalQuantity: 30,
    soldQuantity: 30,
    soldPercent: 100,
    stock: 10,
    isSoldOut: true,
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2027-12-31T00:00:00.000Z',
    isActive: true,
  },
];

const MOCK_VOUCHERS: Voucher[] = [
  { id: 'v1', code: 'ONLINE30', name: 'Ưu Đãi VietQR - 30K', type: 'fixed', value: 30000, minValue: 150000, startDate: '2025-01-01', endDate: '31/12/2027', usedCount: 0, description: '', isPublic: true },
  { id: 'v2', code: 'WELCOME50', name: 'Quà Tân Thủ - 50K', type: 'fixed', value: 50000, minValue: 200000, isFirstOrderOnly: true, startDate: '2025-01-01', endDate: '31/12/2027', usedCount: 0, description: '', isPublic: true },
  { id: 'v3', code: 'GREEN40', name: 'Thứ Tư Xanh - 40K', type: 'fixed', value: 40000, minValue: 200000, startDate: '2025-01-01', endDate: '31/12/2027', usedCount: 0, description: '', isPublic: true },
  { id: 'v4', code: 'FREESHIP', name: 'Hỗ Trợ Giao Hàng 30K', type: 'fixed', voucherType: 'SHIPPING_DISCOUNT', value: 30000, minValue: 100000, startDate: '2025-01-01', endDate: '31/12/2027', usedCount: 0, description: '', isPublic: true },
];

describe('PromotionsComponent (Flash Sale page)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromotionsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE, useValue: 'http://localhost:3000/api' },
        {
          provide: FlashSaleApiService,
          useValue: { getActive: () => of({ success: true, count: 2, data: MOCK_FLASH_SALES }) },
        },
        {
          provide: ProductApiService,
          useValue: { getAll: () => of({ success: true, data: [{ _id: 'p-1', name: 'Bắp Cải Trắng', slug: 'bap-cai-trang-da-lat', priceNumber: 20000, stock: 20, isActive: true, image: 'https://example.com/cabbage.jpg' }] }) },
        },
        {
          provide: ApiService,
          useValue: {
            get: (path: string) => {
              if (path === '/nutrition') {
                return of({
                  success: true,
                  data: {
                    recipes: [
                      {
                        id: 'r1',
                        name: 'Cá hồi áp chảo',
                        image: 'https://example.com/salmon.jpg',
                        description: 'Mô tả dài sẽ không hiển thị',
                        prepTime: '10 phút',
                        ingredients: [{ name: 'Bắp Cải Trắng', amountPer1Serving: 100, unit: 'g' }],
                      },
                    ],
                  },
                });
              }
              return of({ success: true, data: [] });
            },
            post: () => of({ success: true }),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders Home-synced Flash Sale cards, compact Combo cards without descriptions, and max 3 mini vouchers', () => {
    const voucherSvc = TestBed.inject(VoucherService) as any;
    voucherSvc._publicVouchers.set(MOCK_VOUCHERS);

    const fixture = TestBed.createComponent(PromotionsComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;

    // 1. Flash Sale cards match Home style (.fs-product-card with THÊM GIỎ + Mua ngay + soldout state)
    const fsCards = el.querySelectorAll('.fs-product-card');
    expect(fsCards.length).toBe(2);
    expect(fsCards[0].textContent).toContain('THÊM GIỎ');
    expect(fsCards[0].textContent).toContain('Mua ngay');
    expect(fsCards[1].textContent).toContain('Tạm hết hàng');

    // 2. Compact Combo card removes description paragraph
    const comboCards = el.querySelectorAll('.combo-deal-card');
    expect(comboCards.length).toBe(1);
    expect(el.querySelector('.combo-deal-desc')).toBeNull();

    // 3. Featured Vouchers shows max 3 cards + link to /vouchers
    const miniCards = el.querySelectorAll('.promo-mini-card');
    expect(miniCards.length).toBe(3);
    expect((el.querySelector('.promo-vouchers-all') as HTMLAnchorElement)?.getAttribute('href')).toBe('/vouchers');
  });
});

