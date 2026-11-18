const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  } else {
    // Development / Fallback transport: Ghi log console không làm gián đoạn API
    transporter = {
      sendMail: async (mailOptions) => {
        console.log(`[Email Service Simulation] Sent to: ${mailOptions.to} | Subject: ${mailOptions.subject}`);
        return { messageId: 'simulated_' + Date.now() };
      },
    };
  }
  return transporter;
}

/**
 * Gửi email xác nhận đặt hàng thành công bất đồng bộ
 */
function sendOrderConfirmationEmail(order) {
  setImmediate(async () => {
    try {
      const email = order.guestEmail || order.user?.email;
      if (!email || !email.includes('@')) return;

      const itemsHtml = (order.items || []).map(it => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${it.productName || it.name || 'Sản phẩm'} x${it.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${(Number(it.subtotal || it.price * it.quantity) || 0).toLocaleString('vi-VN')}đ</td>
        </tr>
      `).join('');

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <div style="background:#1e4226;padding:20px;text-align:center;color:#fff">
            <h2 style="margin:0;font-size:22px">Xanh Lá - Đặt Hàng Thành Công</h2>
            <p style="margin:4px 0 0 0;font-size:14px;color:#dcfce7">Cảm ơn bạn đã tin chọn nông sản tươi sạch chuẩn VietGAP</p>
          </div>
          <div style="padding:24px">
            <p>Xin chào <strong>${order.customerName || 'Quý khách'}</strong>,</p>
            <p>Đơn hàng <strong>#${order.orderCode}</strong> của bạn đã được tiếp nhận và đang được đóng gói chuyển sang kho vận.</p>
            
            <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
              <thead>
                <tr style="background:#f9fafb;text-align:left">
                  <th style="padding:8px;border-bottom:2px solid #e5e7eb">Sản phẩm</th>
                  <th style="padding:8px;border-bottom:2px solid #e5e7eb;text-align:right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="margin-top:16px;border-top:2px solid #1e4226;padding-top:12px;font-size:14px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span>Phí vận chuyển:</span>
                <span>${(order.shippingFee || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              ${order.discount ? `
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#16a34a">
                <span>Giảm giá voucher:</span>
                <span>-${(order.discount || 0).toLocaleString('vi-VN')}đ</span>
              </div>` : ''}
              <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;color:#1e4226;margin-top:8px">
                <span>Tổng thanh toán:</span>
                <span>${(order.total || 0).toLocaleString('vi-VN')}đ</span>
              </div>
            </div>

            <p style="margin-top:24px;font-size:13px;color:#6b7280">
              Địa chỉ nhận hàng: ${order.shippingAddress || 'Theo thông tin đơn hàng'}<br>
              Số điện thoại: ${order.guestPhone || order.customerPhone || 'N/A'}<br>
              Phương thức thanh toán: ${order.paymentMethod === 'bank_transfer' ? 'Chuyển khoản VietQR' : 'Thanh toán tiền mặt khi nhận hàng (COD)'}
            </p>
          </div>
          <div style="background:#f3f4f6;padding:12px;text-align:center;font-size:12px;color:#9ca3af">
             2026 Xanh Lá - Nông sản hữu cơ &amp; Thực phẩm sạch vì sức khỏe gia đình.
          </div>
        </div>
      `;

      await getTransporter().sendMail({
        from: '"Xanh Lá Mart" <no-reply@xanhla.vn>',
        to: email,
        subject: `[Xanh Lá] Xác nhận đơn hàng #${order.orderCode} thành công`,
        html,
      });
    } catch (err) {
      console.error('sendOrderConfirmationEmail error:', err);
    }
  });
}

/**
 * Gửi email đặt lại mật khẩu
 */
function sendPasswordResetEmail(email, resetToken, hostUrl = 'http://localhost:4200') {
  setImmediate(async () => {
    try {
      const resetLink = `${hostUrl}/account/reset-password?token=${resetToken}`;
      await getTransporter().sendMail({
        from: '"Xanh Lá Mart" <security@xanhla.vn>',
        to: email,
        subject: '[Xanh Lá] Yêu cầu đặt lại mật khẩu tài khoản',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
            <h3 style="color:#1e4226">Yêu cầu đặt lại mật khẩu</h3>
            <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Xanh Lá của bạn. Nhấn vào nút bên dưới để tạo mật khẩu mới:</p>
            <div style="text-align:center;margin:24px 0">
              <a href="${resetLink}" style="background:#1e4226;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">Đặt lại mật khẩu</a>
            </div>
            <p style="font-size:12px;color:#6b7280">Liên kết này có hiệu lực trong vòng 15 phút. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error('sendPasswordResetEmail error:', err);
    }
  });
}

module.exports = {
  sendOrderConfirmationEmail,
  sendPasswordResetEmail,
};
