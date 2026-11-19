const errorHandler = (err, _req, res, _next) => {
  // Do not spam console with expected auth token verification errors (401)
  if (err.name !== 'JsonWebTokenError' && err.name !== 'TokenExpiredError') {
    console.error(err.stack);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || '';
    if (field === 'slug' || field === 'sku') {
      return res.status(409).json({
        success: false,
        message: 'Mã SKU này đã tồn tại trong hệ thống, vui lòng nhập mã khác.',
      });
    }
    if (field === 'phone') {
      return res.status(409).json({
        success: false,
        message: 'Số điện thoại này đã được đăng ký.',
      });
    }
    if (field === 'email') {
      return res.status(409).json({
        success: false,
        message: 'Email này đã tồn tại trong hệ thống.',
      });
    }
    return res.status(409).json({ success: false, message: `${field} đã tồn tại.` });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token đã hết hạn.' });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Lỗi máy chủ nội bộ.',
  });
};

const notFound = (_req, res) =>
  res.status(404).json({ success: false, message: 'Endpoint không tồn tại.' });

module.exports = { errorHandler, notFound };
