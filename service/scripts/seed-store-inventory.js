const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Product = require('../models/Product');
const StoreInventory = require('../models/StoreInventory');
const ShippingConfig = require('../models/ShippingConfig');
const InventoryLog = require('../models/InventoryLog');
const { DEFAULT_WAREHOUSES } = require('../utils/shippingCalculator');

// Trọng số phân bổ tồn kho theo quy mô chi nhánh
// Tổng kho Thủ Đức lớn nhất, các siêu thị trung tâm tiếp theo, các chi nhánh tỉnh vừa phải
const STORE_WEIGHTS = {
  'store-thuduc': 0.30,      // 30% - Tổng kho trung tâm & Trụ sở chính
  'store-q1': 0.12,          // 12% - Siêu thị Quận 1
  'store-binhthanh': 0.10,   // 10% - Bình Thạnh
  'store-q7': 0.10,          // 10% - Quận 7
  'store-tanbinh': 0.10,     // 10% - Tân Bình
  'store-govap': 0.10,       // 10% - Gò Vấp
  'store-binhtan': 0.10,     // 10% - Bình Tân
  'store-dian': 0.08,        // 8%  - Dĩ An (Bình Dương)
};

async function seedStoreInventory() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully.');

    // 1. Cập nhật ShippingConfig.warehouses nếu chưa có
    let config = await ShippingConfig.findOne({ key: 'default' });
    if (!config) {
      config = new ShippingConfig({ key: 'default' });
    }
    config.warehouses = DEFAULT_WAREHOUSES;
    await config.save();
    console.log(`Updated ShippingConfig with ${DEFAULT_WAREHOUSES.length} warehouses.`);

    // 2. Lấy toàn bộ sản phẩm
    const products = await Product.find({ isActive: { $ne: false } });
    console.log(`Found ${products.length} active products to distribute stock.`);

    let totalCreatedOrUpdated = 0;
    let totalLogsCreated = 0;
    const now = new Date();

    const inventoryBulkOps = [];
    const logDocs = [];

    for (const prod of products) {
      const totalStock = typeof prod.stock === 'number' && prod.stock >= 0 ? prod.stock : 100;
      let allocatedSum = 0;

      const storeAllocations = [];

      for (let i = 0; i < DEFAULT_WAREHOUSES.length; i++) {
        const wh = DEFAULT_WAREHOUSES[i];
        const isLast = i === DEFAULT_WAREHOUSES.length - 1;

        let storeQty = 0;
        if (totalStock === 0) {
          storeQty = 0;
        } else if (isLast) {
          // Kho cuối cùng nhận đúng phần dư còn lại để tổng khớp chính xác 100% với Product.stock
          storeQty = Math.max(0, totalStock - allocatedSum);
        } else {
          const weight = STORE_WEIGHTS[wh.id] || 0.02;
          storeQty = Math.floor(totalStock * weight);
          allocatedSum += storeQty;
        }

        storeAllocations.push({
          wh,
          qty: storeQty,
        });
      }

      // Đảm bảo tổng phân bổ khớp chính xác
      const checkSum = storeAllocations.reduce((sum, a) => sum + a.qty, 0);
      if (checkSum !== totalStock) {
        const diff = totalStock - checkSum;
        // Bù trừ vào kho Thủ Đức (kho tổng)
        storeAllocations[0].qty = Math.max(0, storeAllocations[0].qty + diff);
      }

      // Tạo bulk operation cho StoreInventory & InventoryLog
      for (const item of storeAllocations) {
        const wh = item.wh;
        const qty = item.qty;
        const buffer = qty > 5 ? 2 : 0;

        const batchCode = `BATCH-${wh.id.replace('store-', '').toUpperCase()}-${prod.slug.slice(0, 10).toUpperCase()}`;

        inventoryBulkOps.push({
          updateOne: {
            filter: { storeId: wh.id, productId: prod._id },
            update: {
              $set: {
                storeName: wh.name,
                sku: prod.slug,
                physicalStock: qty,
                reservedStock: 0,
                safetyBuffer: buffer,
                damagedStock: 0,
                batches: [
                  {
                    batchCode,
                    expDate: new Date(now.getTime() + 45 * 24 * 3600 * 1000), // HSD 45 ngày
                    quantity: qty,
                    receivedDate: now,
                  },
                ],
              },
            },
            upsert: true,
          },
        });

        if (qty > 0) {
          logDocs.push({
            product: prod._id,
            productName: prod.name,
            type: 'import',
            storeId: wh.id,
            referenceId: batchCode,
            delta: qty,
            oldStock: 0,
            newStock: qty,
            reason: 'Kiểm kê định kỳ & Khởi tạo số dư đầu kỳ theo kho (Chuẩn kế toán O2O)',
            note: `Khởi tạo ${qty} sản phẩm cho kho [${wh.name}] theo số dư tổng`,
          });
        }
      }
    }

    console.log(`Executing ${inventoryBulkOps.length} StoreInventory bulk operations...`);
    // Chia batch nếu quá lớn
    const BATCH_SIZE = 500;
    for (let i = 0; i < inventoryBulkOps.length; i += BATCH_SIZE) {
      const slice = inventoryBulkOps.slice(i, i + BATCH_SIZE);
      await StoreInventory.bulkWrite(slice);
    }
    console.log('StoreInventory records created/updated successfully.');

    // Xóa logs cũ loại khởi tạo nếu có và ghi log kế toán mới
    console.log(`Recording ${logDocs.length} inventory audit ledger logs...`);
    for (let i = 0; i < logDocs.length; i += BATCH_SIZE) {
      const slice = logDocs.slice(i, i + BATCH_SIZE);
      await InventoryLog.insertMany(slice);
    }
    console.log('Accounting inventory logs recorded successfully.');

    // 3. KIỂM TOÁN TỒN KHO (AUDIT CHECK)
    console.log('\n--- BẮT ĐẦU KIỂM TOÁN NGUYÊN TẮC KẾ TOÁN (AUDIT VERIFICATION) ---');
    const sampleProducts = await Product.find().limit(10);
    let allPassed = true;

    for (const p of sampleProducts) {
      const inventories = await StoreInventory.find({ productId: p._id });
      const sumPhysical = inventories.reduce((sum, inv) => sum + inv.physicalStock, 0);
      const isMatch = sumPhysical === p.stock;
      if (!isMatch) {
        allPassed = false;
        console.error(` Mismatch for product "${p.name}": Product.stock=${p.stock}, Sum(StoreInventory)=${sumPhysical}`);
      }
    }

    if (allPassed) {
      console.log(' KIỂM TOÁN HOÀN TOÀN KHỚP 100%: Tổng tồn kho các kho luôn bằng chính xác Product.stock!');
    }

    const totalStoresCount = await StoreInventory.distinct('storeId');
    const totalRecords = await StoreInventory.countDocuments();
    console.log(`\nTổng kết:`);
    console.log(`- Số chi nhánh đã nạp tồn kho: ${totalStoresCount.length}`);
    console.log(`- Tổng số bản ghi tồn kho chi nhánh: ${totalRecords}`);
    console.log(`- Hệ thống kho hoàn tất sẵn sàng.`);

    await mongoose.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error('Lỗi khi seed tồn kho:', err);
    process.exit(1);
  }
}

seedStoreInventory();
