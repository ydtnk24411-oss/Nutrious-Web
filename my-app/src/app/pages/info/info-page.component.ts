import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';

export type InfoSectionKey =
  | 'about'
  | 'faq'
  | 'help'
  | 'contact'
  | 'shipping'
  | 'returns'
  | 'privacy'
  | 'terms'
  | 'guide';

interface NavGroupItem {
  key: InfoSectionKey;
  label: string;
  route: string;
}

interface NavGroup {
  title: string;
  items: NavGroupItem[];
}

interface FaqItem {
  id: string;
  category: 'order' | 'payment' | 'quality' | 'feature';
  categoryLabel: string;
  question: string;
  answer: string;
}

interface PageHeaderMeta {
  badge: string;
  title: string;
  subtitle: string;
  updatedAt: string;
}

const SLUG_TO_KEY: Record<string, InfoSectionKey> = {
  'giao-hang': 'shipping',
  'doi-tra': 'returns',
  'bao-mat': 'privacy',
  'dieu-khoan': 'terms',
  'huong-dan': 'guide',
  'hoi-dap': 'faq',
  'ho-tro': 'help',
  'lien-he': 'contact',
  'gioi-thieu': 'about',
};

const PAGE_HEADERS: Record<InfoSectionKey, PageHeaderMeta> = {
  about: {
    badge: 'VỀ EVERGREEN MART',
    title: 'Nông Sản Sạch Từ Nông Trại Đến Bàn Ăn',
    subtitle:
      'Hệ thống 18 chi nhánh tại 10 tỉnh thành, kết nối nông sản chuẩn VietGAP, GlobalGAP và Organic cùng trợ lý dinh dưỡng thông minh cho gia đình Việt.',
    updatedAt: 'Cập nhật tháng 11/2026',
  },
  faq: {
    badge: 'GIẢI ĐÁP THẮC MẮC',
    title: 'Câu Hỏi Thường Gặp (FAQ)',
    subtitle:
      'Tra cứu nhanh thông tin về đặt hàng, biểu phí giao nhận theo khoảng cách, hỗ trợ phí ship tự động, đồng kiểm và các công cụ dinh dưỡng.',
    updatedAt: 'Cập nhật tháng 11/2026',
  },
  help: {
    badge: 'TRUNG TÂM HỖ TRỢ',
    title: 'Trung Tâm Hỗ Trợ Khách Hàng',
    subtitle:
      'Tổng đài miễn cước 1800 6999 hoạt động từ 07:00 – 21:00 mỗi ngày, hỗ trợ tra cứu đơn hàng, khiếu nại và giải đáp sự cố giao nhận.',
    updatedAt: 'Cập nhật tháng 11/2026',
  },
  guide: {
    badge: 'HƯỚNG DẪN MUA SẮM',
    title: 'Hướng Dẫn Đặt Hàng và Thanh Toán',
    subtitle:
      'Quy trình 4 bước chọn nông sản tươi sạch, ghim vị trí bản đồ, kết hợp ưu đãi kép và thanh toán bằng tiền mặt (COD) hoặc VietQR.',
    updatedAt: 'Cập nhật tháng 11/2026',
  },
  contact: {
    badge: 'KẾT NỐI TRỰC TIẾP',
    title: 'Liên Hệ Evergreen Mart',
    subtitle:
      'Kết nối qua tổng đài miễn cước 1800 6999, email chăm sóc khách hàng hoặc gửi lời nhắn trực tiếp cho bộ phận điều phối.',
    updatedAt: 'Cập nhật tháng 11/2026',
  },
  shipping: {
    badge: 'CHÍNH SÁCH VẬN CHUYỂN',
    title: 'Chính Sách Giao Hàng và Đồng Kiểm',
    subtitle:
      'Bảo quản lạnh xuyên suốt, tính phí minh bạch theo khoảng cách từ chi nhánh gần nhất, tự động giảm phí ship cho đơn từ 150.000đ và kiểm hàng tại chỗ.',
    updatedAt: 'Cập nhật tháng 11/2026',
  },
  returns: {
    badge: 'KIỂM HÀNG & BẢO HÀNH',
    title: 'Chính Sách Kiểm Hàng và Đổi Trả',
    subtitle:
      'Quyền đồng kiểm thực phẩm tươi sống ngay khi nhận hàng và quy trình tiếp nhận khiếu nại, giao bù hoặc hoàn tiền cho sự cố đơn hàng.',
    updatedAt: 'Cập nhật tháng 11/2026',
  },
  privacy: {
    badge: 'AN TOÀN DỮ LIỆU',
    title: 'Chính Sách Bảo Mật Thông Tin',
    subtitle:
      'Evergreen Mart tôn trọng quyền riêng tư, bảo vệ thông tin tài khoản xác thực qua OTP và không chia sẻ dữ liệu cá nhân cho mục đích thương mại.',
    updatedAt: 'Cập nhật tháng 11/2026',
  },
  terms: {
    badge: 'QUY ĐỊNH CHUNG',
    title: 'Điều Khoản Sử Dụng Dịch Vụ',
    subtitle:
      'Quy định minh bạch về tài khoản thành viên, đặt hàng, áp dụng voucher kép, tích điểm thưởng và trách nhiệm giữa các bên.',
    updatedAt: 'Cập nhật tháng 11/2026',
  },
};

