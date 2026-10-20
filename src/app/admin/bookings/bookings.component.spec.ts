import { TestBed } from '@angular/core/testing';
import { AdminBookingsComponent } from './bookings.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
describe('AdminBookingsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AdminBookingsComponent], providers: [provideRouter([]), provideHttpClient()] }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(AdminBookingsComponent).componentInstance).toBeTruthy(); });
});
