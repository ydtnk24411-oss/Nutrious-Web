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
            'Giao theo khung giờ hẹn trước (8h-11h, 14h-17h, 18h-20h) cho các khu vực lân cận.',
          ],
        },
        {
          heading: '2. Bảo quản Cold-Chain trong suốt hành trình',
          content: [
            'Nông sản hữu cơ được đóng thùng giữ nhiệt kèm túi đá gel duy trì nhiệt độ 0°C - 4°C.',
          ],
        },
        {
          heading: '3. Quyền đồng kiểm khi nhận hàng',
          content: [
            'Quý khách được mở thùng kiểm tra số lượng và độ tươi trước khi thanh toán. Có quyền từ chối nếu không đạt chất lượng.',
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
    returns: {
      title: 'Chính Sách Đổi Trả & Hoàn Tiền 100%',
      subtitle: 'Bảo hành chất lượng tươi sạch — An tâm tuyệt đối khi mua sắm',
      updatedAt: '01/10/2026',
      sections: [
        {
          heading: '1. Điều kiện áp dụng',
          content: [
            'Áp dụng trong vòng 24 giờ kể từ khi nhận hàng đối với rau củ quả, thịt cá tươi sống.',
            'Sản phẩm bị dập nát, héo úa hoặc không đúng đơn đặt hàng.',
          ],
        },
        {
          heading: '2. Hình thức xử lý',
          content: [
            'Đổi mới 1:1 hỏa tốc trong 2 giờ hoặc hoàn tiền 100% qua chuyển khoản ngân hàng.',
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
    if (this.email()) {
      this.subscribed.set(true);
      this.email.set('');
    }
  }
}