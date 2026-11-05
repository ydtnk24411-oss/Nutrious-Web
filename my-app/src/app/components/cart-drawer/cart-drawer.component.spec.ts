import { TestBed } from '@angular/core/testing';
import { CartDrawerComponent } from './cart-drawer.component';
import { provideRouter } from '@angular/router';

describe('CartDrawerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartDrawerComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(CartDrawerComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
