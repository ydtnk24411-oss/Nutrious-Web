import { TestBed } from '@angular/core/testing';
import { OrderingComponent } from './ordering.component';
import { provideRouter } from '@angular/router';
describe('OrderingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OrderingComponent], providers: [provideRouter([])] }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(OrderingComponent).componentInstance).toBeTruthy(); });
});
