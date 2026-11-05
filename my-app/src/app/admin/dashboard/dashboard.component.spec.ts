import { TestBed } from '@angular/core/testing';
import { AdminDashboardComponent } from './dashboard.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('AdminDashboardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });
  it('should create', () => {
    expect(TestBed.createComponent(AdminDashboardComponent).componentInstance).toBeTruthy();
  });
});
