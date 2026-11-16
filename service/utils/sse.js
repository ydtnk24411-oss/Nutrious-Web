const Notification = require('../models/Notification');

// Map of active SSE client connections: clientId -> { res, userId, role }
const clients = new Map();

/**
 * Đăng ký client kết nối SSE
 */
function addClient(clientId, res, userId, role) {
  clients.set(clientId, { res, userId: userId ? String(userId) : null, role: role || 'customer' });
}

/**
 * Xóa client khi ngắt kết nối
 */
function removeClient(clientId) {
  clients.delete(clientId);
}

/**
 * Bắn thông báo thời gian thực và lưu vào cơ sở dữ liệu
 */
async function sendRealtimeNotification({ recipient, recipientRole, title, body, type = 'system', path = '/account', orderId = null }) {
  try {
    // 1. Lưu thông báo vào MongoDB
    const notif = await Notification.create({
      recipient: recipient || null,
      recipientRole: recipientRole || null,
      title,
      body,
      type,
      path,
      orderId,
      unread: true,
    });

    const payload = JSON.stringify({
      id: notif._id,
      title: notif.title,
      body: notif.body,
      type: notif.type,
      path: notif.path,
      orderId: notif.orderId,
      unread: true,
      createdAt: notif.createdAt,
    });

    // 2. Gửi SSE cho các client đang kết nối trực tuyến
    const targetUserId = recipient ? String(recipient) : null;

    for (const [clientId, client] of clients.entries()) {
      let isMatch = false;

      // Khớp theo tài khoản người nhận cụ thể
      if (targetUserId && client.userId === targetUserId) {
        isMatch = true;
      }
      // Hoặc khớp theo vai trò người nhận (vd: nhân viên Sales / Quản trị viên / Thủ kho)
      else if (recipientRole) {
        if (recipientRole === 'all') {
          isMatch = true;
        } else if (recipientRole === client.role || (recipientRole === 'sales' && ['admin', 'sales'].includes(client.role))) {
          isMatch = true;
        } else if (recipientRole === 'warehouse' && ['admin', 'warehouse'].includes(client.role)) {
          isMatch = true;
        }
      }

      if (isMatch) {
        try {
          client.res.write(`data: ${payload}\n\n`);
        } catch (err) {
          clients.delete(clientId);
        }
      }
    }

    return notif;
  } catch (err) {
    console.error('Error in sendRealtimeNotification:', err);
  }
}

module.exports = {
  addClient,
  removeClient,
  sendRealtimeNotification,
};
