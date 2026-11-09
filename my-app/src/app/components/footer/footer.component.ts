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

const DEFAULT_BRAND_NAME = 'Evergreen Mart';
const DEFAULT_BRAND_DESC =
  'Tự hào mang nông sản Việt đạt chuẩn VietGAP, GlobalGAP và Organic từ các nông trại xanh đến tận bàn ăn gia đình bạn mỗi ngày.';
const DEFAULT_NEWSLETTER_TITLE = 'Bản tin dinh dưỡng & Ưu đãi Evergreen Mart';
const DEFAULT_NEWSLETTER_DESC =
  'Đăng ký email để nhận ngay voucher giảm 20%, gợi ý thực đơn dinh dưỡng mỗi tuần và ưu đãi Flash Sale nông sản thu hoạch trong ngày.';
const DEFAULT_CONTACT_INFO = {
  hotline: '1800 6999 (07:00 – 21:00)',
  email: 'chamsoc@evergreenmart.vn',
  address: 'Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
};

const DEFAULT_TRUST_ITEMS: FooterTrustItem[] = [
  { iconKey: 'leaf', title: '100% Hữu Cơ & VietGAP', subtitle: 'Nguồn gốc rõ ràng từ nông trại' },
  { iconKey: 'truck', title: 'Giao Nhanh Trong 2 Giờ', subtitle: 'Giữ trọn độ tươi ngon mỗi ngày' },
  { iconKey: 'shield', title: 'Đồng Kiểm Khi Nhận Hàng', subtitle: 'Đổi trả miễn phí trong 24 giờ' },
  { iconKey: 'headset', title: 'Hỗ Trợ Tận Tâm 24/7', subtitle: 'Hotline tư vấn: 1800 6999' },
];

const DEFAULT_ABOUT_LINKS: FooterNavLink[] = [
  { label: 'Giới thiệu về Evergreen Mart', policyKey: 'about' },
  { label: 'Nông trại & Vùng trồng hữu cơ', route: '/online-ordering' },
  { label: 'Tiêu chuẩn chất lượng VietGAP', policyKey: 'shipping' },
  { label: 'Cẩm nang dinh dưỡng thông minh', route: '/nutrition' },
  { label: 'Liên hệ & Hệ thống phân phối', policyKey: 'contact' },
];

const DEFAULT_UTILITY_LINKS: FooterNavLink[] = [
  { label: '🥗 Dinh dưỡng thông minh', route: '/nutrition' },
  { label: '🍳 Nấu gì với đồ sẵn có?', route: '/cook-with-what-you-have' },
  { label: '📦 Theo dõi đơn hàng', route: '/tracker-page' },
  { label: '🎟️ Ví Voucher của tôi', route: '/vouchers' },
  { label: '⭐ Điểm thưởng & Hạng thành viên', route: '/loyalty' },
];

const DEFAULT_POLICY_LINKS: FooterNavLink[] = [
  { label: 'Chính sách giao hàng & Đồng kiểm', policyKey: 'shipping', icon: 'truck' },
  { label: 'Chính sách đổi trả & Hoàn tiền', policyKey: 'returns', icon: 'refresh' },
  { label: 'Chính sách bảo mật thông tin', policyKey: 'privacy', icon: 'shield' },
  { label: 'Điều khoản sử dụng dịch vụ', policyKey: 'terms', icon: 'doc' },
  { label: 'Câu hỏi thường gặp (FAQ)', policyKey: 'faq', icon: 'help' },
  { label: 'Hướng dẫn đặt hàng & Thanh toán', policyKey: 'help', icon: 'info' },
];

const DEFAULT_SOCIAL_LINKS: FooterSocialLink[] = [
  { platform: 'facebook', label: 'Facebook Evergreen Mart', url: 'https://facebook.com' },
  { platform: 'instagram', label: 'Instagram Evergreen Mart', url: 'https://instagram.com' },
  { platform: 'youtube', label: 'YouTube Evergreen Mart', url: 'https://youtube.com' },
  { platform: 'zalo', label: 'Zalo OA Evergreen Mart', url: 'https://zalo.me' },
];

const DEFAULT_PAYMENT_METHODS: string[] = ['COD', 'VietQR', 'MoMo', 'VNPay', 'ZaloPay', 'Visa/Master'];

