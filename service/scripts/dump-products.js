const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const Product = require('../models/Product');
const fs = require('fs');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const products = await Product.find({}, '_id name slug category categoryVi price priceNumber weight packaging preparation container').lean();
  fs.writeFileSync(__dirname + '/products-dump.json', JSON.stringify(products, null, 2), 'utf-8');
  console.log('Dumped', products.length, 'products to products-dump.json');
  await mongoose.disconnect();
}

main().catch(console.error);