const FAQ_LIST: FaqItem[] = [
  {
    id: 'origin',
    category: 'quality',
    categoryLabel: 'Chất lượng & Kiểm hàng',
    question: 'Nông sản tại Evergreen Mart có nguồn gốc từ đâu và được bảo quản thế nào?',
    answer:
      'Rau củ, trái cây, thịt cá và thực phẩm tại Evergreen Mart được thu mua từ các nông trại, hợp tác xã đạt chuẩn VietGAP, GlobalGAP và Organic tại Đà Lạt, Miền Tây và Tây Nguyên. Hàng tươi sống được phân phối về 18 kho lạnh chi nhánh (0°C – 4°C) để xuất giao mỗi ngày.',
  },
  {
    id: 'delivery-time',
    category: 'order',
    categoryLabel: 'Đặt hàng & Giao nhận',
    question: 'Hệ thống có những hình thức và khung giờ giao hàng nào?',
    answer:
      'Bạn có thể chọn: (1) Giao ngay dự kiến 30–45 phút (phục vụ từ 07:00 – 21:15 hằng ngày, cộng phụ phí giao nhanh 10.000đ); (2) Hẹn 8 khung giờ từ 07h30 – 22h00 cho Hôm nay hoặc Ngày mai; (3) Giao tiết kiệm trong 24h; hoặc (4) Nhận tại 1 trong 18 cửa hàng hoàn toàn miễn phí (0đ).',
  },
  {
    id: 'shipping-fee',
    category: 'order',
    categoryLabel: 'Đặt hàng & Giao nhận',
    question: 'Phí giao hàng được tính ra sao và khi nào được hỗ trợ giảm phí ship?',
    answer:
      'Phí nền tính theo quãng đường từ cửa hàng gần vị trí ghim bản đồ của bạn: ≤ 2 km là 15.000đ; 2–5 km là 20.000đ; 5–8 km là 25.000đ; 8–10 km là 30.000đ; từ 10–20 km (tối đa) cộng thêm 5.000đ/km vượt. Đơn từ 150.000đ–299.000đ được tự động giảm 10.000đ phí ship; đơn từ 300.000đ được hỗ trợ tối đa 25.000đ phí ship và có thể dùng thêm Voucher Freeship.',
  },
  {
    id: 'co-inspection',
    category: 'quality',
    categoryLabel: 'Chất lượng & Kiểm hàng',
    question: 'Tôi có được kiểm tra thực phẩm tươi sống trước khi nhận không?',
    answer:
      'Có. Với các nhóm thực phẩm tươi sống (rau củ, trái cây, thịt tươi, cá & hải sản), bạn được quyền đồng kiểm trực tiếp với nhân viên giao hàng hoặc tại quầy trước khi xác nhận nhận. Nếu sản phẩm dập nát, mất lạnh hay sai món, bạn có thể từ chối nhận ngay tại chỗ. Sau khi đã xác nhận nhận hàng, thực phẩm tươi sống không áp dụng đổi trả.',
  },
  {
    id: 'returns-support',
    category: 'quality',
    categoryLabel: 'Chất lượng & Kiểm hàng',
    question: 'Trường hợp giao thiếu món, sai đơn hoặc hàng đóng gói bị lỗi xử lý thế nào?',
    answer:
      'Bạn vui lòng chụp ảnh tình trạng sản phẩm cùng mã đơn hàng và gửi yêu cầu tại mục "Gửi khiếu nại & Phản ánh" hoặc gọi Hotline 1800 6999 (07:00 – 21:00). Đội ngũ CSKH sẽ kiểm tra, giao bù sản phẩm hoặc hoàn tiền 100% giá trị phần lỗi trong 1–3 ngày làm việc.',
  },
  {
    id: 'dual-voucher',
    category: 'payment',
    categoryLabel: 'Thanh toán & Ưu đãi',
    question: 'Tôi có thể dùng cùng lúc Voucher giảm giá đơn hàng và Voucher Freeship không?',
    answer:
      'Có. Ở bước Thanh toán, Evergreen Mart cho phép áp dụng song song 1 Voucher giảm giá đơn hàng và 1 Voucher Freeship trên cùng một đơn, kết hợp cùng ưu đãi hỗ trợ phí ship tự động cho đơn từ 150.000đ trở lên.',
  },
  {
    id: 'payment-methods',
    category: 'payment',
    categoryLabel: 'Thanh toán & Ưu đãi',
    question: 'Website hỗ trợ những phương thức thanh toán nào?',
    answer:
      'Hiện tại trang Thanh toán hỗ trợ 2 hình thức chính: (1) Thanh toán tiền mặt khi nhận hàng (COD) và (2) Chuyển khoản nhanh qua mã VietQR động được hệ thống đối soát trạng thái tự động theo thời gian thực.',
  },
  {
    id: 'loyalty-points',
    category: 'payment',
    categoryLabel: 'Thanh toán & Ưu đãi',
    question: 'Cách tích điểm và đổi ưu đãi Khách hàng thân thiết như thế nào?',
    answer:
      'Với mỗi 10.000đ chi tiêu trên đơn hàng giao thành công, bạn được cộng 1 điểm tích lũy vào tài khoản Thành viên (/loyalty). Điểm tích lũy dùng để quy đổi trực tiếp sang voucher giảm giá hoặc quà tặng nông sản.',
  },
  {
    id: 'nutrition-tool',
    category: 'feature',
    categoryLabel: 'Tài khoản & Tiện ích',
    question: 'Công cụ "Dinh dưỡng thông minh" và "Nấu gì với đồ sẵn có" dùng thế nào?',
    answer:
      'Tại mục Dinh dưỡng thông minh, bạn chọn mục tiêu dinh dưỡng, số khẩu phần và ngân sách để hệ thống gợi ý thực đơn kèm nguyên liệu có sẵn tại cửa hàng. Tại mục Nấu gì với đồ sẵn có, bạn nhập hoặc tải ảnh nguyên liệu đang có trong tủ lạnh để nhận công thức gợi ý và thêm nhanh phần còn thiếu vào giỏ hàng.',
  },
  {
    id: 'track-order',
    category: 'order',
    categoryLabel: 'Đặt hàng & Giao nhận',
    question: 'Làm sao để theo dõi trạng thái đơn hàng sau khi đặt?',
    answer:
      'Bạn có thể truy cập trang "Theo dõi đơn hàng" (/tracker-page) để tra cứu tiến trình xử lý theo mã đơn, hoặc đăng nhập vào mục "Tài khoản -> Đơn hàng của tôi" để xem toàn bộ lịch sử đơn hàng và trạng thái thanh toán.',
  },
];

