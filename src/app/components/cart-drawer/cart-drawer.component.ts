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

  goToCheckout(): void {
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
