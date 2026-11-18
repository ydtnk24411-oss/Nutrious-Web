import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { HomeComponent } from './home.component';
import { ApiCategory, CategoryApiService } from '../../shared/services/category-api.service';
import { ProductApiService } from '../../shared/services/product-api.service';
import { FlashSaleApiService } from '../../shared/services/flash-sale-api.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { signal } from '@angular/core';

describe('HomeComponent', () => {
  const mockCategories: ApiCategory[] = [
    {
      _id: 'cat-1',
      name: 'Thức uống',
      slug: '/category/beverages',
      image: '/images/categories/nuoc-uong.jpg',
      order: 1,
      isActive: true,
    },
    {
      _id: 'cat-2',
      name: 'Sữa & Thực phẩm mát',
      slug: '/category/dairy',
      image: '/images/categories/sua.jpg',
      order: 2,
      isActive: true,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
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
          useValue: { getAll: () => of({ success: true, data: [] }) },
        },
        {
          provide: FlashSaleApiService,
          useValue: { getActive: () => of({ success: true, data: [] }) },
        },
        {
          provide: VoucherService,
          useValue: {
            publicVouchers: signal([]),
            loadPublic: () => {},
            refreshMine: () => {},
            isSaved: () => false,
            save: () => of(void 0),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create and load categories dynamically from CategoryApiService', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp).toBeTruthy();
    expect(comp.categories.length).toBe(2);
    expect(comp.categories[0].image).toBe('/images/categories/nuoc-uong.jpg');
    expect(comp.categories[1].image).toBe('/images/categories/sua.jpg');

    const el = fixture.nativeElement as HTMLElement;
    const topImages = Array.from(el.querySelectorAll('.coop-category-img')).map(img => img.getAttribute('src'));
    const deptImages = Array.from(el.querySelectorAll('.coop-department-image img')).map(img => img.getAttribute('src'));
    expect(topImages).toEqual(['/images/categories/nuoc-uong.jpg', '/images/categories/sua.jpg']);
    expect(deptImages).toEqual(['/images/categories/nuoc-uong.jpg', '/images/categories/sua.jpg']);
  });

  it('should load active hero banners sorted by sortOrder and resolve MongoDB media URLs', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/banners'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('_t')).toBeTrue();

    req.flush({
      success: true,
      data: {
        updatedBy: 'Admin Evergreen Mart',
        heroSlides: [
          {
            title: 'Slide 2',
            link: '/promotions',
            image: '/api/banners/media/slide-2-id',
            active: true,
            sortOrder: 2,
          },
          {
            title: 'Slide Inactive',
            link: '/vouchers',
            image: '/api/banners/media/inactive-id',
            active: false,
            sortOrder: 0,
          },
          {
            title: 'Slide 1',
            link: '/online-ordering',
            image: '/api/banners/media/slide-1-id',
            active: true,
            sortOrder: 1,
          },
        ],
        promoPopup: { enabled: false },
      },
    });
    fixture.detectChanges();

    expect(comp.heroBanners.length).toBe(2);
    expect(comp.heroBanners[0].image).toBe('http://localhost:3000/api/banners/media/slide-1-id');
    expect(comp.heroBanners[1].image).toBe('http://localhost:3000/api/banners/media/slide-2-id');
    expect(comp.activeHero).toBe(0);

    const heroImg = (fixture.nativeElement as HTMLElement).querySelector('.coop-hero-slide-img') as HTMLImageElement | null;
    expect(heroImg?.getAttribute('src')).toBe('http://localhost:3000/api/banners/media/slide-1-id');
  });
});
