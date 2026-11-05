const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product:          { type: String, required: true, index: true }, // _id sản phẩm
    productName:      { type: String, default: '' },
    productImage:     { type: String, default: '' },
    user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName:         { type: String, required: true },
    userAvatar:       { type: String, default: '' },
    rating:           { type: Number, required: true, min: 1, max: 5 },
    title:            { type: String, default: '', trim: true },
    content:          { type: String, required: true, trim: true },
    images:           [{ type: String }],
    helpfulBy:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    verifiedPurchase: { type: Boolean, default: false },
    adminReply:       { type: String, default: '' },
    adminReplyAt:     { type: Date, default: null },
    isHidden:         { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Mỗi tài khoản chỉ đánh giá 1 lần cho 1 sản phẩm
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
