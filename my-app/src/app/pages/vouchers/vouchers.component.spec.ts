import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { VouchersComponent } from './vouchers.component';
import { API_BASE } from '../../shared/services/api.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { Voucher } from '../../shared/models/xanh-la.models';
import {
  buildVoucherConditionSections,
  buildVoucherVisual,
  formatVoucherDateVi,
} from '../../shared/utils/voucher-visual.util';

const MOCK_VOUCHERS: Voucher[] = [
  {
    id: 'v1',
    code: 'ONLINE30',
    name: 'Ưu Đãi Thanh Toán VietQR - Giảm 30K',
    type: 'fixed',
    voucherType: 'ORDER_DISCOUNT',
    value: 30000,
    minValue: 150000,
    maxValue: 30000,
    requiredPaymentMethod: 'bank_transfer',
    startDate: '2025-01-01T00:00:00.000Z',
    endDate: '31/12/2027',
    usageLimit: 500,
    usedCount: 10,
    maxUsagePerUser: 3,
    isFirstOrderOnly: false,
    description: 'Giảm 30K khi thanh toán VietQR.',
    isPublic: true,
  },
  {
    id: 'v2',
    code: 'FREESHIP',
    name: 'Hỗ Trợ Phí Giao Hàng 30K',
    type: 'fixed',
    voucherType: 'SHIPPING_DISCOUNT',
    value: 30000,
    minValue: 100000,
    maxValue: 30000,
    startDate: '2025-01-01T00:00:00.000Z',
    endDate: '31/12/2027',
    usageLimit: 1000,
    usedCount: 1,
    isFirstOrderOnly: false,
    description: 'Giảm 30K phí vận chuyển xe lạnh.',
    isPublic: true,
  },
];

describe('VouchersComponent & voucher-visual.util', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VouchersComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE, useValue: 'http://localhost:3000/api' },
      ],
    }).compileComponents();
  });

  it('maps voucher visual themes, logo tags, and date formatting consistently', () => {
    const v1Vis = buildVoucherVisual(MOCK_VOUCHERS[0], 0);
    expect(v1Vis.themeKey).toBe('forest-emerald');
    expect(v1Vis.categoryLabel).toBe('Thanh toán Online');
    expect(v1Vis.stubTag).toBe('VIETQR');
    expect(v1Vis.discountDisplay).toBe('30K');

    const v2Vis = buildVoucherVisual(MOCK_VOUCHERS[1], 1);
    expect(v2Vis.themeKey).toBe('lagoon-teal');
    expect(v2Vis.discountDisplay).toBe('FREE');
    expect(v2Vis.stubTag).toBe('GIAO 2H');

    expect(formatVoucherDateVi('31/12/2027')).toBe('31/12/2027');
    expect(formatVoucherDateVi('2025-01-01T00:00:00.000Z')).toBe('01/01/2025');

    const sections = buildVoucherConditionSections(MOCK_VOUCHERS[0]);
    expect(sections.length).toBe(4);
    expect(JSON.stringify(sections)).toContain('Chuyển khoản ngân hàng / VietQR');
  });

  it('renders Evergreen Mart logo and condition links for voucher tickets', () => {
    const voucherSvc = TestBed.inject(VoucherService) as any;
    voucherSvc._publicVouchers.set(MOCK_VOUCHERS);

    const fixture = TestBed.createComponent(VouchersComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const logos = el.querySelectorAll('.voucher-logo-img');
    expect(logos.length).toBe(2);
    expect((logos[0] as HTMLImageElement).getAttribute('src')).toContain('/evergreen-logo.png');

    const condLinks = el.querySelectorAll('.voucher-cond-link');
    expect(condLinks.length).toBe(2);
    expect((condLinks[0] as HTMLAnchorElement).getAttribute('href')).toContain('/vouchers/ONLINE30');
  });
});

