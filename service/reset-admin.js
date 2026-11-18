require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xanh-la');
    console.log(' Connected to MongoDB');

    // Xóa user admin cũ nếu có
    await User.deleteMany({ email: { $in: ['admin@xanhla.farm', 'admin@evergreen.vn'] } });
    console.log('  Deleted old admin user');

    // Tạo admin user mới
    const admin = await User.create({
      name: 'Admin Evergreen Mart',
      email: 'admin@evergreen.vn',
      password: 'admin123',
      role: 'admin',
    });
    console.log(' Created admin user -> admin@evergreen.vn / admin123');

    console.log('\n Admin reset successful!');
    console.log('Email: admin@evergreen.vn');
    console.log('Password: admin123');

    process.exit(0);
  } catch (err) {
    console.error(' Error:', err);
    process.exit(1);
  }
}

resetAdmin();
