import { TestBed } from '@angular/core/testing';
import { CartComponent } from './cart.component';
import { provideRouter } from '@angular/router';
describe('CartComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CartComponent], providers: [provideRouter([])] }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(CartComponent).componentInstance).toBeTruthy(); });
});
