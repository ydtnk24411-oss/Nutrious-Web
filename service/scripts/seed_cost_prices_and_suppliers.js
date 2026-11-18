require('dotenv').config({ path: 'service/.env' });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const StoreInventory = require('../models/StoreInventory');
const Supplier = require('../models/Supplier');

const DEFAULT_SUPPLIERS = [
  {
    code: 'NCC-DALAT',
    name: 'Nông Trại Hữu Cơ Đà Lạt Bio Organics',
    contactPerson: 'Anh Nguyễn Minh Tuấn',
    phone: '0903 123 456',
    email: 'dalat.bio@evergreen.vn',
    address: 'Đường Vạn Hạnh, Phường 8, TP. Đà Lạt',
    province: 'Lâm Đồng',
    category: 'Rau củ hữu cơ & Trái cây',
    notes: 'Nhà cung cấp rau củ chuẩn VietGAP và Organic chính vụ',
  },
  {
    code: 'NCC-CUCHI',
    name: 'Hợp Tác Xã Nông Nghiệp Sạch Củ Chi',
    contactPerson: 'Chị Lê Thị Bích',
    phone: '0918 654 321',
    email: 'cuchi.clean@evergreen.vn',
    address: 'Tỉnh lộ 8, Xã Tân Thạnh Đông, Huyện Củ Chi',
    province: 'TP. Hồ Chí Minh',
    category: 'Rau ăn lá & Nấm tươi',
    notes: 'Cung cấp rau ăn lá tươi thu hoạch sáng sớm hàng ngày',
  },
  {
    code: 'NCC-MOCCHAU',
    name: 'Trang Trại Sữa & Nông Sản Mộc Châu',
    contactPerson: 'Anh Hoàng Văn Sơn',
    phone: '0988 777 888',
    email: 'mocchau.farm@evergreen.vn',
    address: 'Tiểu khu Mía Đường, Huyện Mộc Châu',
    province: 'Sơn La',
    category: 'Sữa tươi, Bơ & Nông sản sấy',
    notes: 'Đối tác độc quyền các dòng sữa hạt và nông sản Tây Bắc',
  },
  {
    code: 'NCC-DONGTHAP',
    name: 'Vựa Trái Cây Miệt Vườn Đồng Tháp',
    contactPerson: 'Chú Huỳnh Tấn Lộc',
    phone: '0939 444 555',
    email: 'dongthap.fruits@evergreen.vn',
    address: 'Quốc lộ 30, TP. Cao Lãnh',
    province: 'Đồng Tháp',
    category: 'Trái cây nhiệt đới & Nông sản sấy khô',
    notes: 'Xoài Cát Chu, ổi Ruby, bưởi da xanh đạt chuẩn GlobalGAP',
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // 1. Seed Suppliers
  for (const sup of DEFAULT_SUPPLIERS) {
    await Supplier.findOneAndUpdate(
      { code: sup.code },
      { $set: sup },
      { upsert: true, new: true }
    );
  }
  console.log(`Seeded ${DEFAULT_SUPPLIERS.length} suppliers.`);

  // 2. Update costPrice for all products based on realistic category margins
  const products = await Product.find({ isActive: { $ne: false } });
  await Product.updateMany({ reservedStock: { $lt: 0 } }, { $set: { reservedStock: 0 } });
  await StoreInventory.updateMany({ reservedStock: { $lt: 0 } }, { $set: { reservedStock: 0 } });

  console.log(`Updating costPrice for ${products.length} products...`);

  const bulkOps = [];
  for (const p of products) {
    const priceNum = p.priceNumber || 0;
    const cat = (p.category || '').toLowerCase() + ' ' + (p.categoryVi || '').toLowerCase() + ' ' + (p.name || '').toLowerCase();

    let costRatio = 0.55; // Mặc định 55%

    if (/thịt|cá|hải sản|thịt bò|thịt heo|thịt gà|chả lụa/i.test(cat)) {
      costRatio = 0.72; // Thịt/Cá: giá vốn cao ~72%
    } else if (/trái cây|hoa quả|bưởi|xoài|cam|nho|táo/i.test(cat)) {
      costRatio = 0.58; // Trái cây: giá vốn ~58%
    } else if (/rau|nấm|củ|quả tươi/i.test(cat)) {
      costRatio = 0.52; // Rau củ: giá vốn ~52%
    } else if (/hạt|đồ khô|sấy|mật ong|gia vị|trà|ngũ cốc/i.test(cat)) {
      costRatio = 0.46; // Đồ khô/hạt: biên dày hơn, giá vốn ~46%
    }

    const calculatedCost = Math.round(priceNum * costRatio);
    const roundedCost = Math.round(calculatedCost / 500) * 500;
    const costPrice = roundedCost > 0 ? roundedCost : Math.round(priceNum * 0.55);

    bulkOps.push({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { costPrice } }
      }
    });
  }

  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps);
  }

  // 3. Sync costPrice to StoreInventory
  const allProds = await Product.find().select('_id costPrice priceNumber');
  const prodCostMap = new Map();
  allProds.forEach(p => prodCostMap.set(String(p._id), p.costPrice || Math.round((p.priceNumber || 0) * 0.55)));

  const storeInvs = await StoreInventory.find().select('_id productId');
  console.log(`Updating costPrice for ${storeInvs.length} StoreInventory items...`);
  
  const invBulkOps = [];
  for (const inv of storeInvs) {
    const cp = prodCostMap.get(String(inv.productId));
    if (cp) {
      invBulkOps.push({
        updateOne: {
          filter: { _id: inv._id },
          update: { $set: { costPrice: cp } }
        }
      });
    }
  }

  if (invBulkOps.length > 0) {
    await StoreInventory.bulkWrite(invBulkOps);
  }

  console.log(` Successfully updated ${products.length} products and ${invBulkOps.length} StoreInventory items with realistic costPrice!`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
