import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthModalComponent } from './auth-modal.component';
import { CartService } from '../../shared/services/cart.service';

describe('AuthModalComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  function requestSignupOtp(
    fixture: ReturnType<typeof TestBed.createComponent<AuthModalComponent>>,
    responseBody: { success: boolean; message: string; phone: string; demoOtp?: string }
  ): void {
    const cart = TestBed.inject(CartService);
    cart.openAuthModal('signup', { name: 'Nguyễn Văn A', phone: '0987654321' });
    fixture.detectChanges();

    const setInput = (selector: string, val: string) => {
      const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
      input.value = val;
      input.dispatchEvent(new Event('input'));
    };

    setInput('#reg-password', 'Abc12345');
    setInput('#reg-confirm', 'Abc12345');

    const form = fixture.nativeElement.querySelector('form.xanhla-auth-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/auth/register/request-otp'));
    req.flush(responseBody);
    fixture.detectChanges();
  }

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

  it('should hide demo OTP badge when backend omits demoOtp', () => {
    const fixture = TestBed.createComponent(AuthModalComponent);
    requestSignupOtp(fixture, {
      success: true,
      message: 'Đã gửi mã OTP.',
      phone: '0987654321',
    });

    expect(fixture.nativeElement.querySelector('.otp-demo-badge')).toBeNull();
  });

  it('should show demo OTP badge with returned code when backend provides demoOtp', () => {
    const fixture = TestBed.createComponent(AuthModalComponent);
    requestSignupOtp(fixture, {
      success: true,
      message: 'Đã gửi mã OTP.',
      phone: '0987654321',
      demoOtp: '123456',
    });

    const badge = fixture.nativeElement.querySelector('.otp-demo-badge') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('123456');
  });

  it('should show register success popup after OTP verified', () => {
    const fixture = TestBed.createComponent(AuthModalComponent);
    requestSignupOtp(fixture, {
      success: true,
      message: 'Đã gửi mã OTP.',
      phone: '0987654321',
      demoOtp: '123456',
    });

    const inputs = fixture.nativeElement.querySelectorAll('.otp-digit-box') as NodeListOf<HTMLInputElement>;
    '123456'.split('').forEach((d, i) => {
      inputs[i].value = d;
      inputs[i].dispatchEvent(new Event('input'));
    });

    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/auth/register/verify-otp'));
    req.flush({
      success: true,
      token: 'test-token',
      message: 'OK',
      user: { name: 'Nguyễn Văn A', email: '', phone: '0987654321' },
    });
    httpMock.match(() => true).forEach((r) => r.flush({}));
    fixture.detectChanges();

    const popup = fixture.nativeElement.querySelector('.register-success-modal') as HTMLElement;
    expect(popup).not.toBeNull();
    expect(popup.textContent).toContain('Đăng ký thành công');
    expect(popup.textContent).toContain('Nguyễn Văn A');
  });
});
