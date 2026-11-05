import { TestBed } from '@angular/core/testing';
import { HomeComponent } from './home.component';
import { provideRouter } from '@angular/router';

describe('HomeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });
  it('should create', () => {
    expect(TestBed.createComponent(HomeComponent).componentInstance).toBeTruthy();
  });
});
