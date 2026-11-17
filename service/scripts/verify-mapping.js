const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const products = await Product.find(
    { isCombo: { $ne: true }, isActive: { $ne: false } },
    'name slug brand origin unit storageInstructions usageInstructions specifications description'
  ).lean();

  const missingMetadata = products.filter(
    (p) =>
      !p.brand ||
      !p.origin ||
      !p.unit ||
      !p.description ||
      !p.specifications ||
      !p.specifications['Năng lượng']
  );

  console.log('Total non-combo active products in MongoDB:', products.length);
  if (missingMetadata.length === 0) {
    console.log('SUCCESS: All non-combo products have complete metadata & nutrition specs in MongoDB.');
  } else {
    console.log(`WARNING: ${missingMetadata.length} products missing metadata/nutrition specs:`);
    missingMetadata.forEach((m) => console.log(`  - [${m.slug}] ${m.name}`));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
