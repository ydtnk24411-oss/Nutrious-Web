const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');

// Script tiện ích hỗ trợ cập nhật nhanh ảnh và thứ tự cho Danh mục trong MongoDB
// Bạn có thể chỉnh sửa link ảnh (link online hoặc file trong public/images/categories/) tại đây:
const CATEGORY_UPDATES = [
  {
    name: 'Rau củ',
    image: '/images/categories/rau củ.png', // hoặc /images/categories/cat-rau-cu-trai-cay.png
    order: 1,
  },
  {
    name: 'Thịt',
    image: '/images/categories/thịt cá trứng.jpg', // hoặc /images/categories/cat-thit-trung-hai-san.png
    order: 2,
  },
  {
    name: 'Cá & Hải sản',
    image: '/images/categories/cat-thit-trung-hai-san.png',
    order: 3,
  },
  {
    name: 'Thức uống',
    image: '/images/categories/cat-thuc-an-che-bien.png',
    order: 4,
  },
  {
    name: 'Bánh & Đồ ăn vặt',
    image: '/images/categories/cat-banh-keo-snack.png',
    order: 5,
  },
  {
    name: 'Gia vị & Thực phẩm khô',
    image: '/images/categories/đồ khô.png', // hoặc /images/categories/cat-gia-vi-gao-kho.png
    order: 6,
  },
  {
    name: 'Sữa & Thực phẩm mát',
    image: '/images/categories/cat-thuc-pham-dong-mat.png',
    order: 7,
  },
  {
    name: 'Trái cây',
    image: '/images/categories/cat-rau-cu-trai-cay.png',
    order: 8,
  },
];

async function updateCategories() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  for (const item of CATEGORY_UPDATES) {
    const res = await Category.updateOne(
      { name: item.name },
      { $set: { image: item.image, order: item.order } }
    );
    console.log(`Updated "${item.name}": matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  console.log('\nDanh sách sau cập nhật:');
  const cats = await Category.find({}).sort({ order: 1 });
  cats.forEach(c => console.log(`- [${c.order}] ${c.name} => image: "${c.image}"`));

  await mongoose.disconnect();
}

updateCategories().catch(console.error);

