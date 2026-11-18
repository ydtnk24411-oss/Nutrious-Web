const mongoose = require('mongoose');

const BannerMediaSchema = new mongoose.Schema(
  {
    filename: { type: String, default: 'banner-image', trim: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    data: { type: Buffer, required: true },
    uploadedBy: { type: String, default: 'marketing' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BannerMedia', BannerMediaSchema);

