import { TestBed } from '@angular/core/testing';
import { BookingComponent } from './booking.component';
import { provideRouter } from '@angular/router';
describe('BookingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BookingComponent], providers: [provideRouter([])] }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(BookingComponent).componentInstance).toBeTruthy(); });
});
