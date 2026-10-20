import { TestBed } from '@angular/core/testing';
import { AdminEventsComponent } from './events.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
describe('AdminEventsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AdminEventsComponent], providers: [provideRouter([]), provideHttpClient()] }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(AdminEventsComponent).componentInstance).toBeTruthy(); });
});
