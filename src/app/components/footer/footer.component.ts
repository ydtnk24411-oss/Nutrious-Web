import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { logoImage } from '../../shared/data/xanh-la.data';

export interface PolicyContent {
  title: string;
  subtitle: string;
  updatedAt: string;
  sections: { heading: string; content: string[] }[];
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  protected readonly logoImage = logoImage;
  protected email = signal('');
  protected subscribed = signal(false);
  protected emailError = signal('');

  protected activePolicy = signal<PolicyContent | null>(null);

  protected readonly policies: Record<string, PolicyContent> = {
    shipping: {
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
            'Shipper sẽ chụp ảnh xác nhận giao hàng thành công và gửi qua Zalo/SMS.',
          ],
        },
      ],
    },
    privacy: {
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
            'Máy chủ được bảo vệ bởi tường lửa và hệ thống giám sát 24/7.',
          ],
        },
        {
          heading: '3. Quyền của khách hàng',
          content: [
            'Có quyền yêu cầu xem, sửa hoặc xóa dữ liệu cá nhân bất kỳ lúc nào.',
            'Liên hệ: privacy@xanhla.vn để thực hiện các yêu cầu về dữ liệu.',
          ],
        },
      ],
    },
    returns: {
      title: 'Chính Sách Đổi Trả & Hoàn Tiền 100%',
      subtitle: 'Bảo hành chất lượng tươi sạch — An tâm tuyệt đối khi mua sắm',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Điều kiện áp dụng',
          content: [
            'Áp dụng trong vòng 24 giờ kể từ khi nhận hàng đối với rau củ quả, thịt cá tươi sống.',
            'Sản phẩm bị dập nát, héo úa, không đúng đơn đặt hàng hoặc hết hạn sử dụng.',
            'Chụp ảnh sản phẩm lỗi và gửi qua Zalo hoặc email để xác nhận.',
          ],
        },
        {
          heading: '2. Hình thức xử lý',
          content: [
            'Đổi mới 1:1 hỏa tốc trong 2 giờ hoặc hoàn tiền 100% qua chuyển khoản ngân hàng.',
            'Thời gian hoàn tiền: 1–3 ngày làm việc tùy ngân hàng.',
          ],
        },
        {
          heading: '3. Liên hệ đổi trả',
          content: [
            'Hotline: 1900 1234 (8h–21h mỗi ngày).',
            'Email: support@xanhla.vn',
            'Zalo OA: Xanh Lá Official',
          ],
        },
      ],
    },
    terms: {
      title: 'Điều Khoản Sử Dụng Dịch Vụ',
      subtitle: 'Quy định chung về việc sử dụng website và dịch vụ Xanh Lá',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Chấp thuận điều khoản',
          content: [
            'Khi sử dụng website Xanh Lá, bạn đồng ý tuân thủ các điều khoản và điều kiện này.',
            'Xanh Lá có quyền cập nhật điều khoản bất cứ lúc nào và sẽ thông báo trước 7 ngày.',
          ],
        },
        {
          heading: '2. Tài khoản người dùng',
          content: [
            'Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động từ tài khoản của mình.',
            'Nghiêm cấm sử dụng tài khoản người khác hoặc tạo tài khoản ảo để gian lận.',
          ],
        },
        {
          heading: '3. Sử dụng hợp lệ',
          content: [
            'Nghiêm cấm sử dụng website cho mục đích bất hợp pháp hoặc gây hại đến hệ thống.',
            'Nội dung đánh giá sản phẩm phải trung thực và không vi phạm quyền sở hữu trí tuệ.',
          ],
        },
      ],
    },
    about: {
      title: 'Giới Thiệu Về Xanh Lá',
      subtitle: 'Nông sản hữu cơ tươi sạch & Trợ lý dinh dưỡng thông minh cho gia đình Việt',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Sứ mệnh của Xanh Lá',
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
    faq: {
      title: 'Câu Hỏi Thường Gặp (FAQ)',
      subtitle: 'Giải đáp nhanh các thắc mắc về đặt hàng, voucher và dinh dưỡng',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Làm sao để thu thập và sử dụng mã giảm giá (Voucher)?',
          content: [
            'Truy cập mục Khuyến mãi hoặc Ví Voucher để nhấn "Lưu vào ví" các mã giảm giá đang mở.',
            'Tại trang Thanh toán (Checkout), chọn voucher đã lưu để hệ thống tự động trừ tiền.',
          ],
        },
        {
          heading: '2. Tính năng Dinh dưỡng thông minh hoạt động như thế nào?',
          content: [
            'Bạn chỉ cần chọn mục tiêu (Protein, Chất xơ, Vitamin...), số người ăn và ngân sách.',
            'Hệ thống sẽ gợi ý công thức phù hợp và tự động khớp nguyên liệu đang bán tại cửa hàng để thêm vào giỏ.',
          ],
        },
        {
          heading: '3. Tôi có thể theo dõi trạng thái đơn hàng ở đâu?',
          content: [
            'Vào trang "Theo dõi đơn hàng" trên thanh điều hướng hoặc mục "Đơn hàng của tôi" trong Tài khoản.',
          ],
        },
      ],
    },
    help: {
      title: 'Trung Tâm Hỗ Trợ Khách Hàng',
      subtitle: 'Hướng dẫn mua sắm, thanh toán và chăm sóc khách hàng 24/7',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Hướng dẫn đặt hàng nhanh',
          content: [
            'Bước 1: Chọn sản phẩm tại Đặt hàng trực tuyến hoặc từ gợi ý Dinh dưỡng thông minh.',
            'Bước 2: Kiểm tra giỏ hàng, chọn khung giờ giao nhận và áp dụng Voucher / Điểm thưởng.',
            'Bước 3: Xác nhận thanh toán (COD, VietQR, MoMo, ZaloPay hoặc thẻ ngân hàng).',
          ],
        },
        {
          heading: '2. Hỗ trợ sự cố đơn hàng',
          content: [
            'Nếu đơn hàng giao trễ hoặc sản phẩm không đạt độ tươi, vui lòng gọi ngay Hotline 1900 1234.',
            'Đội ngũ CSKH Xanh Lá sẽ xử lý đổi mới hoặc hoàn tiền trong vòng 2 giờ.',
          ],
        },
      ],
    },
    contact: {
      title: 'Liên Hệ Với Chúng Tôi',
      subtitle: 'Kênh kết nối chính thức của Xanh Lá',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Thông tin liên hệ trực tiếp',
          content: [
            'Hotline CSKH: 1900 1234 — 1800 6999 (Hoạt động 7:00 – 21:00 tất cả các ngày).',
            'Email hỗ trợ: hello@xanhla.vn | support@xanhla.vn',
            'Zalo Official Account: Xanh Lá Official',
          ],
        },
        {
          heading: '2. Địa chỉ văn phòng & Trung tâm phân phối',
          content: [
            'Trụ sở chính: 123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh.',
            'Kho lạnh trung tâm: Khu Công Nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh.',
          ],
        },
      ],
    },
  };

  openPolicy(key: string, event: Event): void {
    event.preventDefault();
    if (this.policies[key]) {
      this.activePolicy.set(this.policies[key]);
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
    this.subscribed.set(true);
    this.email.set('');
    setTimeout(() => this.subscribed.set(false), 5000);
  }

  scrollToSection(sectionId: string, event: Event): void {
    event.preventDefault();
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (this.policies[sectionId]) {
      this.activePolicy.set(this.policies[sectionId]);
    }
  }
}