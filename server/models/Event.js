const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true },
    date:        { type: String, required: true },   // display string e.g. "Thứ 5, 22 thg 10"
    time:        { type: String, required: true },
    location:    { type: String, required: true },
    description: { type: String, default: '' },
    image:       { type: String, default: '' },
    action:      { type: String, default: 'Đăng ký' },  // button label
    isActive:    { type: Boolean, default: true },
    capacity:    { type: Number, default: 50 },
    registrations: [
      {
        name:      String,
        email:     String,
        phone:     String,
        userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
