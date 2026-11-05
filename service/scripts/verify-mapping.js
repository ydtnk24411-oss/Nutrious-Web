const fs = require('fs');

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

const products = JSON.parse(fs.readFileSync(__dirname + '/products-dump.json', 'utf-8'));
console.log('Total products in database:', products.length);
console.log('Total entries in data files:', Object.keys(allData).length);

const missing = [];
products.forEach(p => {
  if (!allData[p.slug]) {
    missing.push({ id: p._id, name: p.name, slug: p.slug, category: p.categoryVi || p.category });
  }
});

if (missing.length === 0) {
  console.log('SUCCESS: All 261 products have a 100% exact matching entry in data files!');
} else {
  console.log(`WARNING: ${missing.length} products missing:`);
  missing.forEach(m => console.log(`  - [${m.slug}] ${m.name} (${m.category})`));
}

