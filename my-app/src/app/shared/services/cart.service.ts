import { Injectable, signal, computed, inject } from '@angular/core';
import { XanhLaProduct, XanhLaCartItem, XanhLaUser, XanhLaAddress } from '../models/xanh-la.models';
import { ApiService } from './api.service';

const USER_KEY     = 'xanhla_user_session';
const TOKEN_KEY    = 'xanhla_auth_token';
const SELECTED_KEY = 'xanhla_selected_keys';

// Key giỏ hàng riêng theo từng user
function cartKey(email: string): string {
  return `xanhla_cart__${email}`;
}

export function cartItemKey(slug: string, selectedOption?: string): string {
  return `${slug}|${selectedOption ?? ''}`;
}

export type AuthTab = 'login' | 'signup';

function priceValue(price: string): number {
  return Number(price.replace(/[^\d]/g, ''));
}

export function formatPrice(value: number): string {
  return value.toLocaleString('vi-VN') + 'đ';
}

function loadSavedSelectedKeys(): Set<string> | null {
  try {
    const raw = sessionStorage.getItem(SELECTED_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : null;
  } catch {
    return null;
  }
}

function persistSelectedKeys(keys: Set<string>): void {
  try {
    sessionStorage.setItem(SELECTED_KEY, JSON.stringify(Array.from(keys)));
  } catch {}
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private api = inject(ApiService);

  // ── Auth ────────────────────────────────────────────────
  private _currentUser = signal<XanhLaUser | null>(this._loadUser());
  readonly currentUser = this._currentUser.asReadonly();

  private _authModalOpen = signal(false);
  readonly authModalOpen = this._authModalOpen.asReadonly();

  private _authTab = signal<AuthTab>('login');
  readonly authTab = this._authTab.asReadonly();

  // ── Cart state ──────────────────────────────────────────
  private _items = signal<XanhLaCartItem[]>([]);
  readonly items = this._items.asReadonly();

  // ── Cart item selection (tick chọn sản phẩm để thanh toán) ──
  private _selectedKeys = signal<Set<string>>(new Set());
  readonly selectedKeys = this._selectedKeys.asReadonly();

  constructor() {
    const user = this._currentUser();
    if (user) {
      const loaded = this._loadCartForUser(user.email);
      this._items.set(loaded);

      const saved = loadSavedSelectedKeys();
      const allItemKeys = new Set(loaded.map(i => cartItemKey(i.product.slug, i.selectedOption)));
      if (saved && saved.size > 0) {
        const validKeys = new Set([...saved].filter(k => allItemKeys.has(k)));
        this._selectedKeys.set(validKeys.size > 0 ? validKeys : allItemKeys);
      } else {
        this._selectedKeys.set(allItemKeys);
      }

      this.loadUserData();
    }
  }

  readonly isSelected = (slug: string, selectedOption?: string): boolean => {
    return this._selectedKeys().has(cartItemKey(slug, selectedOption));
  };

  toggleItem(slug: string, selectedOption?: string): void {
    const key = cartItemKey(slug, selectedOption);
    this._selectedKeys.update(set => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      persistSelectedKeys(next);
      return next;
    });
  }

  toggleAll(): void {
    if (this.allSelected()) {
      const empty = new Set<string>();
      this._selectedKeys.set(empty);
      persistSelectedKeys(empty);
    } else {
      const allKeys = this._items().map(i => cartItemKey(i.product.slug, i.selectedOption));
      const next = new Set(allKeys);
      this._selectedKeys.set(next);
      persistSelectedKeys(next);
    }
  }

  readonly allSelected = computed(() => {
    const items = this._items();
    if (items.length === 0) return false;
    return items.every(i => this._selectedKeys().has(cartItemKey(i.product.slug, i.selectedOption)));
  });

  // Chỉ lấy các sản phẩm ĐƯỢC CHỌN để thanh toán
  readonly selectedItems = computed(() => {
    return this._items().filter(i =>
      this._selectedKeys().has(cartItemKey(i.product.slug, i.selectedOption))
    );
  });

  readonly selectedCount = computed(() =>
    this.selectedItems().length
  );

  readonly selectedSubtotal = computed(() =>
    this.selectedItems().reduce((t, i) => t + priceValue(i.product.price) * i.quantity, 0)
  );

  /** Khi mua ngay 1 sản phẩm: chỉ chọn duy nhất sản phẩm đó */
  selectOnly(slug: string, selectedOption?: string): void {
    const next = new Set([cartItemKey(slug, selectedOption)]);
    this._selectedKeys.set(next);
    persistSelectedKeys(next);
  }

  /** Xóa chỉ những sản phẩm ĐÃ MUA khỏi giỏ hàng, giữ lại những sản phẩm chưa chọn */
  removeSelectedItems(): void {
    const selected = this._selectedKeys();
    this._items.update((current) => {
      const remaining = current.filter(
        i => !selected.has(cartItemKey(i.product.slug, i.selectedOption))
      );
      this._saveCartForCurrentUser(remaining);
      return remaining;
    });
    // Reset selection về tất cả các món còn lại
    const remainingKeys = this._items().map(i => cartItemKey(i.product.slug, i.selectedOption));
    const next = new Set(remainingKeys);
    this._selectedKeys.set(next);
    persistSelectedKeys(next);
  }

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
    if (!this._currentUser()) {
      this.openAuthModal('login');
      return;
    }
    const key = cartItemKey(product.slug, selectedOption);
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
    // Tự động tick chọn sản phẩm vừa thêm
    this._selectedKeys.update(set => {
      const next = new Set(set);
      next.add(key);
      persistSelectedKeys(next);
      return next;
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
    if (quantity <= 0) {
      this._selectedKeys.update(set => {
        const next = new Set([...set].filter(k => !k.startsWith(slug + '|')));
        persistSelectedKeys(next);
        return next;
      });
    }
  }

  removeItem(slug: string): void {
    this._items.update((current) => {
      const updated = current.filter((i) => i.product.slug !== slug);
      this._saveCartForCurrentUser(updated);
      return updated;
    });
    this._selectedKeys.update(set => {
      const next = new Set([...set].filter(k => !k.startsWith(slug + '|')));
      persistSelectedKeys(next);
      return next;
    });
  }

  /** Xóa toàn bộ giỏ hàng UI + xóa storage của user hiện tại */
  clear(): void {
    const u = this._currentUser();
    this._items.set([]);
    this._selectedKeys.set(new Set());
    persistSelectedKeys(new Set());
    if (u) {
      try { localStorage.removeItem(cartKey(u.email)); } catch { /**/ }
    }
  }

  openCartDrawer(): void  { this._cartDrawerOpen.set(true); }
  closeCartDrawer(): void { this._cartDrawerOpen.set(false); }

  // ── Auth methods ────────────────────────────────────────

  /** Token hết hạn / bị từ chối (401): xóa phiên và mở form đăng nhập lại. */
  expireSession(): void {
    if (!this._currentUser()) return;
    this.logout();
    this.openAuthModal('login');
  }

  // Login with email and password
  loginWithPassword(email: string, password: string): void {
    this.api.post('/auth/login', {
      email: email.trim().toLowerCase(),
      password
    }).subscribe({
      next: (res: any) => {
        if (res.success && res.user && res.token) {
          const user: XanhLaUser = res.user;

          this._currentUser.set(user);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
          localStorage.setItem(TOKEN_KEY, res.token);

          this._authModalOpen.set(false);

          // Khôi phục giỏ hàng
          const loaded = this._loadCartForUser(user.email);
          this._items.set(loaded);
          const allKeys = new Set(loaded.map(i => cartItemKey(i.product.slug, i.selectedOption)));
          this._selectedKeys.set(allKeys);
          persistSelectedKeys(allKeys);

          // Load full user data từ backend
          this.loadUserData();
        } else {
          alert('Đăng nhập thất bại: ' + (res.message || 'Dữ liệu trả về không hợp lệ.'));
        }
      },
      error: (err) => {
        console.error('Login error:', err);
        const errorMsg = err.error?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
        alert(errorMsg);
      }
    });
  }

  public loadUserData(): void {
    this.api.get('/account/me').subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this._currentUser.set(res.data);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        }
      },
      error: (err) => {
        console.error('Failed to load user data:', err);
      }
    });
  }

  signup(
    name: string,
    email: string,
    password: string,
    onSuccess?: () => void
  ): void {
    this.api.post('/auth/register', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password
    }).subscribe({
      next: (res: any) => {
        if (res.success && res.token && (res.user || res.data)) {
          // Tự động đăng nhập luôn với tài khoản vừa tạo
          const user: XanhLaUser = res.user || res.data;

          this._currentUser.set(user);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
          localStorage.setItem(TOKEN_KEY, res.token);

          this._authModalOpen.set(false);
          this._items.set([]);
          this._selectedKeys.set(new Set());
          persistSelectedKeys(new Set());

          this.loadUserData();
          alert(`Đăng ký thành công! Chào mừng ${user.name} đến với Evergreen Mart.`);
          onSuccess?.();
        } else {
          alert('Đăng ký thất bại: ' + (res.message || 'Vui lòng thử lại.'));
        }
      },
      error: (err) => {
        console.error('Signup error:', err);
        const errorMsg = err.error?.message || 'Đăng ký thất bại. Vui lòng thử lại.';
        alert(errorMsg);
      }
    });
  }

  updateUser(patch: Partial<XanhLaUser>): void {
    const current = this._currentUser();
    if (!current) return;

    const updated = { ...current, ...patch };
    this._currentUser.set(updated);
    localStorage.setItem(USER_KEY, JSON.stringify(updated));

    this.api.put('/account/me', patch).subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this._currentUser.set(res.data);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        }
      },
      error: (err) => {
        console.error('Failed to update user profile:', err);
      }
    });
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
    this._currentUser.set(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(SELECTED_KEY);
    this._items.set([]);
    this._selectedKeys.set(new Set());
    persistSelectedKeys(new Set());
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
      const token = localStorage.getItem(TOKEN_KEY);
      if (!raw || !token) {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return JSON.parse(raw);
    } catch { return null; }
  }
}
