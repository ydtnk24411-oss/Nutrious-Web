import { TestBed } from '@angular/core/testing';
import { AdminOrdersComponent } from './orders.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('AdminOrdersComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOrdersComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });
  it('should create', () => {
    expect(TestBed.createComponent(AdminOrdersComponent).componentInstance).toBeTruthy();
  });
});
