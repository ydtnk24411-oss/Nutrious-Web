import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthModalComponent } from './auth-modal.component';
import { CartService } from '../../shared/services/cart.service';

describe('AuthModalComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AuthModalComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should prefill name and phone when opened on signup tab with prefill data', () => {
    const fixture = TestBed.createComponent(AuthModalComponent);
    const cart = TestBed.inject(CartService);

    cart.openAuthModal('signup', { name: 'Nguyễn Văn A', phone: '0987654321' });
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector('#reg-name') as HTMLInputElement;
    const phoneInput = fixture.nativeElement.querySelector('#reg-phone') as HTMLInputElement;
    expect(nameInput.value).toBe('Nguyễn Văn A');
    expect(phoneInput.value).toBe('0987654321');
  });
});
