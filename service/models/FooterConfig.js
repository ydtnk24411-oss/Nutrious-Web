const mongoose = require('mongoose');

const policySectionSchema = new mongoose.Schema(
  {
    heading: { type: String, required: true },
    content: [{ type: String }],
  },
  { _id: false }
);

const policyItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    updatedAt: { type: String, required: true },
    sections: [policySectionSchema],
  },
  { _id: false }
);

const navLinkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    route: { type: String },
    policyKey: { type: String },
    icon: { type: String },
  },
  { _id: false }
);

const socialLinkSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true },
    label: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const footerConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    brandName: { type: String, default: 'Evergreen Mart' },
    brandDesc: { type: String },
    newsletterTitle: { type: String },
    newsletterDesc: { type: String },
    copyrightText: { type: String },
    contactInfo: {
      hotline: { type: String },
      email: { type: String },
      address: { type: String },
    },
    trustItems: [
      {
        title: { type: String },
        subtitle: { type: String },
        iconKey: { type: String },
      },
    ],
    serviceLinks: [navLinkSchema],
    utilityLinks: [navLinkSchema],
    aboutLinks: [navLinkSchema],
    policyLinks: [navLinkSchema],
    socialLinks: [socialLinkSchema],
    paymentMethods: [{ type: String }],
    policies: [policyItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('FooterConfig', footerConfigSchema);
