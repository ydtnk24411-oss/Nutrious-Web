const router = require('express').Router();
const { body } = require('express-validator');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { protect, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const toDto = (r, viewerId) => ({
  id: String(r._id),
  productId: r.product,
  productName: r.productName,
  userId: String(r.user),
  userName: r.userName,
  rating: r.rating,
  title: r.title || undefined,
  content: r.content,
  images: r.images || [],
  helpfulCount: (r.helpfulBy || []).length,
  isHelpful: viewerId ? (r.helpfulBy || []).some((u) => String(u) === String(viewerId)) : false,
  createdAt: r.createdAt,
  verifiedPurchase: r.verifiedPurchase,
});

const buildStats = (reviews) => {
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  reviews.forEach((r) => { dist[r.rating] += 1; sum += r.rating; });
  const total = reviews.length;
  return {
    averageRating: total ? Math.round((sum / total) * 10) / 10 : 0,
    totalReviews: total,
    ratingDistribution: dist,
  };
};

// GET /api/reviews/product/:productId - public
router.get('/product/:productId', optionalAuth, async (req, res, next) => {
  try {
    const reviews = await Review.find({ product: req.params.productId }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: reviews.map((r) => toDto(r, req.user?._id)),
      stats: buildStats(reviews),
    });
  } catch (err) { next(err); }
});

// POST /api/reviews - cần đăng nhập; người đánh giá luôn là tài khoản trong token
router.post(
  '/',
  protect,
  [
    body('productId').notEmpty().withMessage('Thiếu sản phẩm.'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Điểm đánh giá phải từ 1 đến 5.'),
    body('content').trim().notEmpty().withMessage('Nội dung đánh giá không được để trống.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const productId = String(req.body.productId);
      const exists = await Review.findOne({ product: productId, user: req.user._id });
      if (exists) {
        return res.status(409).json({ success: false, message: 'Bạn đã đánh giá sản phẩm này rồi.' });
      }
      // "Đã mua hàng": tài khoản này có đơn (chưa huỷ) chứa sản phẩm
      const purchased = await Order.exists({
        'items.product': productId,
        status: { $ne: 'cancelled' },
        $or: [{ user: req.user._id }, { user: null, guestEmail: req.user.email }],
      });
      const review = await Review.create({
        product: productId,
        productName: req.body.productName || '',
        user: req.user._id,
        userName: req.user.name,
        rating: Number(req.body.rating),
        title: req.body.title || '',
        content: req.body.content,
        verifiedPurchase: !!purchased,
      });
      res.status(201).json({ success: true, data: toDto(review, req.user._id) });
    } catch (err) { next(err); }
  }
);

// POST /api/reviews/:id/helpful - mỗi tài khoản chỉ bấm "hữu ích" 1 lần
router.post('/:id/helpful', protect, async (req, res, next) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { helpfulBy: req.user._id } },
      { new: true }
    );
    if (!review) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá.' });
    res.json({ success: true, data: toDto(review, req.user._id) });
  } catch (err) { next(err); }
});

module.exports = router;

