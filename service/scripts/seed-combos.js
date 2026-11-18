/**
 * Tạo dữ liệu "Combo mua kèm tiết kiệm" vào collection `combos`.
 *
 * - Mỗi Combo tham chiếu tới các sản phẩm gốc trong collection `products` qua `comboItems[].product`.
 * - Không chèn Combo vào collection `products`; tự động dọn bỏ record combo cũ (nếu còn) trong `products`.
 *
 * Chạy: cd service; node scripts/seed-combos.js
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const Product = require('../models/Product');
const Combo = require('../models/Combo');
const Category = require('../models/Category');

const DISCOUNT_BY_SIZE = { 2: 0.08, 3: 0.12, 4: 0.15 };

function formatVnd(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
}

// Chia danh sách thành nhóm 3; phần dư 1 sản phẩm thì gộp vào nhóm trước, dư 2 thì thành combo đôi
function chunk(list) {
  const groups = [];
  for (let i = 0; i < list.length; i += 3) groups.push(list.slice(i, i + 3));
  const last = groups[groups.length - 1];
  if (last && last.length === 1 && groups.length > 1) {
    groups[groups.length - 2].push(last[0]);
    groups.pop();
  }
  return groups.filter((g) => g.length >= 2);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const baseCount = await Product.countDocuments({ isCombo: { $ne: true } });
  const products = await Product.find({
    isCombo: { $ne: true },
    isActive: { $ne: false },
    categoryId: { $ne: null },
    priceNumber: { $gt: 0 },
  })
    .sort({ priceNumber: 1, _id: 1 })
    .lean();

  const categories = await Category.find({}).lean();
  const catMap = new Map(categories.map((c) => [String(c._id), c]));

  const byCat = new Map();
  for (const p of products) {
    const key = String(p.categoryId);
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key).push(p);
  }

  const ops = [];
  const seenSets = new Set();

  for (const [catId, list] of byCat) {
    if (list.length < 2) continue;
    const catDoc = catMap.get(catId);
    const name = catDoc?.name || list[0].categoryVi || 'Thực phẩm';
    const catSlug = (catDoc?.slug || '').replace(/^\/category\//, '') || list[0].category || 'combo';

    // Cách ghép A: theo giá tăng dần (các món cùng tầm giá)
    // Cách ghép B: xen kẽ rẻ - đắt để có combo cân đối
    const passA = list;
    const passB = [];
    let lo = 0, hi = list.length - 1;
    while (lo <= hi) {
      passB.push(list[lo++]);
      if (lo <= hi) passB.push(list[hi--]);
    }

    let index = 0;
    for (const [tag, ordered] of [['a', passA], ['b', passB]]) {
      for (const group of chunk(ordered)) {
        const setKey = group.map((p) => String(p._id)).sort().join(',');
        if (seenSets.has(setKey)) continue;
        seenSets.add(setKey);
        index += 1;

        const original = group.reduce((s, p) => s + p.priceNumber, 0);
        const rate = DISCOUNT_BY_SIZE[group.length] || 0.1;
        const comboPrice = Math.floor((original * (1 - rate)) / 1000) * 1000;
        const saving = original - comboPrice;
        const stock = Math.max(0, Math.min(50, ...group.map((p) => Number(p.stock) || 0)));
        const slug = `combo-${catId.slice(-6)}-${tag}${index}`;
        const images = Array.from(new Set(group.map((p) => p.image).filter(Boolean)));

        ops.push({
          updateOne: {
            filter: { slug },
            update: {
              $set: {
                name: `Combo ${name} tiết kiệm ${index}`,
                slug,
                price: formatVnd(comboPrice),
                priceNumber: comboPrice,
                originalPriceNumber: original,
                image: images[0] || '',
                images,
                category: catSlug,
                categoryId: catDoc ? catDoc._id : group[0].categoryId,
                categoryVi: name,
                description:
                  `Combo gồm ${group.length} sản phẩm: ${group.map((p) => p.name).join(', ')}. ` +
                  `Tiết kiệm ${formatVnd(saving)} so với mua lẻ.`,
                brand: 'Evergreen Mart',
                unit: `Combo (${group.length} sản phẩm)`,
                comboStatus: 'active',
                comboItems: group.map((p) => ({ product: p._id, quantity: 1 })),
                isActive: true,
                stock,
              },
            },
            upsert: true,
          },
        });
      }
    }
  }

  if (ops.length) {
    const res = await Combo.bulkWrite(ops);
    console.log(`Combos (collection combos): ${res.upsertedCount} created, ${res.modifiedCount} updated (total ${ops.length}).`);
  }

  // Dọn bỏ các record combo cũ từng nằm trong collection products (nếu có)
  const delLegacy = await Product.collection.deleteMany({ isCombo: true });
  if (delLegacy.deletedCount > 0) {
    console.log(`Removed ${delLegacy.deletedCount} legacy isCombo docs from collection products.`);
  }

  const afterBase = await Product.countDocuments({});
  const comboCount = await Combo.countDocuments({});
  console.log(`Products in 'products': ${afterBase}`);
  console.log(`Combos in 'combos': ${comboCount}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

