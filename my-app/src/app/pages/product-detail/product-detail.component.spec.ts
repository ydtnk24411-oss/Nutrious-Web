import { TestBed } from '@angular/core/testing';
import { ProductDetailComponent } from './product-detail.component';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';

describe('ProductDetailComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'golden-mangoes' } } } },
      ],
    }).compileComponents();
  });
  it('should create', () => {
    expect(TestBed.createComponent(ProductDetailComponent).componentInstance).toBeTruthy();
  });
});
