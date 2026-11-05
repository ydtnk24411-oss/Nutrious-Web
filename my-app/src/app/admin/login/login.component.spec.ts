import { TestBed } from '@angular/core/testing';
import { AdminLoginComponent } from './login.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('AdminLoginComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLoginComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });
  it('should create', () => {
    expect(TestBed.createComponent(AdminLoginComponent).componentInstance).toBeTruthy();
  });
});
