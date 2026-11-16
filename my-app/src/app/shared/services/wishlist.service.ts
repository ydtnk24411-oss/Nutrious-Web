import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { ApiService } from './api.service';
import { CartService } from './cart.service';
import { ApiProduct } from './product-api.service';

const STORAGE_KEY = 'xanhla_wishlist';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private api = inject(ApiService);
  private cart = inject(CartService);

  private _wishlistIds = signal<Set<string>>(new Set());
  private _wishlistProducts = signal<ApiProduct[]>([]);
  readonly loading = signal(false);

  readonly wishlistIds = this._wishlistIds.asReadonly();
  readonly wishlistProducts = this._wishlistProducts.asReadonly();
  readonly items = this._wishlistProducts.asReadonly();
  readonly count = computed(() => this._wishlistIds().size);

  constructor() {
    this.loadFromLocalStorage();

    // Tự động đồng bộ lên MongoDB khi khách đăng nhập
    effect(() => {
      const user = this.cart.currentUser();
      if (user) {
        this.syncWithServer();
      } else {
        this.loadFromLocalStorage();
      }
    });
  }

  private loadFromLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this._wishlistIds.set(new Set(arr.map(String)));
        }
      }
    } catch {}
  }

  private saveToLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const arr = Array.from(this._wishlistIds());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {}
  }

  /** Đồng bộ danh sách yêu thích giữa localStorage và MongoDB khi đăng nhập */
  syncWithServer(): void {
    const localIds = Array.from(this._wishlistIds());
    if (localIds.length > 0) {
      this.api.post<{ success: boolean; data: ApiProduct[] }>('/account/wishlist/sync', { productIds: localIds }).subscribe({
        next: (res) => {
          if (res.success && Array.isArray(res.data)) {
            this._wishlistProducts.set(res.data);
            const ids = new Set(res.data.map(p => String(p._id || (p as any).id)));
            this._wishlistIds.set(ids);
            this.saveToLocalStorage();
          }
        },
      });
    } else {
      this.loadFromServer();
    }
  }

  loadFromServer(): void {
    if (!this.cart.currentUser()) return;
    this.api.get<{ success: boolean; data: ApiProduct[] }>('/account/wishlist').subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this._wishlistProducts.set(res.data);
          const ids = new Set(res.data.map(p => String(p._id || (p as any).id)));
          this._wishlistIds.set(ids);
          this.saveToLocalStorage();
        }
      },
    });
  }

  isInWishlist(productId: string | undefined): boolean {
    if (!productId) return false;
    return this._wishlistIds().has(String(productId));
  }

  isWishlisted(productId: string | undefined): boolean {
    return this.isInWishlist(productId);
  }

  toggleWishlist(product: ApiProduct | any): boolean {
    const id = String(product._id || product.id);
    if (!id) return false;

    const currentIds = new Set(this._wishlistIds());
    let added = false;

    if (currentIds.has(id)) {
      currentIds.delete(id);
      this._wishlistProducts.update(list => list.filter(p => String(p._id || (p as any).id) !== id));
      added = false;
    } else {
      currentIds.add(id);
      this._wishlistProducts.update(list => [product, ...list.filter(p => String(p._id || (p as any).id) !== id)]);
      added = true;
    }

    this._wishlistIds.set(currentIds);
    this.saveToLocalStorage();

    // Nếu đã đăng nhập, đồng bộ lên server
    if (this.cart.currentUser()) {
      this.api.post<{ success: boolean; added: boolean }>('/account/wishlist/toggle', { productId: id }).subscribe();
    }

    return added;
  }
}
