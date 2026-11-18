const mongoose = require('mongoose');
require('dotenv').config({ path: 'service/.env' });
const Product = require('../models/Product');
const StoreInventory = require('../models/StoreInventory');

async function syncOrder485454() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // 1. Combo 27
  const combo27 = await Product.findOne({ name: /Combo Rau củ tiết kiệm 27/i });
  if (combo27) {
    console.log(`Before: Combo 27 Product stock = ${combo27.stock}`);
    await Product.findByIdAndUpdate(combo27._id, { $inc: { stock: -1, reservedStock: 1 } });
    
    const inv = await StoreInventory.findOne({ storeId: 'store-thuduc', productId: combo27._id });
    console.log(`Before: Combo 27 StoreInventory (store-thuduc) physicalStock = ${inv?.physicalStock}`);
    await StoreInventory.findOneAndUpdate(
      { storeId: 'store-thuduc', productId: combo27._id },
      { $inc: { physicalStock: -1, reservedStock: 1 } }
    );
  }

  // 2. Ingredients physicalStock deduction at store-thuduc
  const pids = [
    '65d10a5ac00d767135ebb810', // Cải Mèo Tươi
    '6ae990177d1e8c533e5975f6', // Cải Thìa Baby
    '65d10a5ac00d767135ebb805'  // Bắp Cải Trắng
  ];
  for (const pid of pids) {
    const inv = await StoreInventory.findOneAndUpdate(
      { storeId: 'store-thuduc', productId: pid },
      { $inc: { physicalStock: -1 } },
      { new: true }
    );
    console.log(`Ingredient ${pid} new physicalStock: ${inv?.physicalStock}`);
  }

  // Check new state
  const updatedInv = await StoreInventory.findOne({ storeId: 'store-thuduc', productId: combo27._id }).lean();
  console.log(`After: Combo 27 StoreInventory (store-thuduc) physicalStock = ${updatedInv?.physicalStock}, reservedStock = ${updatedInv?.reservedStock}`);

  await mongoose.disconnect();
  process.exit(0);
}
syncOrder485454();
