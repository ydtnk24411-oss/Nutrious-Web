const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');

const imagesDir = path.resolve(__dirname, '../../my-app/public/images/categories');

const mapping = [
  { name: 'Bánh & Đồ ăn vặt', file: 'banh.png', order: 1 },
  { name: 'Trái cây', file: 'trai-cay.png', order: 2 },
  { name: 'Thịt', file: 'thit.png', order: 3 },
  { name: 'Thức uống', file: 'nuoc-uong.png', order: 4 },
  { name: 'Gia vị & Thực phẩm khô', file: 'do-kho.png', order: 5 },
  { name: 'Cá & Hải sản', file: 'ca-va-haisan.png', order: 6 },
  { name: 'Sữa & Thực phẩm mát', file: 'sua.png', order: 7 },
  { name: 'Rau củ', file: 'rau-cu.png', order: 8 },
];

async function updateDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  for (const item of mapping) {
    const filePath = path.join(imagesDir, item.file);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }
    const buf = fs.readFileSync(filePath);
    const base64Uri = `data:image/png;base64,${buf.toString('base64')}`;

    const res = await Category.updateOne(
      { name: item.name },
      { $set: { image: base64Uri, order: item.order } }
    );
    console.log(`Updated "${item.name}" with ${item.file} (bytes: ${buf.length}): matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  await mongoose.disconnect();
  console.log('Done updating MongoDB categories with transparent PNGs!');
}

updateDb().catch(console.error);

