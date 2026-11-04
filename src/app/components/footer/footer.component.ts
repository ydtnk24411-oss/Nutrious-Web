import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../shared/services/api.service';
import { CategoryApiService, ApiCategory } from '../../shared/services/category-api.service';
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
  serviceLinks?: FooterNavLink[];
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
  private categoryApi = inject(CategoryApiService);

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
  protected serviceLinks = signal<FooterNavLink[]>([]);
  protected utilityLinks = signal<FooterNavLink[]>([]);
  protected aboutLinks = signal<FooterNavLink[]>([]);
  protected policyLinks = signal<FooterNavLink[]>([]);
  protected socialLinks = signal<FooterSocialLink[]>([]);
  protected paymentMethods = signal<string[]>([]);
  protected categories = signal<ApiCategory[]>([]);
  protected policiesMap = signal<Record<string, PolicyContent>>({});
  protected activePolicy = signal<PolicyContent | null>(null);

  ngOnInit(): void {
    this.api.get<{ success: boolean; data: FooterConfigResponse }>('/footer').subscribe({
      next: res => {
        const cfg = res?.data;
        if (!cfg) return;
        if (cfg.brandName) this.brandName.set(cfg.brandName);
        if (cfg.brandDesc) this.brandDesc.set(cfg.brandDesc);
        if (cfg.newsletterTitle) this.newsletterTitle.set(cfg.newsletterTitle);
        if (cfg.newsletterDesc) this.newsletterDesc.set(cfg.newsletterDesc);
        if (cfg.copyrightText) this.copyrightText.set(cfg.copyrightText);
        if (cfg.contactInfo) this.contactInfo.set(cfg.contactInfo);
        if (cfg.trustItems?.length) this.trustItems.set(cfg.trustItems);
        if (cfg.serviceLinks?.length) this.serviceLinks.set(cfg.serviceLinks);
        if (cfg.utilityLinks?.length) this.utilityLinks.set(cfg.utilityLinks);
        if (cfg.aboutLinks?.length) this.aboutLinks.set(cfg.aboutLinks);
        if (cfg.policyLinks?.length) this.policyLinks.set(cfg.policyLinks);
        if (cfg.socialLinks?.length) this.socialLinks.set(cfg.socialLinks);
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

    this.categoryApi.getAll().subscribe({
      next: res => {
        if (res?.data?.length) {
          this.categories.set(res.data.slice(0, 4));
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
