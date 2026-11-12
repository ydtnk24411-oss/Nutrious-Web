const router = require('express').Router();
const mongoose = require('mongoose');
const { body } = require('express-validator');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, optionalAuth, staffOnly, hasRole, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const toDto = (r, viewerId) => {
  const userObj = r.user && typeof r.user === 'object' ? r.user : null;
  const userAvatar = r.userAvatar || userObj?.avatar || '';
  const userName = r.userName || userObj?.name || 'Khách hàng';
  return {
    id: String(r._id),
    productId: r.product,
    productName: r.productName,
    productImage: r.productImage || '',
    userId: userObj ? String(userObj._id) : String(r.user),
    userName,
    userAvatar,
    rating: r.rating,
    title: r.title || undefined,
    content: r.content,
    images: r.images || [],
    helpfulCount: (r.helpfulBy || []).length + (r.guestHelpfulCount || 0),
    isHelpful: viewerId ? (r.helpfulBy || []).some((u) => String(u) === String(viewerId)) : false,
    adminReply: r.adminReply || '',
    adminReplyAt: r.adminReplyAt || null,
    isHidden: r.isHidden,
    createdAt: r.createdAt,
    verifiedPurchase: r.verifiedPurchase,
  };
};

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
    })
      .populate('user', 'name avatar email')
      .sort({ createdAt: -1 });

    let defaultProductImage = '';
    const needsProdImg = reviews.some((r) => !r.productImage);
    if (needsProdImg && req.params.productId) {
      try {
        const prod = await Product.findById(req.params.productId).select('image name');
        if (prod) {
          defaultProductImage = prod.image || '';
        }
      } catch (e) {}
    }

    res.json({
      success: true,
      data: reviews.map((r) => {
        if (!r.productImage && defaultProductImage) {
          r.productImage = defaultProductImage;
        }
        return toDto(r, req.user?._id);
      }),
      stats: buildStats(reviews),
    });
  } catch (err) { next(err); }
});

