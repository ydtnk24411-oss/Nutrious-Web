const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cats = await Category.find({ isActive: { $ne: false } }).sort({ order: 1, createdAt: 1 });
  console.log('Categories count:', cats.length);
  cats.forEach(c => {
    const imgPreview = c.image ? (c.image.startsWith('data:') ? 'BASE64 (' + c.image.length + ')' : c.image) : 'NONE';
    console.log(c.name, '=>', imgPreview);
  });
  await mongoose.disconnect();
}

check().catch(console.error);
