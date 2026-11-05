require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xanh-la');
    console.log('✅ Connected to MongoDB');

    // Xóa user admin cũ nếu có
    await User.deleteOne({ email: 'admin@xanhla.farm' });
    console.log('🗑  Deleted old admin user');

    // Tạo admin user mới
    const admin = await User.create({
      name: 'Admin Xanh Lá',
      email: 'admin@xanhla.farm',
      password: 'admin123',
      role: 'admin',
    });
    console.log('✅ Created admin user → admin@xanhla.farm / admin123');

    console.log('\n✨ Admin reset successful!');
    console.log('Email: admin@xanhla.farm');
    console.log('Password: admin123');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

resetAdmin();
