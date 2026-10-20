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

  goToCheckout(): void { this.router.navigate(['/checkout']); }
}
