import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { ApiService } from './api.service';

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('xanhla_analytics_sid');
    if (!sid) {
      sid = 'sid_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      sessionStorage.setItem('xanhla_analytics_sid', sid);
    }
    return sid;
  } catch {
    return 'sid_fallback';
  }
}

function detectDevice(): 'mobile' | 'desktop' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

@Injectable({ providedIn: 'root' })
export class AnalyticsTrackerService {
  private api = inject(ApiService);
  private router = inject(Router);

  private sessionId = getSessionId();
  private deviceType = detectDevice();
  private pageStartTime = Date.now();
  private currentPath = '';

  init(): void {
    if (typeof window === 'undefined') return;

    // Track initial page
    this.currentPath = window.location.pathname;
    this.trackPageView(this.currentPath);

    // Track navigation changes
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        // Track duration on previous page
        const durationSec = Math.round((Date.now() - this.pageStartTime) / 1000);
        if (this.currentPath && durationSec > 1) {
          this.track('page_duration', {
            path: this.currentPath,
            durationSeconds: durationSec,
          });
        }

        this.pageStartTime = Date.now();
        this.currentPath = event.urlAfterRedirects;
        this.trackPageView(this.currentPath);
      });

    // Listen to visibilitychange / beforeunload for final duration
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const durationSec = Math.round((Date.now() - this.pageStartTime) / 1000);
        if (durationSec > 0) {
          this.trackBeacon('page_duration', {
            path: this.currentPath,
            durationSeconds: durationSec,
          });
        }
      }
    });

    // Capture global JS error rates
    window.addEventListener('error', (e) => {
      this.track('error', {
        errorMessage: e.message || 'Window error',
        path: this.currentPath,
      });
    });
  }

  trackPageView(path: string): void {
    const perfTiming = window.performance?.timing;
    let loadTimeMs = 0;
    if (perfTiming && perfTiming.loadEventEnd > 0) {
      loadTimeMs = Math.max(0, perfTiming.loadEventEnd - perfTiming.navigationStart);
    }

    this.track('pageview', {
      path,
      loadTimeMs,
      referrer: document.referrer || '',
    });
  }

  track(eventType: string, data: Record<string, any> = {}): void {
    const payload = {
      sessionId: this.sessionId,
      deviceType: this.deviceType,
      path: data['path'] || this.currentPath || window.location.pathname,
      eventType,
      timestamp: new Date().toISOString(),
      ...data,
    };

    this.api.post('/analytics/track', payload).subscribe({
      next: () => {},
      error: () => {},
    });
  }

  trackBeacon(eventType: string, data: Record<string, any> = {}): void {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const payload = JSON.stringify({
        sessionId: this.sessionId,
        deviceType: this.deviceType,
        path: data['path'] || this.currentPath,
        eventType,
        timestamp: new Date().toISOString(),
        ...data,
      });
      navigator.sendBeacon('/api/analytics/track', new Blob([payload], { type: 'application/json' }));
    } else {
      this.track(eventType, data);
    }
  }

  // Tiện ích sự kiện phổ biến
  trackSearch(query: string, resultCountOrHasResults: number | boolean = true): void {
    const q = (query || '').trim();
    if (!q || q.length < 2) return;
    const isBool = typeof resultCountOrHasResults === 'boolean';
    const resultCount = isBool ? (resultCountOrHasResults ? 1 : 0) : Number(resultCountOrHasResults) || 0;
    const hasResults = resultCount > 0;
    this.track('search', {
      searchQuery: q,
      searchHasResults: hasResults,
      searchResultCount: resultCount,
    });
  }

  trackViewItem(product: { id?: string; slug?: string; name: string; price?: number; category?: string }): void {
    this.track('view_item', {
      productId: product.id || product.slug,
      productName: product.name,
      productPrice: product.price || 0,
      category: product.category || '',
    });
  }

  trackAddToCart(item: { name: string; price: number; quantity: number }): void {
    this.track('add_to_cart', {
      productName: item.name,
      productPrice: item.price,
      cartItemCount: item.quantity,
    });
  }

  trackRemoveFromCart(productName: string): void {
    this.track('remove_from_cart', { productName });
  }

  trackBeginCheckout(cartTotal: number, itemCount: number): void {
    this.track('begin_checkout', { cartTotal, cartItemCount: itemCount });
  }

  trackCheckoutStep(stepName: string): void {
    this.track('checkout_step', { eventName: stepName });
  }

  trackButtonClick(btnName: string, isCta = false): void {
    this.track('click', { buttonId: btnName, meta: { isCta } });
  }

  trackContact(type: 'inbox' | 'hotline' | 'zalo' | 'form'): void {
    this.track(type === 'inbox' ? 'contact' : 'contact_info', { buttonId: type });
  }
}
