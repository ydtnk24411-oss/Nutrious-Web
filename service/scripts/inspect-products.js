const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const Product = require('../models/Product');
const Category = require('../models/Category');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const total = await Product.countDocuments();
  console.log('Total products:', total);

  const categories = await Category.find();
  console.log('Categories count:', categories.length);
  categories.forEach(c => console.log(`  - ${c._id}: ${c.name} (${c.slug})`));

  // Inspect sample products across categories
  const products = await Product.find({}, 'name slug category categoryVi categoryId price brand manufacturer origin description specifications unit storageInstructions').lean();
  
  const sampleByCategory = {};
  products.forEach(p => {
    const cat = p.categoryVi || p.category || 'Unknown';
    if (!sampleByCategory[cat]) sampleByCategory[cat] = [];
    sampleByCategory[cat].push(p.name);
  });

  console.log('\nProducts count per category:');
  for (const [cat, items] of Object.entries(sampleByCategory)) {
    console.log(`- ${cat}: ${items.length} products`);
  }

  // Check how many have brand, manufacturer, origin, unit, storageInstructions, specifications
  const missingBrand = products.filter(p => !p.brand).length;
  const missingOrigin = products.filter(p => !p.origin).length;
  const missingDesc = products.filter(p => !p.description || p.description.trim() === '').length;
  console.log(`\nMissing fields stats:`);
  console.log(`  Missing brand: ${missingBrand}/${total}`);
  console.log(`  Missing origin: ${missingOrigin}/${total}`);
  console.log(`  Missing description: ${missingDesc}/${total}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