@Component({
  selector: 'app-info-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ShellComponent, RouterLink],
  templateUrl: './info-page.component.html',
  styleUrl: './info-page.component.css',
})
export class InfoPageComponent implements OnInit {
  private route = inject(ActivatedRoute);

  protected activeKey = signal<InfoSectionKey>('about');

  // FAQ state
  protected faqQuery = signal('');
  protected faqCategory = signal<'all' | 'order' | 'payment' | 'quality' | 'feature'>('all');
  protected openFaqIds = signal<Set<string>>(new Set(['origin', 'delivery-time']));

  // Contact form state
  protected contactName = signal('');
  protected contactPhoneOrEmail = signal('');
  protected contactTopic = signal('Tư vấn đơn hàng & Sản phẩm');
  protected contactMessage = signal('');
  protected contactError = signal('');
  protected contactSubmitted = signal(false);

  protected readonly navGroups: NavGroup[] = [
    {
      title: 'Về Evergreen Mart',
      items: [
        { key: 'about', label: 'Giới thiệu về Evergreen Mart', route: '/gioi-thieu' },
        { key: 'faq', label: 'Câu hỏi thường gặp (FAQ)', route: '/hoi-dap' },
        { key: 'help', label: 'Trung tâm hỗ trợ', route: '/ho-tro' },
        { key: 'contact', label: 'Liên hệ với chúng tôi', route: '/lien-he' },
      ],
    },
    {
      title: 'Chính sách & An tâm',
      items: [
        { key: 'shipping', label: 'Chính sách giao hàng & Đồng kiểm', route: '/chinh-sach/giao-hang' },
        { key: 'returns', label: 'Chính sách kiểm hàng & Đổi trả', route: '/chinh-sach/doi-tra' },
        { key: 'privacy', label: 'Chính sách bảo mật thông tin', route: '/chinh-sach/bao-mat' },
        { key: 'terms', label: 'Điều khoản sử dụng dịch vụ', route: '/chinh-sach/dieu-khoan' },
        { key: 'guide', label: 'Hướng dẫn đặt hàng & Thanh toán', route: '/chinh-sach/huong-dan' },
      ],
    },
  ];

