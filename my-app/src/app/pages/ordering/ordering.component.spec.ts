import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OrderingComponent } from './ordering.component';
import { ApiProduct, ProductApiService } from '../../shared/services/product-api.service';
import { ApiCategory, CategoryApiService } from '../../shared/services/category-api.service';

function makeProduct(index: number, categoryId: string): ApiProduct {
  return {
    _id: `prod-${index}`,
    name: `Sản phẩm ${index}`,
    slug: `san-pham-${index}`,
    price: `${10 + index}.000₫`,
    priceNumber: 10000 + index * 1000,
    image: 'https://example.com/prod.jpg',
    categoryId,
    description: `Mô tả ${index}`,
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
  };
}

describe('OrderingComponent', () => {
  const mockCategories: ApiCategory[] = [
    { _id: 'cat-1', name: 'Rau lá', slug: 'rau-la', image: '', order: 1, isActive: true },
    { _id: 'cat-2', name: 'Trái cây', slug: 'trai-cay', image: '', order: 2, isActive: true },
  ];

  const mockProducts: ApiProduct[] = [
    ...Array.from({ length: 25 }, (_, i) => makeProduct(i + 1, 'cat-1')),
    ...Array.from({ length: 20 }, (_, i) => makeProduct(i + 26, 'cat-2')),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CategoryApiService,
          useValue: { getAll: () => of({ success: true, data: mockCategories }) },
        },
        {
          provide: ProductApiService,
          useValue: { getAll: () => of({ success: true, total: mockProducts.length, data: mockProducts }) },
        },
      ],
    }).compileComponents();
  });

  it('should create and initially cap unified product grid at 20 items', () => {
    const fixture = TestBed.createComponent(OrderingComponent);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.xanhla-prod-card');
    expect(cards.length).toBe(20);
    const loadMoreBtn = fixture.nativeElement.querySelector('.ord-load-more-btn') as HTMLButtonElement | null;
    expect(loadMoreBtn?.textContent?.trim()).toBe('Xem thêm');
  });

  it('should expand by 20 items on Load More and hide button once all items are shown', () => {
    const fixture = TestBed.createComponent(OrderingComponent);
    fixture.detectChanges();

    const loadMoreBtn = fixture.nativeElement.querySelector('.ord-load-more-btn') as HTMLButtonElement;
    loadMoreBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.xanhla-prod-card').length).toBe(40);

    loadMoreBtn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.xanhla-prod-card').length).toBe(45);
    expect(fixture.nativeElement.querySelector('.ord-load-more-btn')).toBeFalsy();
  });

  it('should filter by selected category and reset visible count to 20', () => {
    const fixture = TestBed.createComponent(OrderingComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.ord-load-more-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.xanhla-prod-card').length).toBe(40);

    const navButtons = Array.from(fixture.nativeElement.querySelectorAll('.ord-nav-item')) as HTMLButtonElement[];
    const cat1Btn = navButtons.find(btn => btn.textContent?.includes('Rau lá'))!;
    cat1Btn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.xanhla-prod-card').length).toBe(20);
    const title = fixture.nativeElement.querySelector('.ord-menu-title')?.textContent;
    expect(title).toContain('Rau lá');
    const loadMoreBtn = fixture.nativeElement.querySelector('.ord-load-more-btn') as HTMLButtonElement;
    expect(loadMoreBtn.textContent?.trim()).toBe('Xem thêm');
  });
});
