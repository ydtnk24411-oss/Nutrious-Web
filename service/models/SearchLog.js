const mongoose = require('mongoose');

const searchLogSchema = new mongoose.Schema(
  {
    keyword:           { type: String, required: true, trim: true },
    normalizedKeyword: { type: String, required: true, trim: true, lowercase: true, index: true },
    resultCount:       { type: Number, default: 0, min: 0 },
    customerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    sessionId:         { type: String, default: '', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

searchLogSchema.index({ normalizedKeyword: 1, createdAt: -1 });

module.exports = mongoose.model('SearchLog', searchLogSchema);
