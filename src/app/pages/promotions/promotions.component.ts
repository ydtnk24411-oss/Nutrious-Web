import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, ShellComponent],
  templateUrl: './promotions.component.html',
  styleUrl: './promotions.component.css',
})
export class PromotionsComponent {
  private router = inject(Router);

  activeTab = signal<'vouchers' | 'points'>('vouchers');

  setTab(tab: 'vouchers' | 'points') {
    this.activeTab.set(tab);
  }

  // Redirect to existing pages
  goToVouchers() {
    this.router.navigate(['/vouchers']);
  }

  goToLoyalty() {
    this.router.navigate(['/loyalty']);
  }
}
