import { Injectable, signal, computed } from '@angular/core';
import { XanhLaProduct, XanhLaCartItem, XanhLaUser, XanhLaAddress } from '../models/xanh-la.models';

const USER_KEY    = 'xanhla_user_session';

// Key giỏ hàng riêng theo từng user
function cartKey(email: string): string {
  return `xanhla_cart__${email}`;
}

export type AuthTab = 'login' | 'signup';

function priceValue(price: string): number {
  return Number(price.replace(/[^\d.]/g, ''));
}

export function formatPrice(value: number): string {
  return value.toLocaleString('vi-VN') + 'đ';
}

@Injectable({ providedIn: 'root' })
export class CartService {

  // ── Auth (load trước, cart phụ thuộc vào user) ──────────
  private _currentUser = signal<XanhLaUser | null>(this._loadUser());
  readonly currentUser = this._currentUser.asReadonly();

  private _authModalOpen = signal(false);
  readonly authModalOpen = this._authModalOpen.asReadonly();

  private _authTab = signal<AuthTab>('login');
  readonly authTab = this._authTab.asReadonly();

  // ── Cart state ──────────────────────────────────────────
  // Nếu đã login: load giỏ hàng của user đó
  // Nếu chưa login: giỏ trống
  private _items = signal<XanhLaCartItem[]>(
    this._currentUser() ? this._loadCartForUser(this._currentUser()!.email) : []
  );
  readonly items = this._items.asReadonly();

  readonly itemCount = computed(() =>
    this._items().reduce((t, i) => t + i.quantity, 0)
  );
  readonly subtotal = computed(() =>
    this._items().reduce((t, i) => t + priceValue(i.product.price) * i.quantity, 0)
  );

  // ── Drawer ──────────────────────────────────────────────
  private _cartDrawerOpen = signal(false);
  readonly cartDrawerOpen = this._cartDrawerOpen.asReadonly();

  // ── Cart methods ────────────────────────────────────────

  addItem(product: XanhLaProduct, quantity = 1, selectedOption?: string): void {
    // Chỉ cho phép thêm nếu đã đăng nhập
    if (!this._currentUser()) {
      this.openAuthModal('login');
      return;
    }
    this._items.update((current) => {
      const idx = current.findIndex(
        (i) => i.product.slug === product.slug && i.selectedOption === selectedOption
      );
      const updated = idx >= 0
        ? current.map((i, index) =>
            index === idx ? { ...i, quantity: i.quantity + quantity } : i
          )
        : [...current, { product, quantity, selectedOption }];
      this._saveCartForCurrentUser(updated);
      return updated;
    });
    this._cartDrawerOpen.set(true);
  }

  updateQuantity(slug: string, quantity: number): void {
    this._items.update((current) => {
      const updated = quantity <= 0
        ? current.filter((i) => i.product.slug !== slug)
        : current.map((i) => i.product.slug === slug ? { ...i, quantity } : i);
      this._saveCartForCurrentUser(updated);
      return updated;
    });
  }

  removeItem(slug: string): void {
    this._items.update((current) => {
      const updated = current.filter((i) => i.product.slug !== slug);
      this._saveCartForCurrentUser(updated);
      return updated;
    });
  }

  /** Xóa giỏ hàng UI + xóa storage của user hiện tại */
  clear(): void {
    const u = this._currentUser();
    this._items.set([]);
    if (u) {
      try { localStorage.removeItem(cartKey(u.email)); } catch { /**/ }
    }
  }

  openCartDrawer(): void  { this._cartDrawerOpen.set(true); }
  closeCartDrawer(): void { this._cartDrawerOpen.set(false); }

  // ── Auth methods ────────────────────────────────────────

  login(email: string, name?: string): void {
    const user: XanhLaUser = { name: name ?? email.split('@')[0], email };
    this._currentUser.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._authModalOpen.set(false);
    // Restore giỏ hàng của user này (nếu có từ lần trước)
    this._items.set(this._loadCartForUser(email));
  }

  signup(name: string, email: string): void {
    const user: XanhLaUser = { name, email };
    this._currentUser.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._authModalOpen.set(false);
    // User mới → giỏ trống (chưa có cart key)
    this._items.set(this._loadCartForUser(email));
  }

  updateUser(patch: Partial<XanhLaUser>): void {
    const current = this._currentUser();
    if (!current) return;
    const updated = { ...current, ...patch };
    this._currentUser.set(updated);
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
  }

  addAddress(addr: XanhLaAddress): void {
    const current = this._currentUser();
    if (!current) return;
    const addresses = current.addresses ?? [];
    const newList = addr.isDefault
      ? [...addresses.map(a => ({ ...a, isDefault: false })), addr]
      : [...addresses, addr];
    this.updateUser({ addresses: newList });
  }

  removeAddress(id: string): void {
    const current = this._currentUser();
    if (!current) return;
    this.updateUser({ addresses: (current.addresses ?? []).filter(a => a.id !== id) });
  }

  logout(): void {
    // Lưu giỏ hàng hiện tại trước khi logout (đã lưu liên tục, chắc chắn rồi)
    this._currentUser.set(null);
    localStorage.removeItem(USER_KEY);
    // Xóa giỏ hàng khỏi UI — không xóa storage của user đó
    this._items.set([]);
  }

  openAuthModal(tab: AuthTab = 'login'): void {
    this._authTab.set(tab);
    this._authModalOpen.set(true);
  }

  closeAuthModal(): void { this._authModalOpen.set(false); }
  setAuthTab(tab: AuthTab): void { this._authTab.set(tab); }

  // ── Private helpers ─────────────────────────────────────

  private _loadCartForUser(email: string): XanhLaCartItem[] {
    try {
      const raw = localStorage.getItem(cartKey(email));
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private _saveCartForCurrentUser(items: XanhLaCartItem[]): void {
    const u = this._currentUser();
    if (!u) return;
    try { localStorage.setItem(cartKey(u.email), JSON.stringify(items)); } catch { /**/ }
  }

  private _loadUser(): XanhLaUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}
