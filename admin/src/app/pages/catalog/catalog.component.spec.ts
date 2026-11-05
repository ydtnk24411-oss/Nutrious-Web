import { TestBed } from '@angular/core/testing';
import { CatalogComponent } from './catalog.component';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('CatalogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });
  it('should create', () => {
    expect(TestBed.createComponent(CatalogComponent).componentInstance).toBeTruthy();
  });
});
