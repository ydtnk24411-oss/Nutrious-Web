const AuditLog = require('../models/AuditLog');

/**
 * Ghi nhận một thao tác nhạy cảm của nhân viên/quản lý vào Nhật ký hoạt động (AuditLog)
 * @param {object} req - Express Request
 * @param {object} param1 - Chi tiết thao tác
 */
async function logAction(req, {
  action,
  category = 'SYSTEM',
  targetType = '',
  targetId = '',
  details,
  metadata = {},
  status = 'SUCCESS'
}) {
  try {
    const actor = req?.user || null;
    const actorName = actor ? actor.name : (req?.body?.adminName || 'Hệ thống tự động');
    const actorEmail = actor ? actor.email : '';
    const actorRole = actor ? actor.role : 'system';

    const ipAddress =
      req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
      req?.socket?.remoteAddress ||
      '127.0.0.1';
    const userAgent = req?.headers?.['user-agent'] || '';

    await AuditLog.create({
      actor: actor?._id || null,
      actorName,
      actorEmail,
      actorRole,
      action,
      category,
      targetType,
      targetId: String(targetId || ''),
      details,
      metadata,
      ipAddress,
      userAgent,
      status,
    });
  } catch (err) {
    console.error('[WARN] [AuditLog] Không thể ghi log:', err.message);
  }
}

module.exports = { logAction };
