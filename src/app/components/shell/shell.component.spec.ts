import { TestBed } from '@angular/core/testing';
import { ShellComponent } from './shell.component';
import { provideRouter } from '@angular/router';

describe('ShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
