import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../shared/services/api.service';
import { logoImage } from '../../shared/data/xanh-la.data';

export interface PolicyContent {
  key?: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  sections: { heading: string; content: string[] }[];
}

export interface FooterTrustItem {
  title: string;
  subtitle: string;
  iconKey: string;
}

export interface FooterNavLink {
  label: string;
  route?: string;
  policyKey?: string;
  icon?: string;
}

export interface FooterSocialLink {
  platform: string;
  label: string;
  url: string;
}

export interface FooterConfigResponse {
  brandName: string;
  brandDesc: string;
  newsletterTitle?: string;
  newsletterDesc?: string;
  copyrightText?: string;
  contactInfo: {
    hotline: string;
    email: string;
    address: string;
  };
  trustItems: FooterTrustItem[];
  utilityLinks?: FooterNavLink[];
  aboutLinks?: FooterNavLink[];
  policyLinks?: FooterNavLink[];
  socialLinks?: FooterSocialLink[];
  paymentMethods: string[];
  policies: PolicyContent[];
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent implements OnInit {
  private api = inject(ApiService);

  protected readonly logoImage = logoImage;
  protected email = signal('');
  protected subscribed = signal(false);
  protected subscribeMessage = signal('Đã đăng ký nhận bản tin thành công!');
  protected emailError = signal('');

  protected brandName = signal('Evergreen Mart');
  protected brandDesc = signal('');
  protected newsletterTitle = signal('Bản tin dinh dưỡng & Ưu đãi Evergreen Mart');
  protected newsletterDesc = signal('');
  protected copyrightText = signal('');
  protected contactInfo = signal({
    hotline: '',
    email: '',
    address: '',
  });
  protected trustItems = signal<FooterTrustItem[]>([]);
  protected utilityLinks = signal<FooterNavLink[]>([]);
  protected aboutLinks = signal<FooterNavLink[]>([]);
  protected policyLinks = signal<FooterNavLink[]>([]);
  protected socialLinks = signal<FooterSocialLink[]>([]);
  protected paymentMethods = signal<string[]>([]);
  protected policiesMap = signal<Record<string, PolicyContent>>({});
  protected activePolicy = signal<PolicyContent | null>(null);

  ngOnInit(): void {
    this.api.get<{ success: boolean; data: FooterConfigResponse }>('/footer').subscribe({
      next: res => {
        const cfg = res?.data;
        if (!cfg) return;
        if (cfg.brandName) {
          const bName = cfg.brandName === 'Xanh Lá' ? 'Evergreen Mart' : cfg.brandName;
          this.brandName.set(bName);
        }
        if (cfg.brandDesc) this.brandDesc.set(cfg.brandDesc);
        if (cfg.newsletterTitle) this.newsletterTitle.set(cfg.newsletterTitle.replace(/Xanh Lá/g, 'Evergreen Mart'));
        if (cfg.newsletterDesc) this.newsletterDesc.set(cfg.newsletterDesc);
        if (cfg.copyrightText) this.copyrightText.set(cfg.copyrightText.replace(/Xanh Lá/g, 'Evergreen Mart'));
        if (cfg.contactInfo) this.contactInfo.set(cfg.contactInfo);
        if (cfg.trustItems?.length) this.trustItems.set(cfg.trustItems);
        if (cfg.utilityLinks?.length) {
          this.utilityLinks.set(
            cfg.utilityLinks.map(l => ({ ...l, label: (l.label || '').replace(/Xanh Lá/g, 'Evergreen Mart') }))
          );
        }
        if (cfg.aboutLinks?.length) {
          this.aboutLinks.set(
            cfg.aboutLinks.map(l => ({ ...l, label: (l.label || '').replace(/Xanh Lá/g, 'Evergreen Mart') }))
          );
        }
        if (cfg.policyLinks?.length) this.policyLinks.set(cfg.policyLinks);
        if (cfg.socialLinks?.length) {
          this.socialLinks.set(
            cfg.socialLinks.map(s => ({ ...s, label: (s.label || '').replace(/Xanh Lá/g, 'Evergreen Mart') }))
          );
        }
        if (cfg.paymentMethods?.length) this.paymentMethods.set(cfg.paymentMethods);
        if (cfg.policies?.length) {
          const map: Record<string, PolicyContent> = {};
          for (const p of cfg.policies) {
            if (p.key) map[p.key] = p;
          }
          this.policiesMap.set(map);
        }
      },
      error: () => {},
    });

  }

  openPolicy(key: string, event: Event): void {
    event.preventDefault();
    const policy = this.policiesMap()[key];
    if (policy) {
      this.activePolicy.set(policy);
    }
  }

  hotlineHref(): string {
    return `tel:${this.contactInfo().hotline.replace(/\D/g, '')}`;
  }

  scrollToTop(): void {
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }

  cleanLabel(label: string): string {
    return (label || '')
      .replace(/Xanh Lá/g, 'Evergreen Mart')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\uFE0E\uFE0F\u200D]/gu, '')
      .trim();
  }

  isFooterLinkVisible(link: FooterNavLink): boolean {
    const route = (link.route || '').trim();
    const cleaned = this.cleanLabel(link.label);
    if (/^\/(event-list|event-details|book-online|service-page)(\/|$)/i.test(route)) {
      return false;
    }
    if (!link.policyKey && /(sự kiện|đặt lịch|lớp học nấu ăn)/i.test(cleaned)) {
      return false;
    }
    return true;
  }

  isUtilityLinkVisible(link: FooterNavLink): boolean {
    return (
      this.isFooterLinkVisible(link) &&
      link.route !== '/loyalty' &&
      !/tích điểm/i.test(this.cleanLabel(link.label))
    );
  }

  closePolicy(): void {
    this.activePolicy.set(null);
  }

  handleSubscribe(e: Event): void {
    e.preventDefault();
    const raw = this.email().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!raw || !emailRegex.test(raw)) {
      this.emailError.set('Vui lòng nhập địa chỉ email hợp lệ.');
      this.subscribed.set(false);
      return;
    }
    this.emailError.set('');

    this.api
      .post<{ success: boolean; message: string }>('/footer/newsletter', { email: raw })
      .subscribe({
        next: res => {
          this.subscribeMessage.set(res.message || 'Đã đăng ký nhận bản tin thành công!');
          this.subscribed.set(true);
          this.email.set('');
          setTimeout(() => this.subscribed.set(false), 5000);
        },
        error: err => {
          this.emailError.set(err.error?.message || 'Không thể đăng ký lúc này, vui lòng thử lại.');
          this.subscribed.set(false);
        },
      });
  }

  scrollToSection(sectionId: string, event: Event): void {
    event.preventDefault();
    if (this.policiesMap()[sectionId]) {
      this.activePolicy.set(this.policiesMap()[sectionId]);
      return;
    }
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
