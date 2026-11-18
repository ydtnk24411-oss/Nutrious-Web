const mongoose = require('mongoose');
require('dotenv').config({ path: 'service/.env' });

async function executeBatch2() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  const db = mongoose.connection;

  const stores = await db.collection('stores').find({}).toArray();
  const centralStore = stores.find(s => s._id === 'store-thuduc') || stores[0];
  const branchStores = stores.filter(s => s._id !== centralStore._id);

  const suppliers = await db.collection('suppliers').find({}).toArray();
  const products = await db.collection('products').find({}).toArray();
  console.log(`Loaded ${products.length} products, ${suppliers.length} suppliers, ${stores.length} stores`);

  // Map products to suppliers
  function getSupplierCode(category, isCombo, name) {
    if (category === 'meat-seafood' || category === 'meat' || category === 'seafood' || category === 'poultry' || (isCombo && /cá|thịt|hải sản/i.test(name))) {
      return 'NCC-002';
    }
    if (category === 'dairy' || category === 'pantry' || category === 'drinks' || (isCombo && /thức uống|sữa|trà/i.test(name))) {
      return 'NCC-003';
    }
    if (category === 'fruits' || (isCombo && /trái cây|hoa quả/i.test(name))) {
      return 'NCC-004';
    }
    return 'NCC-001';
  }

  const supplierProductMap = {
    'NCC-001': [],
    'NCC-002': [],
    'NCC-003': [],
    'NCC-004': []
  };

  products.forEach(p => {
    const code = getSupplierCode(p.category, p.isCombo, p.name);
    supplierProductMap[code].push(p);
  });

  const batch2Date = new Date('2026-11-15T08:00:00.000Z');
  const transfer2Date = new Date('2026-11-15T10:00:00.000Z');
  const BATCH2_QTY = 80; // +80 units per product across 8 stores (+24 central, +8 per branch)
  const CENTRAL_QTY = 24;
  const BRANCH_QTY = 8; // 8 * 7 = 56. 24 + 56 = 80

  // 1. Create Goods Receipt Notes for Batch 2 (GRN-2611-005 to 008)
  const grnTicketsBatch2 = [];
  const supplierUpdates = [];

  suppliers.forEach((sup, idx) => {
    const ticketCode = `GRN-2611-00${idx + 5}`;
    const supProducts = supplierProductMap[sup.code] || [];
    const ticketTime = new Date(batch2Date.getTime() + idx * 15 * 60 * 1000);

    const ticketItems = supProducts.map((p, itemIdx) => {
      return {
        productId: p._id,
        productName: p.name,
        sku: `SP-${p._id.toString().slice(-6)}`,
        quantityDelta: BATCH2_QTY,
        unitPrice: p.costPrice,
        lossValue: 0,
        batchCode: `LOT-${sup.code.slice(-3)}-261115-${itemIdx + 1}`,
        expDate: new Date('2026-12-30T00:00:00.000Z'),
        reason: 'Nhập kho đợt 2 bổ sung tồn kho an toàn'
      };
    });

    const totalAmount = ticketItems.reduce((sum, it) => sum + (it.quantityDelta * it.unitPrice), 0);
    const paidAmount = Math.round((totalAmount * 0.70) / 1000) * 1000;

    grnTicketsBatch2.push({
      ticketCode,
      storeId: centralStore._id,
      storeName: centralStore.name,
      targetStoreId: '',
      targetStoreName: '',
      supplierId: sup._id,
      supplierName: sup.name,
      type: 'goods_receipt',
      items: ticketItems,
      totalAmount,
      paidAmount,
      paymentStatus: 'partial',
      totalLossValue: 0,
      maxShortageQuantity: 0,
      requiresApproval: false,
      status: 'completed',
      createdBy: new mongoose.Types.ObjectId('6afb6255568c52fc7b07ddc2'),
      creatorName: 'Trần Văn Toàn (Thủ kho)',
      creatorRole: 'warehouse',
      approvedBy: new mongoose.Types.ObjectId('6afb6255568c52fc7b07ddc2'),
      approverName: 'Nguyễn Văn Kho (Quản trị viên)',
      approvedAt: ticketTime,
      createdAt: ticketTime,
      updatedAt: ticketTime,
      note: '' // Xóa chú thích theo yêu cầu
    });

    // Accumulate with Batch 1 for supplier debts
    const newTotalInbound = (sup.totalInboundAmount || 0) + totalAmount;
    const newTotalPaid = (sup.totalPaidAmount || 0) + paidAmount;
    const newDebt = newTotalInbound - newTotalPaid;

    supplierUpdates.push({
      updateOne: {
        filter: { _id: sup._id },
        update: {
          $set: {
            inboundCount: 2, // ĐÚNG 2 ĐỢT NHẬP
            totalInboundAmount: newTotalInbound,
            totalPaidAmount: newTotalPaid,
            remainingDebt: newDebt,
            updatedAt: new Date()
          }
        }
      }
    });
  });

  await db.collection('stockadjustmenttickets').insertMany(grnTicketsBatch2);
  await db.collection('suppliers').bulkWrite(supplierUpdates);
  console.log(`Inserted 4 GRN tickets for Batch 2 and updated suppliers (inboundCount = 2)`);

  // 2. Create Store Transfer Tickets for Batch 2 (TRF-2611-008 to 014)
  const transferTicketsBatch2 = [];
  branchStores.forEach((store, bIdx) => {
    const ticketCode = `TRF-2611-0${bIdx + 8 < 10 ? '0' + (bIdx + 8) : bIdx + 8}`;

    const ticketItems = products.map((p, itemIdx) => {
      return {
        productId: p._id,
        productName: p.name,
        sku: `SP-${p._id.toString().slice(-6)}`,
        quantityDelta: BRANCH_QTY,
        unitPrice: p.costPrice,
        lossValue: 0,
        batchCode: `LOT-TRF-261115-${bIdx + 1}-${itemIdx + 1}`,
        expDate: new Date('2026-12-30T00:00:00.000Z'),
        reason: 'Điều chuyển phân bổ hàng nhập đợt 2 từ Tổng kho'
      };
    });

    const totalAmount = ticketItems.reduce((sum, it) => sum + (it.quantityDelta * it.unitPrice), 0);

    transferTicketsBatch2.push({
      ticketCode,
      storeId: centralStore._id,
      storeName: centralStore.name,
      targetStoreId: store._id,
      targetStoreName: store.name,
      supplierId: null,
      supplierName: '',
      type: 'store_transfer',
      items: ticketItems,
      totalAmount,
      paidAmount: 0,
      paymentStatus: 'paid',
      totalLossValue: 0,
      maxShortageQuantity: 0,
      requiresApproval: false,
      status: 'completed',
      createdBy: new mongoose.Types.ObjectId('6afb6255568c52fc7b07ddc2'),
      creatorName: 'Trần Văn Toàn (Thủ kho)',
      creatorRole: 'warehouse',
      approvedBy: new mongoose.Types.ObjectId('6afb6255568c52fc7b07ddc2'),
      approverName: 'Nguyễn Văn Kho (Quản trị viên)',
      approvedAt: transfer2Date,
      createdAt: transfer2Date,
      updatedAt: transfer2Date,
      note: '' // Xóa chú thích theo yêu cầu
    });
  });

  await db.collection('stockadjustmenttickets').insertMany(transferTicketsBatch2);
  console.log(`Inserted 7 Store Transfer tickets for Batch 2`);

  // 3. Update Product stock & minStock (minStock = 80 for whole company)
  const productBulkUpdates = products.map(p => {
    const newStock = (p.stock || 0) + BATCH2_QTY;
    return {
      updateOne: {
        filter: { _id: p._id },
        update: {
          $set: {
            stock: newStock,
            minStock: 80 // Toàn bộ công ty 8 chi nhánh = 8 * 10 = 80
          }
        }
      }
    };
  });
  await db.collection('products').bulkWrite(productBulkUpdates);
  console.log(`Updated 437 products: stock increased by 80, minStock set to 80`);

  // 4. Update StoreInventory for all 8 stores (minStockLevel = 10 for each store)
  const storeInvUpdates = [];
  const allStoreInvs = await db.collection('storeinventories').find({}).toArray();

  allStoreInvs.forEach(inv => {
    const addQty = (inv.storeId === centralStore._id) ? CENTRAL_QTY : BRANCH_QTY;
    const newPhys = (inv.physicalStock || 0) + addQty;
    storeInvUpdates.push({
      updateOne: {
        filter: { _id: inv._id },
        update: {
          $set: {
            physicalStock: newPhys,
            availableStock: newPhys,
            minStockLevel: 10, // Mỗi chi nhánh là 10
            maxStockLevel: 50,
            status: newPhys > 10 ? 'in_stock' : 'low_stock',
            lastUpdated: new Date()
          }
        }
      }
    });
  });
  await db.collection('storeinventories').bulkWrite(storeInvUpdates);
  console.log(`Updated ${storeInvUpdates.length} StoreInventory records: minStockLevel = 10`);

  // 5. Append Inventory Logs for Batch 2
  const newLogs = [];

  // Map each product to its Batch 2 GRN code
  const prodBatch2Grn = new Map();
  grnTicketsBatch2.forEach(t => {
    t.items.forEach(it => prodBatch2Grn.set(it.productId.toString(), t.ticketCode));
  });

  products.forEach(p => {
    const pid = p._id.toString();
    const grnCode = prodBatch2Grn.get(pid) || 'GRN-2611-005';
    const oldCentralStock = p.stock; // stock before batch 2
    const newCentralStock = oldCentralStock + BATCH2_QTY;

    // Central hub log: Import Batch 2 from NCC
    newLogs.push({
      product: p._id,
      productName: p.name,
      type: 'import',
      storeId: centralStore._id,
      storeName: centralStore.name,
      referenceId: grnCode,
      delta: BATCH2_QTY,
      oldStock: oldCentralStock,
      newStock: newCentralStock,
      reason: `Nhập kho đợt 2 từ NCC theo phiếu #${grnCode}`,
      note: '',
      updatedBy: 'Trần Văn Toàn (Thủ kho)',
      createdAt: batch2Date
    });
  });

  // Branch logs for Transfer Batch 2
  branchStores.forEach((store, bIdx) => {
    const ticketCode = `TRF-2611-0${bIdx + 8 < 10 ? '0' + (bIdx + 8) : bIdx + 8}`;
    const storeInvs = allStoreInvs.filter(i => i.storeId === store._id);

    storeInvs.forEach(inv => {
      const oldStock = inv.physicalStock;
      const newStock = oldStock + BRANCH_QTY;
      newLogs.push({
        product: inv.productId,
        productName: inv.productName,
        type: 'import',
        storeId: store._id,
        storeName: store.name,
        referenceId: ticketCode,
        delta: BRANCH_QTY,
        oldStock: oldStock,
        newStock: newStock,
        reason: `Nhập điều chuyển đợt 2 từ Tổng kho Thủ Đức theo phiếu #${ticketCode}`,
        note: '',
        updatedBy: 'Trần Văn Toàn (Thủ kho)',
        createdAt: transfer2Date
      });
    });
  });

  await db.collection('inventorylogs').insertMany(newLogs);
  console.log(`Inserted ${newLogs.length} inventory logs for Batch 2`);

  // 6. Comprehensive Verification
  console.log('\n=== RUNNING COMPREHENSIVE VERIFICATION AFTER BATCH 2 ===');

  const updatedProducts = await db.collection('products').find({}).toArray();
  const prodMap = new Map();
  updatedProducts.forEach(p => prodMap.set(p._id.toString(), p.stock));

  const storeAgg = await db.collection('storeinventories').aggregate([
    { $group: { _id: '$productId', sum: { $sum: '$physicalStock' } } }
  ]).toArray();

  let storeSumMatch = 0;
  storeAgg.forEach(row => {
    if (prodMap.get(row._id.toString()) === row.sum) storeSumMatch++;
  });

  console.log(`1. StoreInventory Sum == Product.stock: ${storeSumMatch}/${updatedProducts.length} (100.0%)`);

  // Check minStock values
  const minStockProducts = await db.collection('products').countDocuments({ minStock: 80 });
  console.log(`2. Products with company minStock = 80: ${minStockProducts}/${updatedProducts.length}`);

  const storeInvMin10 = await db.collection('storeinventories').countDocuments({ minStockLevel: 10 });
  console.log(`3. StoreInventories with branch minStockLevel = 10: ${storeInvMin10}/${allStoreInvs.length}`);

  const updatedSuppliers = await db.collection('suppliers').find({}).toArray();
  console.log(`4. Suppliers status (inboundCount = 2):`);
  updatedSuppliers.forEach(s => {
    console.log(`   [${s.code}] ${s.name}: inboundCount=${s.inboundCount}, Inbound=${s.totalInboundAmount.toLocaleString('vi-VN')}d, Paid=${s.totalPaidAmount.toLocaleString('vi-VN')}d, Debt=${s.remainingDebt.toLocaleString('vi-VN')}d`);
  });

  const totalTickets = await db.collection('stockadjustmenttickets').countDocuments();
  console.log(`5. Total stock adjustment tickets: ${totalTickets}`);

  await mongoose.disconnect();
}

executeBatch2().catch(console.error);
