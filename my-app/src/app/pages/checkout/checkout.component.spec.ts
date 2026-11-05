import { TestBed } from '@angular/core/testing';
import { CheckoutComponent } from './checkout.component';
import { provideRouter } from '@angular/router';
describe('CheckoutComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CheckoutComponent], providers: [provideRouter([])] }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(CheckoutComponent).componentInstance).toBeTruthy(); });
});
