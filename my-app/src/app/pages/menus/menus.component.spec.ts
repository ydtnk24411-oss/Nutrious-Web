import { TestBed } from '@angular/core/testing';
import { MenusComponent } from './menus.component';
import { provideRouter } from '@angular/router';
describe('MenusComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MenusComponent], providers: [provideRouter([])] }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(MenusComponent).componentInstance).toBeTruthy(); });
});
