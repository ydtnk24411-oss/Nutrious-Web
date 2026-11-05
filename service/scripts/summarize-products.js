const fs = require('fs');
const products = JSON.parse(fs.readFileSync(__dirname + '/products-dump.json', 'utf-8'));

const byCat = {};
products.forEach(p => {
  const cat = p.categoryVi || p.category || 'Unknown';
  if (!byCat[cat]) byCat[cat] = [];
  byCat[cat].push(p.name);
});

for (const [cat, names] of Object.entries(byCat)) {
  console.log(`\n================= ${cat} (${names.length}) =================`);
  names.forEach((n, i) => console.log(`${i+1}. ${n}`));
}

