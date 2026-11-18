const mongoose = require('mongoose');
require('dotenv').config({ path: 'service/.env' });

async function fullAudit() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection;

  console.log('=== COMPREHENSIVE AUDIT REPORT ===');

  // 1. Orders
  const orders = await db.collection('orders').find({}).toArray();
  console.log(`1. Total Orders: ${orders.length} (Expected: 49)`);

  const soldMap = new Map();
  orders.forEach(o => {
    if (o.status !== 'cancelled') {
      (o.items || []).forEach(it => {
        const pid = it.product ? it.product.toString() : '';
        if (pid) soldMap.set(pid, (soldMap.get(pid) || 0) + (it.quantity || 1));
      });
    }
  });

  // 2. Tickets
  const tickets = await db.collection('stockadjustmenttickets').find({}).toArray();
  console.log(`2. Total Adjustment Tickets: ${tickets.length} (Expected: 9 - 8 GRN + 1 Spoilage)`);

  let ticketSumValid = true;
  const inboundMap = new Map();
  const spoiledMap = new Map();

  tickets.forEach(t => {
    let itemSum = 0;
    t.items.forEach(it => {
      const lineVal = Math.abs(it.quantityDelta) * it.unitPrice;
      itemSum += lineVal;
      const pid = it.productId.toString();
      if (t.type === 'goods_receipt') {
        inboundMap.set(pid, (inboundMap.get(pid) || 0) + it.quantityDelta);
      } else if (t.type === 'spoilage_writeoff') {
        spoiledMap.set(pid, (spoiledMap.get(pid) || 0) + Math.abs(it.quantityDelta));
      }
    });

    if (t.type === 'goods_receipt' && t.totalAmount !== itemSum) {
      ticketSumValid = false;
      console.error(`Ticket ${t.ticketCode} sum mismatch: totalAmount=${t.totalAmount}, itemSum=${itemSum}`);
    } else if (t.type === 'spoilage_writeoff' && t.totalLossValue !== itemSum) {
      ticketSumValid = false;
      console.error(`Ticket ${t.ticketCode} loss mismatch: totalLossValue=${t.totalLossValue}, itemSum=${itemSum}`);
    }
  });
  console.log(`   Tickets Total == Sum(Items): ${ticketSumValid ? 'PASSED (100% exact)' : 'FAILED'}`);

  // 3. Products Audit
  const products = await db.collection('products').find({}).toArray();
  console.log(`3. Total Products: ${products.length} (Expected: 437)`);

  let balancePassed = 0;
  let pricePassed = 0;

  products.forEach(p => {
    const pid = p._id.toString();
    const inbound = inboundMap.get(pid) || 0;
    const sold = soldMap.get(pid) || 0;
    const spoiled = spoiledMap.get(pid) || 0;
    const stock = p.stock;

    // Check balance: Inbound = Stock + Sold + Spoiled
    if (inbound === stock + sold + spoiled) {
      balancePassed++;
    } else {
      console.error(`Product ${p.name} (${pid}) imbalance: Inbound(${inbound}) != Stock(${stock}) + Sold(${sold}) + Spoiled(${spoiled})`);
    }

    // Check price: CostPrice <= Price
    if (p.costPrice <= (p.priceNumber || p.price)) {
      pricePassed++;
    } else {
      console.error(`Product ${p.name} costPrice (${p.costPrice}) > price (${p.priceNumber})`);
    }
  });

  console.log(`   Balance Inbound == Stock + Sold + Spoiled: ${balancePassed}/${products.length} (${(balancePassed/products.length*100).toFixed(1)}%)`);
  console.log(`   CostPrice <= SellingPrice: ${pricePassed}/${products.length} (${(pricePassed/products.length*100).toFixed(1)}%)`);

  // 4. Store Inventory Sum
  const storeAgg = await db.collection('storeinventories').aggregate([
    { $group: { _id: '$productId', totalPhysical: { $sum: '$physicalStock' } } }
  ]).toArray();

  let storeSumPassed = 0;
  const prodMap = new Map();
  products.forEach(p => prodMap.set(p._id.toString(), p.stock));

  storeAgg.forEach(row => {
    const pStock = prodMap.get(row._id.toString());
    if (pStock === row.totalPhysical) {
      storeSumPassed++;
    }
  });
  console.log(`4. Sum(StoreInventory) == Product.stock: ${storeSumPassed}/${products.length} (${(storeSumPassed/products.length*100).toFixed(1)}%)`);

  // 5. Suppliers Audit
  const suppliers = await db.collection('suppliers').find({}).toArray();
  console.log(`5. Suppliers Count: ${suppliers.length}`);
  suppliers.forEach(s => {
    const debtCalc = s.totalInboundAmount - s.totalPaidAmount;
    const isDebtValid = s.remainingDebt === debtCalc;
    console.log(`   [${s.code}] ${s.name}: Inbound=${s.totalInboundAmount.toLocaleString('vi-VN')}d, Paid=${s.totalPaidAmount.toLocaleString('vi-VN')}d, Debt=${s.remainingDebt.toLocaleString('vi-VN')}d -> ${isDebtValid ? 'VALID' : 'INVALID'}`);
  });

  // 6. Inventory Logs
  const logCount = await db.collection('inventorylogs').countDocuments();
  console.log(`6. Total Inventory Logs: ${logCount}`);

  await mongoose.disconnect();
}

fullAudit().catch(console.error);
