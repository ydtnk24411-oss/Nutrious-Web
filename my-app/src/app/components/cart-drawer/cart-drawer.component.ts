import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService, formatPrice, getCartItemKey } from '../../shared/services/cart.service';
import { XanhLaCartItem, EvaluatedCartItemPricing } from '../../shared/models/xanh-la.models';

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
  protected itemKey = getCartItemKey;

  isSelected(item: XanhLaCartItem): boolean {
    return this.cart.isSelectedItem(item);
  }

  toggleItem(item: XanhLaCartItem): void {
    this.cart.toggleCartItem(item);
  }

  pricing(item: XanhLaCartItem): EvaluatedCartItemPricing {
    return this.cart.getItemPricing(item, 'selected');
  }

  get allSelected(): boolean {
    return this.cart.allSelected();
  }

  toggleAll(): void {
    this.cart.toggleAll();
  }

  get selectedCount(): number {
    return this.cart.selectedCount();
  }

  get selectedSubtotal(): number {
    return this.cart.selectedSubtotal();
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
