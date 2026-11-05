import { TestBed } from '@angular/core/testing';
import { ServiceDetailComponent } from './service-detail.component';
import { provideRouter, ActivatedRoute } from '@angular/router';
describe('ServiceDetailComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceDetailComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'nutrition-planning' } } } }],
    }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(ServiceDetailComponent).componentInstance).toBeTruthy(); });
});
