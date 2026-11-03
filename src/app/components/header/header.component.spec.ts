import { TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
describe('HeaderComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should filter suggestions accurately based on Vietnamese diacritics', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const comp = fixture.componentInstance as any;

    comp.allProducts.set([
      {
        _id: '1',
        name: 'Thịt Bắp Bò Úc Tươi',
        slug: 'thit-bap-bo-uc-tuoi',
        category: 'meat',
        categoryVi: 'Thịt',
        price: '140.000đ',
        priceNumber: 140000,
      },
      {
        _id: '2',
        name: 'Cải Cúc (Rau Tần Ô)',
        slug: 'cai-cuc-rau-tan-o',
        category: 'vegetables',
        categoryVi: 'Rau củ',
        description: 'Nấu canh thịt băm thơm ngon',
        price: '15.000đ',
        priceNumber: 15000,
      },
      {
        _id: '3',
        name: 'Táo Envy Mỹ Nhập Khẩu',
        slug: 'tao-envy-my-nhap-khau',
        category: 'fruits',
        categoryVi: 'Trái cây',
        price: '120.000đ',
        priceNumber: 120000,
      }
    ]);

    // Test unaccented query "thit"
    comp.searchQuery.set('thit');
    let suggestions = comp.suggestedProducts();
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].name).toBe('Thịt Bắp Bò Úc Tươi');

    // Test accented query "táo"
    comp.searchQuery.set('táo');
    suggestions = comp.suggestedProducts();
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].name).toBe('Táo Envy Mỹ Nhập Khẩu');

    // Test clearSearch
    comp.clearSearch();
    expect(comp.searchQuery()).toBe('');
    expect(comp.suggestedProducts().length).toBe(0);
  });
});
