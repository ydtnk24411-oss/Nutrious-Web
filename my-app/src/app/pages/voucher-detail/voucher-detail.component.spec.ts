import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { VoucherDetailComponent } from './voucher-detail.component';
import { API_BASE } from '../../shared/services/api.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { Voucher } from '../../shared/models/xanh-la.models';

const TEST_VOUCHER: Voucher = {
  id: 'v-wknd',
  code: 'WEEKEND50',
  name: 'Flash Sale Cuối Tuần Giảm 50K',
  type: 'fixed',
  voucherType: 'ORDER_DISCOUNT',
  value: 50000,
  minValue: 250000,
  maxValue: 50000,
  applicableCategories: ['vegetables', 'fruits'],
  activeDaysOfWeek: [0, 6],
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '31/12/2027',
  usageLimit: 300,
  usedCount: 25,
  maxUsagePerUser: 2,
  isFirstOrderOnly: false,
  description: 'Giảm 50K cho đơn nông sản dịp cuối tuần.',
  isPublic: true,
};

describe('VoucherDetailComponent', () => {
  it('renders detailed condition sections and Evergreen Mart logo for a voucher code', async () => {
    const paramMap$ = new BehaviorSubject(convertToParamMap({ code: 'WEEKEND50' }));

    await TestBed.configureTestingModule({
      imports: [VoucherDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE, useValue: 'http://localhost:3000/api' },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
      ],
    }).compileComponents();

    const svc = TestBed.inject(VoucherService);
    spyOn(svc, 'getVoucherDetail').and.returnValue(of(TEST_VOUCHER));

    const fixture = TestBed.createComponent(VoucherDetailComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.vd-title')?.textContent).toContain('Flash Sale Cuối Tuần Giảm 50K');
    expect((el.querySelector('.vd-logo-img') as HTMLImageElement)?.getAttribute('src')).toContain('/evergreen-logo.png');

    const condCards = el.querySelectorAll('.vd-cond-card');
    expect(condCards.length).toBe(4);
    expect(el.textContent).toContain('Rau củ hữu cơ, Trái cây tươi');
    expect(el.textContent).toContain('Chủ Nhật, Thứ 7');
  });
});