// GET /api/reviews/admin — list all reviews for admin
router.get('/admin', protect, staffOnly, async (req, res, next) => {
  try {
    const { rating, status, search, sort = 'newest', page = 1, limit = 50 } = req.query;
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

    const sortOption = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

    const [allReviews, reviews, total] = await Promise.all([
      Review.find({}), // for global stats
      Review.find(filter)
        .sort(sortOption)
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('user', 'name email avatar'),
      Review.countDocuments(filter),
    ]);

    const missingProductIds = [
      ...new Set(
        reviews
          .filter((r) => !r.productImage && r.product)
          .map((r) => r.product)
      ),
    ];
    let prodMap = {};
    if (missingProductIds.length > 0) {
      try {
        const prods = await Product.find({ _id: { $in: missingProductIds } }).select('_id name image');
        prods.forEach((p) => {
          prodMap[String(p._id)] = p;
        });
      } catch (e) {}
    }

    const data = reviews.map((r) => {
      const obj = r.toObject ? r.toObject() : { ...r };
      if (!obj.productImage && prodMap[String(r.product)]) {
        obj.productImage = prodMap[String(r.product)].image || '';
        if (!obj.productName) obj.productName = prodMap[String(r.product)].name || '';
      }
      if (!obj.userAvatar && r.user && typeof r.user === 'object' && r.user.avatar) {
        obj.userAvatar = r.user.avatar;
      }
      return obj;
    });

    const globalStats = buildStats(allReviews);
    const pendingReplyCount = allReviews.filter((r) => !r.adminReply).length;

    res.json({
      success: true,
      data,
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

    await review.populate('user', 'name email avatar');
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

// GET /api/reviews/product/:productId/can-review
// Kiểm tra điều kiện đánh giá của khách hàng đối với sản phẩm (Bắt buộc mua và nhận hàng thành công)
router.get('/product/:productId/can-review', protect, async (req, res, next) => {
  try {
    const rawProductId = String(req.params.productId);

    let prod = null;
    if (mongoose.Types.ObjectId.isValid(rawProductId)) {
      prod = await Product.findById(rawProductId);
    }
    if (!prod) {
      prod = await Product.findOne({ slug: rawProductId });
    }

    const targetId = prod ? String(prod._id) : rawProductId;
    const targetSlug = prod?.slug || '';
    const targetName = prod?.name || '';

    // 1. Kiểm tra tài khoản đã đánh giá sản phẩm này chưa
    const existingReview = await Review.findOne({
      product: { $in: [targetId, ...(targetSlug ? [targetSlug] : [])] },
      user: req.user._id,
    });

    // 2. Điều kiện xác định tài khoản người mua
    const userConditions = [{ user: req.user._id }];
    if (req.user.email) userConditions.push({ guestEmail: req.user.email.toLowerCase() });
    if (req.user.phone) userConditions.push({ guestPhone: req.user.phone });

    // 3. Điều kiện khớp sản phẩm trong đơn hàng (kể cả trong combo hoặc add-on)
    const productMatchConditions = [
      { 'items.product': targetId },
      ...(targetSlug ? [{ 'items.product': targetSlug }] : []),
      ...(targetName ? [{ 'items.productName': targetName }] : []),
      { 'items.comboItems.product': targetId },
      ...(targetSlug ? [{ 'items.comboItems.slug': targetSlug }] : []),
      ...(targetName ? [{ 'items.comboItems.name': targetName }] : []),
    ];

    // 4. Tìm đơn hàng ĐÃ GIAO / ĐÃ NHẬN THÀNH CÔNG (status: 'delivered')
    const deliveredOrder = await Order.findOne({
      status: 'delivered',
      $and: [
        { $or: userConditions },
        { $or: productMatchConditions },
      ],
    });

    // 5. Tìm đơn hàng đang xử lý / đang giao
    const pendingOrder = !deliveredOrder
      ? await Order.findOne({
          status: { $in: ['pending', 'confirmed', 'preparing', 'shipping'] },
          $and: [
            { $or: userConditions },
            { $or: productMatchConditions },
          ],
        })
      : null;

    let canReview = false;
    let message = '';

    if (existingReview) {
      canReview = false;
      message = 'Bạn đã đánh giá sản phẩm này rồi. Mỗi tài khoản chỉ có thể đánh giá một lần.';
    } else if (deliveredOrder) {
      canReview = true;
      message = 'Bạn đã mua và nhận hàng thành công. Bạn có thể viết đánh giá cho sản phẩm này.';
    } else if (pendingOrder) {
      canReview = false;
      message = 'Đơn hàng chứa sản phẩm này đang được xử lý hoặc vận chuyển. Bạn chỉ có thể đánh giá sau khi đã nhận được hàng.';
    } else {
      canReview = false;
      message = 'Bắt buộc phải mua và nhận hàng thành công mới được đánh giá sản phẩm này.';
    }

    res.json({
      success: true,
      canReview,
      hasReviewed: !!existingReview,
      hasDeliveredOrder: !!deliveredOrder,
      hasPendingOrder: !!pendingOrder,
      message,
    });
  } catch (err) { next(err); }
});

// POST /api/reviews - customer create review
// BẮT BUỘC: Phải mua và nhận hàng thành công mới được đánh giá (status: 'delivered')
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
      const rawProductId = String(req.body.productId);

      let prod = null;
      if (mongoose.Types.ObjectId.isValid(rawProductId)) {
        prod = await Product.findById(rawProductId);
      }
      if (!prod) {
        prod = await Product.findOne({ slug: rawProductId });
      }

      const targetId = prod ? String(prod._id) : rawProductId;
      const targetSlug = prod?.slug || '';
      const targetName = prod?.name || req.body.productName || '';
      const targetImage = prod?.image || req.body.productImage || '';

      // 1. Kiểm tra tài khoản đã đánh giá sản phẩm này chưa
      const exists = await Review.findOne({
        product: { $in: [targetId, ...(targetSlug ? [targetSlug] : [])] },
        user: req.user._id,
      });
      if (exists) {
        return res.status(409).json({ success: false, message: 'Bạn đã đánh giá sản phẩm này rồi.' });
      }

      // 2. BẮT BUỘC: Kiểm tra đơn hàng có trạng thái ĐÃ NHẬN HÀNG (status: 'delivered')
      const userConditions = [{ user: req.user._id }];
      if (req.user.email) userConditions.push({ guestEmail: req.user.email.toLowerCase() });
      if (req.user.phone) userConditions.push({ guestPhone: req.user.phone });

      const productMatchConditions = [
        { 'items.product': targetId },
        ...(targetSlug ? [{ 'items.product': targetSlug }] : []),
        ...(targetName ? [{ 'items.productName': targetName }] : []),
        { 'items.comboItems.product': targetId },
        ...(targetSlug ? [{ 'items.comboItems.slug': targetSlug }] : []),
        ...(targetName ? [{ 'items.comboItems.name': targetName }] : []),
      ];

      const deliveredOrder = await Order.findOne({
        status: 'delivered',
        $and: [
          { $or: userConditions },
          { $or: productMatchConditions },
        ],
      });

      if (!deliveredOrder) {
        // Kiểm tra xem khách có đơn hàng chưa giao để phản hồi chính xác
        const pendingOrder = await Order.findOne({
          status: { $in: ['pending', 'confirmed', 'preparing', 'shipping'] },
          $and: [
            { $or: userConditions },
            { $or: productMatchConditions },
          ],
        });

        if (pendingOrder) {
          return res.status(403).json({
            success: false,
            code: 'ORDER_NOT_DELIVERED',
            message: 'Đơn hàng của bạn đang được xử lý hoặc đang giao. Bạn chỉ có thể đánh giá sau khi đã nhận được hàng.',
          });
        }

        return res.status(403).json({
          success: false,
          code: 'PURCHASE_REQUIRED',
          message: 'Bắt buộc phải mua và nhận hàng thành công mới được đánh giá sản phẩm này.',
        });
      }

      const rawImages = Array.isArray(req.body.images)
        ? req.body.images
            .filter((img) => typeof img === 'string' && img.trim().length > 0)
            .slice(0, 5)
        : [];

      const review = await Review.create({
        product: targetId,
        productName: targetName,
        productImage: targetImage,
        user: req.user._id,
        userName: req.user.name,
        userAvatar: req.user.avatar || '',
        rating: Number(req.body.rating),
        title: req.body.title || '',
        content: req.body.content,
        images: rawImages,
        verifiedPurchase: true,
      });

      res.status(201).json({ success: true, data: toDto(review, req.user._id) });
    } catch (err) { next(err); }
  }
);

// POST /api/reviews/:id/helpful (Cho phép cả thành viên đã đăng nhập và khách vãng lai)
router.post('/:id/helpful', optionalAuth, async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá.' });

    if (req.user?._id) {
      const uId = String(req.user._id);
      const index = (review.helpfulBy || []).findIndex((id) => String(id) === uId);
      if (index >= 0) {
        review.helpfulBy.splice(index, 1);
      } else {
        review.helpfulBy.push(req.user._id);
      }
    } else {
      // Khách vãng lai
      const action = req.body?.action;
      if (action === 'unlike') {
        review.guestHelpfulCount = Math.max(0, (review.guestHelpfulCount || 0) - 1);
      } else {
        review.guestHelpfulCount = (review.guestHelpfulCount || 0) + 1;
      }
    }

    await review.save();
    await review.populate('user', 'name avatar email');
    res.json({ success: true, data: toDto(review, req.user?._id) });
  } catch (err) { next(err); }
});

module.exports = router;
