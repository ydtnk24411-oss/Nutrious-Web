const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const Product = require('../models/Product');
const Category = require('../models/Category');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const cats = await Category.find({}).lean();
  const catMap = {
    'Rau củ': cats.find(c => c.name === 'Rau củ')?._id,
    'Trái cây': cats.find(c => c.name === 'Trái cây')?._id,
    'Thịt': cats.find(c => c.name === 'Thịt')?._id,
    'Cá & Hải sản': cats.find(c => c.name === 'Cá & Hải sản')?._id,
    'Sữa & Thực phẩm mát': cats.find(c => c.name === 'Sữa & Thực phẩm mát')?._id,
    'Thức uống': cats.find(c => c.name === 'Thức uống')?._id,
    'Bánh & Đồ ăn vặt': cats.find(c => c.name === 'Bánh & Đồ ăn vặt')?._id,
    'Gia vị & Thực phẩm khô': cats.find(c => c.name === 'Gia vị & Thực phẩm khô')?._id,
  };

  const combos = await Product.find({ isCombo: true }).lean();
  let updated = 0;
  for (const c of combos) {
    let targetCatId = null;
    let targetCatSlug = '';
    let targetCatVi = '';

    if (/rau củ/i.test(c.name)) {
      targetCatId = catMap['Rau củ']; targetCatSlug = 'vegetables'; targetCatVi = 'Rau củ';
    } else if (/trái cây/i.test(c.name)) {
      targetCatId = catMap['Trái cây']; targetCatSlug = 'fruits'; targetCatVi = 'Trái cây';
    } else if (/thịt/i.test(c.name)) {
      targetCatId = catMap['Thịt']; targetCatSlug = 'meat'; targetCatVi = 'Thịt';
    } else if (/hải sản|cá/i.test(c.name)) {
      targetCatId = catMap['Cá & Hải sản']; targetCatSlug = 'seafood'; targetCatVi = 'Cá & Hải sản';
    } else if (/sữa/i.test(c.name)) {
      targetCatId = catMap['Sữa & Thực phẩm mát']; targetCatSlug = 'dairy'; targetCatVi = 'Sữa & Thực phẩm mát';
    } else if (/thức uống|đồ uống/i.test(c.name)) {
      targetCatId = catMap['Thức uống']; targetCatSlug = 'beverages'; targetCatVi = 'Thức uống';
    } else if (/bánh/i.test(c.name)) {
      targetCatId = catMap['Bánh & Đồ ăn vặt']; targetCatSlug = 'bakery'; targetCatVi = 'Bánh & Đồ ăn vặt';
    } else if (/gia vị/i.test(c.name)) {
      targetCatId = catMap['Gia vị & Thực phẩm khô']; targetCatSlug = 'pantry'; targetCatVi = 'Gia vị & Thực phẩm khô';
    }

    if (targetCatId && (!c.categoryId || c.categoryId.toString() !== targetCatId.toString())) {
      await Product.updateOne(
        { _id: c._id },
        { $set: { categoryId: targetCatId, category: targetCatSlug, categoryVi: targetCatVi } }
      );
      updated++;
    }
  }

  console.log(`Updated ${updated} combos with matching categoryId.`);
  await mongoose.disconnect();
}

main().catch(console.error);

