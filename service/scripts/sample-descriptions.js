const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const Product = require('../models/Product');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const products = await Product.find({}, 'name slug category categoryVi description weight packaging preparation').limit(15).lean();
  products.forEach(p => {
    console.log(`\n[${p.name}] (${p.categoryVi})`);
    console.log(`  Weight: ${p.weight} | Packaging: ${p.packaging} | Preparation: ${p.preparation}`);
    console.log(`  Desc: ${p.description}`);
  });
  await mongoose.disconnect();
}

main().catch(console.error);

