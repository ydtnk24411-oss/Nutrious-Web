const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema(
  {
    // Session & User identity
    sessionId: { type: String, required: true, index: true },
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    isNewUser: { type: Boolean, default: false },

    // Event categorization
    // pageview | click | search | view_item | view_category | add_to_cart | remove_from_cart | begin_checkout | checkout_step | purchase | contact | error
    eventType: { type: String, required: true, index: true },
    eventName: { type: String, default: '' },

    // Navigation & Context
    path:      { type: String, default: '/' },
    referrer:  { type: String, default: '' },
    source:    { type: String, default: 'direct', index: true }, // direct | organic | social | cpc | referral
    medium:    { type: String, default: 'none' },
    campaign:  { type: String, default: '' },

    // Device & Performance
    deviceType:{ type: String, enum: ['mobile', 'desktop', 'tablet'], default: 'desktop', index: true },
    browser:   { type: String, default: '' },
    os:        { type: String, default: '' },
    loadTimeMs:{ type: Number, default: 0 }, // Trang tải trong bao nhiêu ms

    // E-commerce & Interaction specifics
    productId:   { type: String, default: '' },
    productName: { type: String, default: '' },
    productPrice:{ type: Number, default: 0 },
    category:    { type: String, default: '' },
    searchQuery: { type: String, default: '' },
    searchHasResults: { type: Boolean, default: true },
    buttonId:    { type: String, default: '' }, // Tên nút hoặc CTA
    cartTotal:   { type: Number, default: 0 },
    cartItemCount:{ type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 }, // Thời gian tương tác / xem trang

    // Error details
    errorMessage:{ type: String, default: '' },

    // Metadata
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
  }
);

analyticsEventSchema.index({ createdAt: -1 });
analyticsEventSchema.index({ eventType: 1, createdAt: -1 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
