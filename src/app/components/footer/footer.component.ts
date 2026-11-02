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

export interface FooterConfigResponse {
  brandName: string;
  brandDesc: string;
  contactInfo: {
    hotline: string;
    email: string;
    address: string;
  };
  trustItems: FooterTrustItem[];
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

  protected brandName = signal('Xanh Lá');
  protected brandDesc = signal(
    'Nông sản, thực phẩm lành mạnh và dịch vụ dinh dưỡng cho những bữa ăn gần gũi mỗi ngày.'
  );
  protected contactInfo = signal({
    hotline: '1900 6789 (07:00 – 21:00)',
    email: 'chamsoc@xanhla.vn',
    address: 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
  });
  protected trustItems = signal<FooterTrustItem[]>([]);
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
        if (cfg.contactInfo) this.contactInfo.set(cfg.contactInfo);
        if (cfg.trustItems?.length) this.trustItems.set(cfg.trustItems);
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
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (this.policiesMap()[sectionId]) {
      this.activePolicy.set(this.policiesMap()[sectionId]);
    }
  }
}
