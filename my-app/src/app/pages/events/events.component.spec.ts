import { TestBed } from '@angular/core/testing';
import { EventsComponent } from './events.component';
import { provideRouter } from '@angular/router';
describe('EventsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EventsComponent], providers: [provideRouter([])] }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(EventsComponent).componentInstance).toBeTruthy(); });
});
