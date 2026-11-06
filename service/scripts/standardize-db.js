const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const Product = require('../models/Product');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const products = await Product.find({}).lean();
  console.log(`Processing ${products.length} products...`);

  const bulkOps = [];

  for (const p of products) {
    const updateFields = {};

    // 1. Clean specs: remove redundant weight/volume/packaging keys
    if (p.specifications && typeof p.specifications === 'object') {
      const cleanSpecs = { ...p.specifications };
      delete cleanSpecs['Quy cách'];
      delete cleanSpecs['quy cách'];
      delete cleanSpecs['Dung tích'];
      delete cleanSpecs['dung tích'];
      delete cleanSpecs['Khối lượng'];
      delete cleanSpecs['khối lượng'];
      delete cleanSpecs['Khối lượng tịnh'];
      delete cleanSpecs['khối lượng tịnh'];
      delete cleanSpecs['Trọng lượng'];
      delete cleanSpecs['trọng lượng'];
      delete cleanSpecs['Xuất xứ'];
      updateFields.specifications = cleanSpecs;
    }

    // 2. Normalize weight & unit for consistency
    let cleanWeight = p.weight;
    if (p.slug === 'sua-chua-hy-lap-huu-co') {
      updateFields.weight = '350g';
      updateFields.packSize = '350g';
      updateFields.unit = 'Hũ (350g)';
    } else if (p.unit) {
      // Extract weight/volume from unit like "Hộp (950ml)" -> "950ml", "Gói (150g)" -> "150g"
      const match = p.unit.match(/\(([^)]+)\)/);
      if (match) {
        const inner = match[1];
        // If inner is e.g. "12 cái x 30g", check if there's total weight or use inner
        const weightMatch = inner.match(/\d+(?:\.\d+)?\s*(?:g|kg|ml|l|L)\b/i);
        if (weightMatch) {
          updateFields.weight = weightMatch[0];
        }
      }
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: updateFields }
      }
    });
  }

  if (bulkOps.length > 0) {
    const res = await Product.bulkWrite(bulkOps);
    console.log(`Standardized ${res.modifiedCount} products in MongoDB.`);
  }

  // Verification checks
  const p1 = await Product.findOne({ slug: 'sua-tuoi-thanh-trung-th-true-milk-khong-duong-950ml' }).lean();
  console.log('\nVerified TH True Milk:');
  console.log('  unit:', p1.unit);
  console.log('  weight:', p1.weight);
  console.log('  specs:', p1.specifications);

  const p2 = await Product.findOne({ slug: 'sua-chua-hy-lap-huu-co' }).lean();
  console.log('\nVerified Sữa chua Hy Lạp:');
  console.log('  unit:', p2.unit);
  console.log('  weight:', p2.weight);
  console.log('  packSize:', p2.packSize);
  console.log('  specs:', p2.specifications);

  await mongoose.disconnect();
}

main().catch(console.error);