const DEFAULT_POLICIES_MAP: Record<string, PolicyContent> = {
  about: {
    key: 'about',
    title: 'Giới Thiệu Về Evergreen Mart',
    subtitle: 'Nông sản hữu cơ tươi sạch & Trợ lý dinh dưỡng thông minh cho gia đình Việt',
    updatedAt: '01/10/2026',
    sections: [
      {
        heading: '1. Sứ mệnh của Evergreen Mart',
        content: [
          'Kết nối trực tiếp nông trại hữu cơ Đà Lạt, miền Tây với bàn ăn gia đình Việt mỗi ngày.',
          'Ứng dụng công nghệ Dinh dưỡng thông minh giúp gợi ý thực đơn cân bằng vi chất và đi chợ nhanh chỉ với một chạm.',
        ],
      },
      {
        heading: '2. Cam kết chất lượng 3 Không',
        content: [
          'Không hóa chất bảo quản độc hại — kiểm định VietGAP / GlobalGAP định kỳ.',
          'Không thực phẩm tồn kho qua ngày — thu hoạch sáng sớm, giao nhanh trong 2 giờ.',
          'Không rủi ro mua sắm — đồng kiểm khi nhận hàng và hoàn tiền 100% nếu không hài lòng.',
        ],
      },
    ],
  },
  shipping: {
    key: 'shipping',
    title: 'Chính Sách Giao Hàng & Đồng Kiểm',
    subtitle: 'Quy trình vận chuyển chuyên biệt bảo vệ độ tươi ngon của nông sản',
    updatedAt: '01/10/2026',
    sections: [
      {
        heading: '1. Phạm vi & Thời gian giao hàng',
        content: [
          'Giao hàng hỏa tốc trong 30 - 60 phút cho các quận nội thành TP. Hồ Chí Minh.',
          'Giao theo khung giờ hẹn trước (8h–11h, 14h–17h, 18h–20h) cho các khu vực lân cận.',
          'Phí giao hàng: Miễn phí cho đơn từ 200.000đ. Dưới 200.000đ: 20.000đ.',
        ],
      },
      {
        heading: '2. Bảo quản Cold-Chain trong suốt hành trình',
        content: [
          'Nông sản hữu cơ được đóng thùng giữ nhiệt kèm túi đá gel duy trì nhiệt độ 0°C – 4°C.',
          'Thịt, cá và hải sản được đóng gói chân không và bảo quản lạnh riêng biệt.',
        ],
      },
      {
        heading: '3. Quyền đồng kiểm khi nhận hàng',
        content: [
          'Quý khách được mở thùng kiểm tra số lượng và độ tươi trước khi thanh toán.',
          'Có quyền từ chối nhận hàng nếu sản phẩm không đạt chất lượng cam kết.',
        ],
      },
    ],
  },
  returns: {
    key: 'returns',
    title: 'Chính Sách Đổi Trả & Hoàn Tiền 100%',
    subtitle: 'Bảo hành chất lượng tươi sạch — An tâm tuyệt đối khi mua sắm',
    updatedAt: '01/10/2026',
    sections: [
      {
        heading: '1. Điều kiện áp dụng',
        content: [
          'Áp dụng trong vòng 24 giờ kể từ khi nhận hàng đối với rau củ quả, thịt cá tươi sống.',
          'Sản phẩm bị dập nát, héo úa, không đúng đơn đặt hàng hoặc lỗi đóng gói.',
        ],
      },
      {
        heading: '2. Hình thức xử lý',
        content: [
          'Đổi mới 1:1 hỏa tốc trong 2 giờ hoặc hoàn tiền 100% qua chuyển khoản ngân hàng.',
          'Thời gian hoàn tiền: 1–3 ngày làm việc tùy ngân hàng.',
        ],
      },
    ],
  },
  privacy: {
    key: 'privacy',
    title: 'Chính Sách Bảo Mật Thông Tin Khách Hàng',
    subtitle: 'Cam kết bảo vệ tuyệt đối quyền riêng tư và dữ liệu cá nhân',
    updatedAt: '01/10/2026',
    sections: [
      {
        heading: '1. Mục đích thu thập dữ liệu',
        content: [
          'Chỉ thu thập thông tin để phục vụ xử lý và giao nhận đơn hàng (Họ tên, SĐT, Địa chỉ, Email).',
          'Dữ liệu dùng để cá nhân hóa trải nghiệm mua sắm và gợi ý sản phẩm phù hợp.',
        ],
      },
      {
        heading: '2. Cam kết bảo mật',
        content: [
          'Tuyệt đối KHÔNG chia sẻ hay thương mại hóa dữ liệu khách hàng cho bên thứ ba.',
          'Mã hóa toàn bộ giao dịch thanh toán trực tuyến bằng tiêu chuẩn SSL 256-bit.',
        ],
      },
    ],
  },
  terms: {
    key: 'terms',
    title: 'Điều Khoản Sử Dụng Dịch Vụ',
    subtitle: 'Quy định chung về việc sử dụng website và dịch vụ Evergreen Mart',
    updatedAt: '01/10/2026',
    sections: [
      {
        heading: '1. Chấp thuận điều khoản',
        content: [
          'Khi sử dụng website Evergreen Mart, bạn đồng ý tuân thủ các điều khoản và điều kiện này.',
        ],
      },
      {
        heading: '2. Tài khoản người dùng',
        content: [
          'Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động từ tài khoản của mình.',
        ],
      },
    ],
  },
  faq: {
    key: 'faq',
    title: 'Câu Hỏi Thường Gặp (FAQ)',
    subtitle: 'Giải đáp những thắc mắc phổ biến khi mua sắm tại Evergreen Mart',
    updatedAt: '01/10/2026',
    sections: [
      {
        heading: '1. Nông sản tại Evergreen Mart có nguồn gốc từ đâu?',
        content: [
          'Tất cả sản phẩm đều được thu hoạch trực tiếp từ các hợp tác xã và nông trại hữu cơ đạt chuẩn VietGAP tại Đà Lạt, Miền Tây và Tây Nguyên.',
        ],
      },
      {
        heading: '2. Tôi có thể hủy hoặc sửa đơn hàng không?',
        content: [
          'Bạn có thể liên hệ trực tiếp tổng đài miễn phí 1800 6999 trước khi đơn hàng chuyển sang trạng thái đang giao để được hỗ trợ ngay lập tức.',
        ],
      },
    ],
  },
  contact: {
    key: 'contact',
    title: 'Liên Hệ Với Chúng Tôi',
    subtitle: 'Kênh kết nối chính thức của Evergreen Mart',
    updatedAt: '01/10/2026',
    sections: [
      {
        heading: '1. Kênh hỗ trợ trực tuyến',
        content: [
          'Hotline CSKH: 1800 6999 (Hoạt động 07:00 – 21:00 tất cả các ngày trong tuần).',
          'Email hỗ trợ: chamsoc@evergreenmart.vn | contact@evergreenmart.vn',
          'Văn phòng: Khu phố 6, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh.',
        ],
      },
    ],
  },
};

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

  protected brandName = signal(DEFAULT_BRAND_NAME);
  protected brandDesc = signal(DEFAULT_BRAND_DESC);
  protected newsletterTitle = signal(DEFAULT_NEWSLETTER_TITLE);
  protected newsletterDesc = signal(DEFAULT_NEWSLETTER_DESC);
  protected copyrightText = signal(
    `© 2026 ${DEFAULT_BRAND_NAME} — Nông Nghiệp Hữu Cơ & Dinh Dưỡng Thông Minh. Bảo lưu mọi quyền.`
  );
  protected contactInfo = signal(DEFAULT_CONTACT_INFO);
  protected trustItems = signal<FooterTrustItem[]>(DEFAULT_TRUST_ITEMS);
  protected utilityLinks = signal<FooterNavLink[]>(DEFAULT_UTILITY_LINKS);
  protected aboutLinks = signal<FooterNavLink[]>(DEFAULT_ABOUT_LINKS);
  protected policyLinks = signal<FooterNavLink[]>(DEFAULT_POLICY_LINKS);
  protected socialLinks = signal<FooterSocialLink[]>(DEFAULT_SOCIAL_LINKS);
  protected paymentMethods = signal<string[]>(DEFAULT_PAYMENT_METHODS);
  protected policiesMap = signal<Record<string, PolicyContent>>(DEFAULT_POLICIES_MAP);
  protected activePolicy = signal<PolicyContent | null>(null);

  private sanitizeBrand(str: string): string {
    if (!str) return str;
    return str.replace(/Xanh Lá/gi, 'Evergreen Mart').replace(/1900\s*6789/g, '1800 6999');
  }

  ngOnInit(): void {
    this.api.get<{ success: boolean; data: FooterConfigResponse }>('/footer').subscribe({
      next: res => {
        const cfg = res?.data;
        if (!cfg) return;

        if (cfg.brandName) {
          const b = this.sanitizeBrand(cfg.brandName);
          this.brandName.set(b === 'Xanh Lá' ? DEFAULT_BRAND_NAME : b);
        }
        if (cfg.brandDesc && cfg.brandDesc.trim()) {
          this.brandDesc.set(this.sanitizeBrand(cfg.brandDesc));
        }
        if (cfg.newsletterTitle && cfg.newsletterTitle.trim()) {
          this.newsletterTitle.set(this.sanitizeBrand(cfg.newsletterTitle));
        }
        if (cfg.newsletterDesc && cfg.newsletterDesc.trim()) {
          this.newsletterDesc.set(this.sanitizeBrand(cfg.newsletterDesc));
        }
        if (cfg.copyrightText && cfg.copyrightText.trim()) {
          this.copyrightText.set(this.sanitizeBrand(cfg.copyrightText));
        }
        if (cfg.contactInfo) {
          this.contactInfo.set({
            hotline: cfg.contactInfo.hotline?.includes('1900') ? DEFAULT_CONTACT_INFO.hotline : (cfg.contactInfo.hotline || DEFAULT_CONTACT_INFO.hotline),
            email: cfg.contactInfo.email?.includes('xanhla') ? DEFAULT_CONTACT_INFO.email : (cfg.contactInfo.email || DEFAULT_CONTACT_INFO.email),
            address: cfg.contactInfo.address || DEFAULT_CONTACT_INFO.address,
          });
        }
        if (cfg.trustItems?.length) {
          this.trustItems.set(
            cfg.trustItems.map(item => ({
              ...item,
              title: this.sanitizeBrand(item.title),
              subtitle: this.sanitizeBrand(item.subtitle),
            }))
          );
        }
        if (cfg.utilityLinks?.length) {
          const links = cfg.utilityLinks
            .filter(l => this.isUtilityLinkVisible(l))
            .map(l => ({ ...l, label: this.sanitizeBrand(l.label) }));
          if (links.length) this.utilityLinks.set(links);
        }
        if (cfg.aboutLinks?.length) {
          const links = cfg.aboutLinks
            .filter(l => this.isFooterLinkVisible(l))
            .map(l => ({ ...l, label: this.sanitizeBrand(l.label) }));
          if (links.length) this.aboutLinks.set(links);
        }
        if (cfg.policyLinks?.length) {
          const links = cfg.policyLinks.map(l => ({ ...l, label: this.sanitizeBrand(l.label) }));
          if (links.length) this.policyLinks.set(links);
        }
        if (cfg.socialLinks?.length) {
          const links = cfg.socialLinks.map(s => ({ ...s, label: this.sanitizeBrand(s.label) }));
          if (links.length) this.socialLinks.set(links);
        }
        if (cfg.paymentMethods?.length) {
          this.paymentMethods.set(cfg.paymentMethods);
        }
        if (cfg.policies?.length) {
          const map = { ...DEFAULT_POLICIES_MAP };
          for (const p of cfg.policies) {
            if (p.key) {
              map[p.key] = {
                ...p,
                title: this.sanitizeBrand(p.title),
                subtitle: this.sanitizeBrand(p.subtitle),
                sections: p.sections?.map(s => ({
                  ...s,
                  heading: this.sanitizeBrand(s.heading),
                  content: s.content?.map(c => this.sanitizeBrand(c)) || [],
                })) || [],
              };
            }
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
    return label.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\uFE0E\uFE0F\u200D]/gu, '').trim();
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
