import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice } from '../../shared/services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
})
export class CartComponent {
  protected cart = inject(CartService);
  private router = inject(Router);
  protected formatPrice = formatPrice;

  /** Kiểm tra item có đang được chọn không */
  isSelected(slug: string, selectedOption?: string): boolean {
    return this.cart.isSelected(slug, selectedOption);
  }

  /** Toggle chọn/bỏ chọn một item */
  toggleItem(slug: string, selectedOption?: string): void {
    this.cart.toggleItem(slug, selectedOption);
  }

  /** Kiểm tra tất cả item đang được chọn */
  get allSelected(): boolean {
    return this.cart.allSelected();
  }

  /** Chọn / bỏ chọn tất cả */
  toggleAll(): void {
    this.cart.toggleAll();
  }

  /** Số item đang được chọn */
  get selectedCount(): number {
    return this.cart.selectedCount();
  }

  /** Tổng tiền chỉ tính các item được chọn */
  get selectedSubtotal(): number {
    return this.cart.selectedSubtotal();
  }

  /** Tính thành tiền một item (giá × số lượng) */
  itemSubtotal(price: string, quantity: number): number {
    return Number(price.replace(/[^\d]/g, '')) * quantity;
  }

  goToCheckout(): void {
    if (this.selectedCount === 0) return;
    this.router.navigate(['/checkout']);
  }
}
