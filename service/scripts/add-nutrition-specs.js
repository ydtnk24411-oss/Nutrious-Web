const fs = require('fs');
const path = require('path');

const serviceEnvPath = path.join(__dirname, '..', '.env');
const legacyEnvPath = path.join(__dirname, '..', '..', 'server', '.env');
const envPath = fs.existsSync(serviceEnvPath) ? serviceEnvPath : legacyEnvPath;
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const mongoose = require('mongoose');
const Product = require('../models/Product');
const nutritionFacts = require('./data/nutrition-facts');

const DATA_FILES = [
  'bakery',
  'dairy',
  'beverages',
  'pantry',
  'vegetables',
  'fruits',
  'meat',
  'seafood',
];

function formatSingleQuotedObject(obj) {
  const parts = Object.entries(obj).map(([k, v]) => {
    const safeK = String(k).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeV = String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${safeK}': '${safeV}'`;
  });
  return `{ ${parts.join(', ')} }`;
}

function updateDataFiles() {
  let totalUpdated = 0;

  for (const name of DATA_FILES) {
    const filePath = path.join(__dirname, 'data', `${name}.js`);
    delete require.cache[require.resolve(filePath)];
    const dataObj = require(filePath);
    let content = fs.readFileSync(filePath, 'utf-8');

    for (const [slug, item] of Object.entries(dataObj)) {
      const nut = nutritionFacts[slug];
      if (!nut) {
        throw new Error(`Missing nutrition facts for slug: ${slug} in ${name}.js`);
      }
      const mergedSpecs = {
        ...(item.specifications || {}),
        ...nut,
      };
      const newSpecsStr = `specifications: ${formatSingleQuotedObject(mergedSpecs)},`;

      // Replace the specifications line inside this slug's block
      const slugEscaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blockRegex = new RegExp(
        `(['"]${slugEscaped}['"]\\s*:\\s*\\{[\\s\\S]*?)(specifications:\\s*\\{[^\\n]*\\},)`,
        'm'
      );
      if (!blockRegex.test(content)) {
        throw new Error(`Could not locate specifications line for slug: ${slug} in ${name}.js`);
      }
      content = content.replace(blockRegex, `$1${newSpecsStr}`);
      totalUpdated++;
    }

    fs.writeFileSync(filePath, content, 'utf-8');
  }

  console.log(`Updated ${totalUpdated} products across ${DATA_FILES.length} data files.`);
}

async function updateMongoDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xanh-la';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const products = await Product.find({ isCombo: { $ne: true } }, '_id slug name specifications').lean();
  console.log(`Found ${products.length} regular products in MongoDB.`);

  const bulkOps = [];
  for (const p of products) {
    const nut = nutritionFacts[p.slug];
    if (!nut) {
      console.warn(`No nutrition facts found for [${p.slug}] ${p.name}`);
      continue;
    }

    const mergedSpecs = {
      ...(p.specifications && typeof p.specifications === 'object' ? p.specifications : {}),
      ...nut,
    };

    bulkOps.push({
      updateOne: {
        filter: { _id: p._id },
        update: {
          $set: {
            specifications: mergedSpecs,
          },
        },
      },
    });
  }

  if (bulkOps.length > 0) {
    const res = await Product.bulkWrite(bulkOps);
    console.log(`MongoDB bulkWrite: matched=${res.matchedCount}, modified=${res.modifiedCount}`);
  }

  const sample = await Product.findOne({ slug: 'cai-thia-baby-tuoi-clean' }, 'name slug specifications').lean();
  console.log('\nSample verified in MongoDB:', JSON.stringify(sample, null, 2));

  await mongoose.disconnect();
}

async function main() {
  updateDataFiles();
  await updateMongoDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
