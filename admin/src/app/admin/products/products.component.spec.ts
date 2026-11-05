import { TestBed } from '@angular/core/testing';
import { AdminProductsComponent } from './products.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('AdminProductsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProductsComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });
  it('should create', () => {
    expect(TestBed.createComponent(AdminProductsComponent).componentInstance).toBeTruthy();
  });
});
