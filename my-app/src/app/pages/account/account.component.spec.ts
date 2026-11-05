import { TestBed } from '@angular/core/testing';
import { AccountComponent } from './account.component';
import { provideRouter } from '@angular/router';

describe('AccountComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });
  it('should create', () => {
    expect(TestBed.createComponent(AccountComponent).componentInstance).toBeTruthy();
  });
});
