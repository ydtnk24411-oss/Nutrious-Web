import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice, getCartItemKey } from '../../shared/services/cart.service';
import { XanhLaCartItem, EvaluatedCartItemPricing } from '../../shared/models/xanh-la.models';

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
  protected itemKey = getCartItemKey;

  /** Kiểm tra item có đang được chọn không */
  isSelected(item: XanhLaCartItem): boolean {
    return this.cart.isSelectedItem(item);
  }

  /** Toggle chọn/bỏ chọn một item */
  toggleItem(item: XanhLaCartItem): void {
    this.cart.toggleCartItem(item);
  }

  pricing(item: XanhLaCartItem): EvaluatedCartItemPricing {
    return this.cart.getItemPricing(item, 'selected');
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

  get shippingDiscountHint(): { amount: number; text: string } {
    const sub = this.selectedSubtotal;
    if (sub >= 499000) return { amount: 15000, text: 'Đơn từ 499k: Giảm 15.000đ phí ship' };
    if (sub >= 299000) return { amount: 10000, text: 'Đơn từ 299k: Giảm 10.000đ phí ship' };
    if (sub >= 199000) return { amount: 5000, text: 'Đơn từ 199k: Giảm 5.000đ phí ship' };
    return { amount: 0, text: 'Mua từ 199.000đ để được giảm 5.000đ phí ship' };
  }

  goToCheckout(): void {
    if (this.selectedCount === 0) return;
    this.router.navigate(['/checkout']);
  }
}
