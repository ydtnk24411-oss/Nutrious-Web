import { TestBed } from '@angular/core/testing';
import { AdminUsersComponent } from './users.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
describe('AdminUsersComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AdminUsersComponent], providers: [provideRouter([]), provideHttpClient()] }).compileComponents();
  });
  it('should create', () => { expect(TestBed.createComponent(AdminUsersComponent).componentInstance).toBeTruthy(); });
});
