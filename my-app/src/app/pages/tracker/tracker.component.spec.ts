import { TestBed } from '@angular/core/testing';
import { TrackerComponent } from './tracker.component';
import { provideRouter } from '@angular/router';
describe('TrackerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TrackerComponent], providers: [provideRouter([])] }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(TrackerComponent).componentInstance).toBeTruthy(); });
});
