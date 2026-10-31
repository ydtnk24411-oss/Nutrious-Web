import { Component, inject, signal } from '@angular/core';
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

  /** Tập hợp các slug + option đã được tick chọn */
  private _selectedKeys = signal<Set<string>>(new Set());

  /** Key duy nhất cho mỗi item (slug + option) */
  itemKey(slug: string, selectedOption?: string): string {
    return slug + '|' + (selectedOption ?? '');
  }

  /** Kiểm tra item có đang được chọn không */
  isSelected(slug: string, selectedOption?: string): boolean {
    return this._selectedKeys().has(this.itemKey(slug, selectedOption));
  }

  /** Toggle chọn/bỏ chọn một item */
  toggleItem(slug: string, selectedOption?: string): void {
    const key = this.itemKey(slug, selectedOption);
    this._selectedKeys.update(set => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  /** Kiểm tra tất cả item đang được chọn */
  get allSelected(): boolean {
    const items = this.cart.items();
    if (items.length === 0) return false;
    return items.every(i => this.isSelected(i.product.slug, i.selectedOption));
  }

  /** Chọn / bỏ chọn tất cả */
  toggleAll(): void {
    if (this.allSelected) {
      this._selectedKeys.set(new Set());
    } else {
      const allKeys = this.cart.items().map(i => this.itemKey(i.product.slug, i.selectedOption));
      this._selectedKeys.set(new Set(allKeys));
    }
  }

  /** Số item đang được chọn */
  get selectedCount(): number {
    return this.cart.items().filter(i => this.isSelected(i.product.slug, i.selectedOption)).length;
  }

  /** Tổng tiền chỉ tính các item được chọn */
  get selectedSubtotal(): number {
    return this.cart.items()
      .filter(i => this.isSelected(i.product.slug, i.selectedOption))
      .reduce((sum, i) => {
        const raw = i.product.price.replace(/[^\d]/g, '');
        return sum + Number(raw) * i.quantity;
      }, 0);
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