  protected readonly headerMeta = computed<PageHeaderMeta>(() => PAGE_HEADERS[this.activeKey()]);

  protected readonly filteredFaqs = computed<FaqItem[]>(() => {
    const q = this.faqQuery().trim().toLowerCase();
    const cat = this.faqCategory();
    return FAQ_LIST.filter((item) => {
      const matchCat = cat === 'all' || item.category === cat;
      const matchQ =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  });

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      if (data['section']) {
        this.activeKey.set(data['section'] as InfoSectionKey);
        this.scrollToTop();
      }
    });

    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.activeKey.set(SLUG_TO_KEY[slug] || 'shipping');
        this.scrollToTop();
      }
    });
  }

  toggleFaq(id: string): void {
    const next = new Set(this.openFaqIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.openFaqIds.set(next);
  }

  isFaqOpen(id: string): boolean {
    return this.openFaqIds().has(id);
  }

  submitContact(e: Event): void {
    e.preventDefault();
    if (!this.contactName().trim() || !this.contactPhoneOrEmail().trim() || !this.contactMessage().trim()) {
      this.contactError.set('Vui lòng điền đầy đủ họ tên, thông tin liên hệ và nội dung cần hỗ trợ.');
      return;
    }
    this.contactError.set('');
    this.contactSubmitted.set(true);
    this.contactMessage.set('');
  }

  resetContactForm(): void {
    this.contactSubmitted.set(false);
    this.contactError.set('');
  }

  private scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
