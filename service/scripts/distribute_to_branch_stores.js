const mongoose = require('mongoose');
require('dotenv').config({ path: 'service/.env' });

async function distributeBranchStores() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  const db = mongoose.connection;

  // 1. Clear any note in existing tickets (Xóa chú thích)
  await db.collection('stockadjustmenttickets').updateMany({}, {
    $set: { note: '' }
  });
  console.log('Cleared note on all existing tickets');

  // Remove any previously created TRF tickets so we can rebuild cleanly
  await db.collection('stockadjustmenttickets').deleteMany({ type: 'store_transfer' });

  const stores = await db.collection('stores').find({}).toArray();
  const centralStore = stores.find(s => s._id === 'store-thuduc') || stores[0];
  const branchStores = stores.filter(s => s._id !== centralStore._id);

  console.log(`Central store: ${centralStore.name}`);
  console.log(`Branch stores count: ${branchStores.length}`);

  // Fetch all StoreInventory to get exact allocated quantities for each branch store
  const storeInventories = await db.collection('storeinventories').find({}).toArray();
  const invByStore = new Map();
  storeInventories.forEach(inv => {
    if (!invByStore.has(inv.storeId)) invByStore.set(inv.storeId, []);
    invByStore.get(inv.storeId).push(inv);
  });

  const transferDate = new Date('2026-11-01T10:00:00.000Z');
  const ticketsToInsert = [];
  const branchLogsToInsert = [];

  branchStores.forEach((store, bIdx) => {
    const ticketCode = `TRF-2611-00${bIdx + 1}`;
    const storeItems = invByStore.get(store._id) || [];

    const ticketItems = storeItems.map((inv, itemIdx) => {
      return {
        productId: inv.productId,
        productName: inv.productName,
        sku: `SP-${inv.productId.toString().slice(-6)}`,
        quantityDelta: inv.physicalStock,
        unitPrice: inv.costPrice,
        lossValue: 0,
        batchCode: `LOT-TRF-261101-${bIdx + 1}-${itemIdx + 1}`,
        expDate: new Date('2026-12-15T00:00:00.000Z'),
        reason: 'Điều chuyển phân bổ tồn kho ban đầu từ Tổng kho'
      };
    });

    const totalAmount = ticketItems.reduce((sum, it) => sum + (it.quantityDelta * it.unitPrice), 0);

    ticketsToInsert.push({
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
      approvedAt: transferDate,
      createdAt: transferDate,
      updatedAt: transferDate,
      note: '' // Xóa chú thích theo yêu cầu
    });

    // Create branch inventory log entries for each item
    storeItems.forEach(inv => {
      branchLogsToInsert.push({
        product: inv.productId,
        productName: inv.productName,
        type: 'import',
        storeId: store._id,
        storeName: store.name,
        referenceId: ticketCode,
        delta: inv.physicalStock,
        oldStock: 0,
        newStock: inv.physicalStock,
        reason: `Nhập điều chuyển từ Tổng kho Thủ Đức theo phiếu #${ticketCode}`,
        note: '',
        updatedBy: 'Trần Văn Toàn (Thủ kho)',
        createdAt: transferDate
      });
    });
  });

  await db.collection('stockadjustmenttickets').insertMany(ticketsToInsert);
  console.log(`Inserted ${ticketsToInsert.length} store_transfer tickets for all 7 branch stores`);

  // Insert branch inventory logs
  await db.collection('inventorylogs').insertMany(branchLogsToInsert);
  console.log(`Inserted ${branchLogsToInsert.length} branch inventory logs`);

  // Verification
  console.log('\n--- VERIFYING TICKETS PER STORE ---');
  for (const s of stores) {
    const storeTickets = await db.collection('stockadjustmenttickets').find({
      $or: [{ storeId: s._id }, { targetStoreId: s._id }]
    }).toArray();
    console.log(`Store [${s._id}] ${s.name}: ${storeTickets.length} tickets`);
    storeTickets.forEach(t => console.log(`   #${t.ticketCode} (${t.type}): ${t.storeName} -> ${t.targetStoreName || 'Nội bộ'} [note: "${t.note}"]`));
  }

  await mongoose.disconnect();
}

distributeBranchStores().catch(console.error);
