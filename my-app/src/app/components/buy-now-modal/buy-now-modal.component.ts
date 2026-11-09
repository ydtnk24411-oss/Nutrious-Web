import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService, formatPrice, unitPriceOf } from '../../shared/services/cart.service';

@Component({
  selector: 'app-buy-now-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './buy-now-modal.component.html',
  styleUrl: './buy-now-modal.component.css',
})
export class BuyNowModalComponent {
  protected cart = inject(CartService);
  private router = inject(Router);

  readonly isOpen = this.cart.buyNowModalOpen;
  readonly product = this.cart.buyNowProduct;
  readonly quantity = this.cart.buyNowQuantity;
  readonly selectedOption = this.cart.buyNowOption;

  readonly unitPrice = computed(() => {
    const p = this.product();
    return p ? unitPriceOf(p) : 0;
  });

  readonly lineTotal = computed(() => {
    return this.unitPrice() * this.quantity();
  });

  formatPrice(val: number): string {
    return formatPrice(val);
  }

  increase(): void {
    this.cart.setBuyNowQuantity(this.quantity() + 1);
  }

  decrease(): void {
    if (this.quantity() > 1) {
      this.cart.setBuyNowQuantity(this.quantity() - 1);
    }
  }

  onQtyInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const val = parseInt(target.value, 10);
    this.cart.setBuyNowQuantity(isNaN(val) || val < 1 ? 1 : val);
  }

  selectOption(opt: string): void {
    this.cart.setBuyNowOption(opt);
  }

  close(): void {
    this.cart.closeBuyNowModal();
  }

  confirm(): void {
    const p = this.product();
    if (!p) return;
    this.cart.startBuyNow(p, this.quantity(), this.selectedOption());
    this.cart.closeCartDrawer();
    this.router.navigate(['/checkout'], { queryParams: { mode: 'buynow', t: Date.now() } });
  }
}
