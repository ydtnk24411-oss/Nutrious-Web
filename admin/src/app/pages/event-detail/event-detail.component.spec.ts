import { TestBed } from '@angular/core/testing';
import { EventDetailComponent } from './event-detail.component';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
describe('EventDetailComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventDetailComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'xanh-la-fresh-food-festival' } } } }],
    }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(EventDetailComponent).componentInstance).toBeTruthy(); });
});
