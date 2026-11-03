import { Component, inject } from '@angular/core';
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

  isSelected(slug: string, selectedOption?: string): boolean {
    return this.cart.isSelected(slug, selectedOption);
  }

  toggleItem(slug: string, selectedOption?: string): void {
    this.cart.toggleItem(slug, selectedOption);
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
