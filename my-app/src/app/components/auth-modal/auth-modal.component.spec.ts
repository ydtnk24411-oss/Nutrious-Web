import { TestBed } from '@angular/core/testing';
import { AuthModalComponent } from './auth-modal.component';

describe('AuthModalComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthModalComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AuthModalComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
