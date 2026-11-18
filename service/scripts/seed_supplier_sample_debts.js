require('dotenv').config({ path: 'service/.env' });
const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const StockAdjustmentTicket = require('../models/StockAdjustmentTicket');
const Product = require('../models/Product');
const User = require('../models/User');

async function seedDebts() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const adminUser = await User.findOne({ role: { $in: ['admin', 'manager', 'warehouse'] } });
  const createdBy = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

  const suppliers = await Supplier.find({ isActive: true });
  if (suppliers.length === 0) {
    console.log('No suppliers found');
    process.exit(0);
  }

  const existingTickets = await StockAdjustmentTicket.countDocuments({ type: 'goods_receipt' });
  if (existingTickets > 0) {
    console.log(`Already have ${existingTickets} GRN tickets.`);
    process.exit(0);
  }

  const prods = await Product.find({ isActive: { $ne: false }, isCombo: { $ne: true } }).limit(10);

  const sampleBatches = [
    {
      code: 'NCC-DALAT',
      orders: [
        { total: 32500000, paid: 20000000, status: 'partial', daysAgo: 5 },
        { total: 18200000, paid: 18200000, status: 'paid', daysAgo: 14 },
      ]
    },
    {
      code: 'NCC-CUCHI',
      orders: [
        { total: 14600000, paid: 14600000, status: 'paid', daysAgo: 3 },
        { total: 8500000, paid: 5000000, status: 'partial', daysAgo: 8 },
      ]
    },
    {
      code: 'NCC-MOCCHAU',
      orders: [
        { total: 45000000, paid: 0, status: 'unpaid', daysAgo: 2 },
        { total: 28000000, paid: 28000000, status: 'paid', daysAgo: 20 },
      ]
    },
    {
      code: 'NCC-DONGTHAP',
      orders: [
        { total: 22000000, paid: 22000000, status: 'paid', daysAgo: 10 },
      ]
    }
  ];

  for (const b of sampleBatches) {
    const sup = suppliers.find(s => s.code === b.code);
    if (!sup) continue;

    for (let idx = 0; idx < b.orders.length; idx++) {
      const o = b.orders[idx];
      const ticketCode = `GRN-${sup.code.replace('NCC-', '')}-${1000 + idx}`;
      const createdAt = new Date(Date.now() - o.daysAgo * 86400000);

      await StockAdjustmentTicket.create({
        ticketCode,
        storeId: 'store-thuduc',
        storeName: 'Tổng kho Evergreen Mart Thủ Đức',
        supplierId: sup._id,
        supplierName: sup.name,
        type: 'goods_receipt',
        totalAmount: o.total,
        paidAmount: o.paid,
        paymentStatus: o.status,
        status: 'completed',
        items: prods.slice(0, 3).map((p, i) => ({
          productId: p._id,
          productName: p.name,
          quantityDelta: 100 * (i + 1),
          unitPrice: p.costPrice || 25000,
          batchCode: `LOT-${sup.code}-${20261100 + i}`,
          expDate: new Date(Date.now() + 14 * 86400000),
          reason: 'Nhập hàng định kỳ từ nông trại đối tác',
        })),
        totalLossValue: 0,
        maxShortageQuantity: 0,
        requiresApproval: false,
        createdBy,
        creatorName: 'Trần Quản Lý (CHT Thủ Đức)',
        creatorRole: 'Store Manager',
        note: `Nhập đợt nông sản chính vụ theo hợp đồng cung ứng Evergreen Mart`,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  console.log('Seeded sample GRN tickets for supplier debts!');
  process.exit(0);
}

seedDebts();
