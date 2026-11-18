import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ProductDetailComponent } from './product-detail.component';
import { API_BASE } from '../../shared/services/api.service';
import { ApiProduct } from '../../shared/services/product-api.service';

describe('ProductDetailComponent', () => {
  let httpMock: HttpTestingController;

  const mockProduct: ApiProduct = {
    _id: 'prod-sprite-1',
    name: 'Nước Soda Vị Chanh Sprite Lon 320ml',
    slug: 'sprite-320ml',
    price: '12.000₫',
    priceNumber: 12000,
    image: 'https://example.com/sprite-main.jpg',
    images: [
      'https://example.com/sprite-main.jpg',
      'https://example.com/sprite-angle-2.jpg',
      'https://example.com/sprite-pack-3.jpg',
    ],
    categoryId: 'cat-bev',
    description: 'Nước giải khát hương chanh tự nhiên',
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
    weight: '320ml',
    createdAt: '2026-11-12T00:00:00.000Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'sprite-320ml' } } } },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match(() => true);
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ProductDetailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders primary image first and switches main image when clicking a gallery thumbnail', () => {
    const fixture = TestBed.createComponent(ProductDetailComponent);
    fixture.detectChanges();

    const prodReq = httpMock.expectOne(`${API_BASE}/products/sprite-320ml`);
    prodReq.flush({ success: true, data: mockProduct });
    httpMock.match(() => true).forEach((r) => r.flush({ success: true, data: [] }));

    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const mainImg = el.querySelector('.xanhla-product-gallery-main img') as HTMLImageElement;
    const thumbs = el.querySelectorAll('.xanhla-product-thumb');

    expect(thumbs.length).toBe(3);
    expect(mainImg.src).toContain('sprite-main.jpg');
    expect(thumbs[0].classList.contains('is-active')).toBeTrue();

    (thumbs[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(mainImg.src).toContain('sprite-angle-2.jpg');
    expect(thumbs[1].classList.contains('is-active')).toBeTrue();

    (el.querySelector('.xanhla-gallery-arrow.next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(mainImg.src).toContain('sprite-pack-3.jpg');
    expect(thumbs[2].classList.contains('is-active')).toBeTrue();
  });
});
