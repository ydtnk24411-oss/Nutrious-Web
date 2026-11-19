import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AdminUsersComponent } from './users.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('AdminUsersComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(TestBed.createComponent(AdminUsersComponent).componentInstance).toBeTruthy();
  });

  it('should silently poll every 5s and refresh on window focus without showing loading spinner', fakeAsync(() => {
    const fixture = TestBed.createComponent(AdminUsersComponent);
    const comp = fixture.componentInstance;

    comp.ngOnInit();
    expect(comp.loading()).toBeTrue();

    const firstReq = httpMock.expectOne((r) => r.url.includes('/users/purchase-stats'));
    firstReq.flush({
      success: true,
      total: 1,
      data: [{ _id: '1', name: 'Khach 1', email: '', phone: '0900000001', role: 'customer', isActive: true, totalSpent: 0, orderCount: 0, lastPurchaseDate: null }],
    });
    expect(comp.loading()).toBeFalse();
    expect(comp.users().length).toBe(1);

    // Trigger 5-second background poll
    tick(5000);
    expect(comp.loading()).toBeFalse();
    const pollReq = httpMock.expectOne((r) => r.url.includes('/users/purchase-stats'));
    pollReq.flush({
      success: true,
      total: 2,
      data: [
        { _id: '2', name: 'Khach Moi', email: '', phone: '0900000002', role: 'customer', isActive: true, totalSpent: 0, orderCount: 0, lastPurchaseDate: null },
        { _id: '1', name: 'Khach 1', email: '', phone: '0900000001', role: 'customer', isActive: true, totalSpent: 0, orderCount: 0, lastPurchaseDate: null },
      ],
    });
    expect(comp.total()).toBe(2);
    expect(comp.users()[0].name).toBe('Khach Moi');

    // Trigger immediate refresh on window focus
    comp.onWindowFocus();
    const focusReq = httpMock.expectOne((r) => r.url.includes('/users/purchase-stats'));
    focusReq.flush({
      success: true,
      total: 3,
      data: [
        { _id: '3', name: 'Khach Focus', email: '', phone: '0900000003', role: 'customer', isActive: true, totalSpent: 0, orderCount: 0, lastPurchaseDate: null },
      ],
    });
    expect(comp.total()).toBe(3);

    comp.ngOnDestroy();
  }));
});
