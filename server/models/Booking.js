const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    service:     { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: { type: String, required: true },  // snapshot
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    guestName:   { type: String, required: true },
    guestEmail:  { type: String, required: true },
    guestPhone:  { type: String, default: '' },
    date:        { type: String, required: true },   // "2026-10-25"
    time:        { type: String, required: true },   // "10:00 AM"
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
