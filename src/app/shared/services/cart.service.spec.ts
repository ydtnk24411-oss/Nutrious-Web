import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty cart', () => {
    expect(service.itemCount()).toBe(0);
  });

  it('should add item and increase count', () => {
    const mockProduct: any = {
      id: 'test', name: 'Test', slug: '/product-page/test',
      price: '10 ₫', priceNumber: 10, image: '', category: 'Fruits',
      categoryVi: '', container: '', cutType: '', cutting: '', packSize: '',
      packaging: '', preparation: '', quantity: '', ripeness: '',
      sizeGroup: '', thickness: '', type: '', weight: '', description: '',
    };
    service.addItem(mockProduct, 2);
    expect(service.itemCount()).toBe(2);
    expect(service.subtotal()).toBe(20);
  });

  it('should remove item', () => {
    const mockProduct: any = {
      id: 'test', name: 'Test', slug: '/product-page/test',
      price: '10 ₫', priceNumber: 10, image: '', category: 'Fruits',
      categoryVi: '', container: '', cutType: '', cutting: '', packSize: '',
      packaging: '', preparation: '', quantity: '', ripeness: '',
      sizeGroup: '', thickness: '', type: '', weight: '', description: '',
    };
    service.addItem(mockProduct, 1);
    service.removeItem('/product-page/test');
    expect(service.itemCount()).toBe(0);
  });
});
