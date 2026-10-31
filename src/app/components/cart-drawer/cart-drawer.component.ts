import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService, formatPrice } from '../../shared/services/cart.service';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart-drawer.component.html',
  styleUrl: './cart-drawer.component.css',
})
export class CartDrawerComponent {
  protected cart = inject(CartService);
  private router = inject(Router);
  protected formatPrice = formatPrice;

  /** Tập hợp key các item đang được chọn trong drawer */
  private _selectedKeys = signal<Set<string>>(new Set());

  /** Key duy nhất mỗi item */
  itemKey(slug: string, selectedOption?: string): string {
    return slug + '|' + (selectedOption ?? '');
  }

  isSelected(slug: string, selectedOption?: string): boolean {
    return this._selectedKeys().has(this.itemKey(slug, selectedOption));
  }

  toggleItem(slug: string, selectedOption?: string): void {
    const key = this.itemKey(slug, selectedOption);
    this._selectedKeys.update(set => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  get allSelected(): boolean {
    const items = this.cart.items();
    if (items.length === 0) return false;
    return items.every(i => this.isSelected(i.product.slug, i.selectedOption));
  }

  toggleAll(): void {
    if (this.allSelected) {
      this._selectedKeys.set(new Set());
    } else {
      const allKeys = this.cart.items().map(i => this.itemKey(i.product.slug, i.selectedOption));
      this._selectedKeys.set(new Set(allKeys));
    }
  }

  get selectedCount(): number {
    return this.cart.items().filter(i => this.isSelected(i.product.slug, i.selectedOption)).length;
  }

  get selectedSubtotal(): number {
    return this.cart.items()
      .filter(i => this.isSelected(i.product.slug, i.selectedOption))
      .reduce((sum, i) => sum + Number(i.product.price.replace(/[^\d]/g, '')) * i.quantity, 0);
  }

  goToCheckout(): void {
    if (this.selectedCount === 0) return;
    this.cart.closeCartDrawer();
    this.router.navigate(['/checkout']);
  }

  goToCart(): void {
    this.cart.closeCartDrawer();
    this.router.navigate(['/cart']);
  }

  goToShop(): void {
    this.cart.closeCartDrawer();
    this.router.navigate(['/category/all-products']);
  }
}
