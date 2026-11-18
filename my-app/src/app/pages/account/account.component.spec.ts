import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AccountComponent } from './account.component';
import { API_BASE } from '../../shared/services/api.service';
import { CartService } from '../../shared/services/cart.service';
import { OrderApiService } from '../../shared/services/order-api.service';

describe('AccountComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE, useValue: 'http://localhost:3000/api' },
        {
          provide: OrderApiService,
          useValue: {
            getMyOrders: () =>
              of({
                success: true,
                data: [
                  {
                    _id: 'ord-1',
                    orderCode: 'XL-888999',
                    createdAt: '2026-11-18T09:00:00.000Z',
                    total: 72000,
                    status: 'delivered',
                    items: [
                      {
                        productName: 'Cam Sành',
                        productImage: 'https://example.com/cam.jpg',
                        quantity: 2,
                        priceNumber: 36000,
                      },
                    ],
                  },
                ],
              }),
          },
        },
      ],
    }).compileComponents();

    const cart = TestBed.inject(CartService) as any;
    cart._currentUser.set({
      _id: 'u1',
      name: 'Vân Minh Anh',
      email: 'minhanh@example.com',
      phone: '0988123789',
      gender: 'Nữ',
      birthday: '1994-06-15',
      addresses: [
        {
          id: 'a1',
          label: 'Nhà riêng',
          fullName: 'Vân Minh Anh',
          phone: '0988123789',
          address: '320 Nguyễn Văn Khối, Gò Vấp',
          city: 'TP. Hồ Chí Minh',
          isDefault: true,
        },
      ],
    });
  });

  it('renders sidebar layout, hero stats, 6 info fields, recent order cards, and product images in orders tab', () => {
    const fixture = TestBed.createComponent(AccountComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.acc-side-link').length).toBeGreaterThanOrEqual(7);
    expect(el.querySelectorAll('.acc-stat-tile').length).toBe(4);
    expect(el.querySelectorAll('.acc-info-item').length).toBe(6);
    expect(el.textContent).toContain('15/06/1994');

    const recentImg = el.querySelector('.acc-recent-img-box img') as HTMLImageElement | null;
    expect(recentImg?.getAttribute('src')).toBe('https://example.com/cam.jpg');

    comp.activeTab.set('orders');
    fixture.detectChanges();

    const thumb = el.querySelector('.acc-item-thumb') as HTMLImageElement | null;
    expect(thumb?.getAttribute('src')).toBe('https://example.com/cam.jpg');
  });
});
