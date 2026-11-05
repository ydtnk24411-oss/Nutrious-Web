const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const Product = require('../models/Product');

const bakery = require('./data/bakery');
const dairy = require('./data/dairy');
const beverages = require('./data/beverages');
const pantry = require('./data/pantry');
const vegetables = require('./data/vegetables');
const fruits = require('./data/fruits');
const meat = require('./data/meat');
const seafood = require('./data/seafood');

const allData = {
  ...bakery,
  ...dairy,
  ...beverages,
  ...pantry,
  ...vegetables,
  ...fruits,
  ...meat,
  ...seafood
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const products = await Product.find({}, '_id slug name').lean();
  console.log(`Found ${products.length} products in MongoDB.`);

  const bulkOps = [];
  let matchedCount = 0;

  for (const p of products) {
    const data = allData[p.slug];
    if (data) {
      matchedCount++;
      bulkOps.push({
        updateOne: {
          filter: { _id: p._id },
          update: {
            $set: {
              brand: data.brand,
              manufacturer: data.manufacturer,
              origin: data.origin,
              unit: data.unit,
              storageInstructions: data.storageInstructions,
              usageInstructions: data.usageInstructions,
              specifications: data.specifications,
              description: data.description
            }
          }
        }
      });
    } else {
      console.warn(`No metadata found for product: [${p.slug}] ${p.name}`);
    }
  }

  console.log(`Prepared ${bulkOps.length} bulk update operations (matched: ${matchedCount}/${products.length}).`);

  if (bulkOps.length > 0) {
    const res = await Product.bulkWrite(bulkOps);
    console.log('BulkWrite result:');
    console.log(`  Matched: ${res.matchedCount}`);
    console.log(`  Modified: ${res.modifiedCount}`);
  }

  // Verification
  const sample = await Product.findOne({ slug: 'banh-quy-nhan-choco-pie-orion-hop-12-cai' }).lean();
  console.log('\n--- Sample Check 1 (External brand: ChocoPie): ---');
  console.log(`Name: ${sample.name}`);
  console.log(`Brand: ${sample.brand}`);
  console.log(`Manufacturer: ${sample.manufacturer}`);
  console.log(`Origin: ${sample.origin}`);
  console.log(`Unit: ${sample.unit}`);
  console.log(`Storage: ${sample.storageInstructions}`);
  console.log(`Desc: ${sample.description}`);
  console.log(`Specs:`, sample.specifications);

  const sample2 = await Product.findOne({ slug: 'cai-thia-baby-tuoi-clean' }).lean();
  console.log('\n--- Sample Check 2 (Evergreen Mart brand: Cải thìa): ---');
  console.log(`Name: ${sample2.name}`);
  console.log(`Brand: ${sample2.brand}`);
  console.log(`Manufacturer: ${sample2.manufacturer}`);
  console.log(`Origin: ${sample2.origin}`);
  console.log(`Unit: ${sample2.unit}`);
  console.log(`Storage: ${sample2.storageInstructions}`);
  console.log(`Desc: ${sample2.description}`);
  console.log(`Specs:`, sample2.specifications);

  const sample3 = await Product.findOne({ slug: 'ca-hoi-na-uy-nguyen-con' }).lean();
  console.log('\n--- Sample Check 3 (Seafood: SalMar Cá Hồi): ---');
  console.log(`Name: ${sample3.name}`);
  console.log(`Brand: ${sample3.brand}`);
  console.log(`Manufacturer: ${sample3.manufacturer}`);
  console.log(`Origin: ${sample3.origin}`);
  console.log(`Unit: ${sample3.unit}`);
  console.log(`Storage: ${sample3.storageInstructions}`);
  console.log(`Desc: ${sample3.description}`);
  console.log(`Specs:`, sample3.specifications);

  // Check overall stats
  const missingBrand = await Product.countDocuments({ $or: [{ brand: { $exists: false } }, { brand: '' }] });
  const missingOrigin = await Product.countDocuments({ $or: [{ origin: { $exists: false } }, { origin: '' }] });
  const missingDesc = await Product.countDocuments({ $or: [{ description: { $exists: false } }, { description: '' }] });
  console.log('\n--- Verification Stats: ---');
  console.log(`Missing brand: ${missingBrand}/261`);
  console.log(`Missing origin: ${missingOrigin}/261`);
  console.log(`Missing description: ${missingDesc}/261`);

  await mongoose.disconnect();
  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

