import { TestBed } from '@angular/core/testing';
import { AdminLayoutComponent } from './admin-layout.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('AdminLayoutComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });
  it('should create', () => {
    expect(TestBed.createComponent(AdminLayoutComponent).componentInstance).toBeTruthy();
  });
});
