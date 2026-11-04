const router = require('express').Router();
const { body } = require('express-validator');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { protect, optionalAuth, staffOnly, hasRole, adminOnly } = require('../middleware/auth');
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
  adminReply: r.adminReply,
  adminReplyAt: r.adminReplyAt,
  isHidden: r.isHidden,
  createdAt: r.createdAt,
  verifiedPurchase: r.verifiedPurchase,
});

const buildStats = (reviews) => {
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  reviews.forEach((r) => { dist[r.rating] = (dist[r.rating] || 0) + 1; sum += r.rating; });
  const total = reviews.length;
  return {
    averageRating: total ? Math.round((sum / total) * 10) / 10 : 0,
    totalReviews: total,
    ratingDistribution: dist,
  };
};

// GET /api/reviews/product/:productId - public (only non-hidden)
router.get('/product/:productId', optionalAuth, async (req, res, next) => {
  try {
    const reviews = await Review.find({
      product: req.params.productId,
      isHidden: { $ne: true },
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reviews.map((r) => toDto(r, req.user?._id)),
      stats: buildStats(reviews),
    });
  } catch (err) { next(err); }
});

// GET /api/reviews/admin — list all reviews for admin
router.get('/admin', protect, staffOnly, async (req, res, next) => {
  try {
    const { rating, status, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (rating && rating !== 'all') filter.rating = Number(rating);
    if (status === 'visible') filter.isHidden = { $ne: true };
    if (status === 'hidden') filter.isHidden = true;
    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const [allReviews, reviews, total] = await Promise.all([
      Review.find({}), // for global stats
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('user', 'name email avatar'),
      Review.countDocuments(filter),
    ]);

    const globalStats = buildStats(allReviews);
    const pendingReplyCount = allReviews.filter((r) => !r.adminReply).length;

    res.json({
      success: true,
      data: reviews,
      stats: {
        total: allReviews.length,
        averageRating: globalStats.averageRating,
        ratingDistribution: globalStats.ratingDistribution,
        pendingReplyCount,
      },
      total,
    });
  } catch (err) { next(err); }
});

// PUT /api/reviews/:id/reply — admin reply
router.put('/:id/reply', protect, hasRole('support', 'admin'), async (req, res, next) => {
  try {
    const { reply } = req.body;
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá.' });
    }

    review.adminReply = (reply || '').trim();
    review.adminReplyAt = new Date();
    await review.save();

    res.json({ success: true, data: review });
  } catch (err) { next(err); }
});

// PUT /api/reviews/:id/hide — toggle isHidden
router.put('/:id/hide', protect, hasRole('support', 'admin'), async (req, res, next) => {
  try {
    const { isHidden } = req.body;
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá.' });
    }

    review.isHidden = typeof isHidden === 'boolean' ? isHidden : !review.isHidden;
    await review.save();

    res.json({ success: true, data: review });
  } catch (err) { next(err); }
});

// DELETE /api/reviews/:id — admin remove
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá.' });
    }
    res.json({ success: true, message: 'Đã xóa đánh giá.' });
  } catch (err) { next(err); }
});

// POST /api/reviews - customer create review
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

// POST /api/reviews/:id/helpful
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
