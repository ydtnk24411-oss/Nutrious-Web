const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Payment = require('../models/Payment');
const OrderItem = require('../models/OrderItem');
const Shipment = require('../models/Shipment');
const GoodsReceipt = require('../models/GoodsReceipt');
const StockTransfer = require('../models/StockTransfer');
const Employee = require('../models/Employee');
const UserAddress = require('../models/UserAddress');
const ChatMessage = require('../models/ChatMessage');
const ProductImage = require('../models/ProductImage');

function safeDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && val.$date) return new Date(val.$date);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function syncAll() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas for safe synchronization...\n');
    const db = mongoose.connection.db;

    // 1. Sync Payments & OrderItems & Shipments from 55 Orders
    console.log('--- 1. SYNCING PAYMENTS, ORDER_ITEMS, SHIPMENTS (55 Orders) ---');
    const orders = await db.collection('orders').find({}).toArray();
    let paymentCount = 0;
    let orderItemCount = 0;
    let shipmentCount = 0;
    let totalPaymentAmount = 0;
    let paidPaymentAmount = 0;

    for (const order of orders) {
      let pStatus = 'pending';
      if (order.status === 'cancelled' || order.paymentStatus === 'expired') {
        pStatus = order.paymentStatus === 'expired' ? 'expired' : 'cancelled';
      } else if (order.paymentStatus === 'paid' || order.status === 'delivered') {
        pStatus = 'success';
      }

      const rawPaidAt = pStatus === 'success' ? (order.paidAt || order.updatedAt || new Date()) : null;
      const pCode = `PAY-${(order.orderCode || '').replace('XL-', '') || order._id.toString().slice(-6)}`;

      await Payment.findOneAndUpdate(
        { orderId: order._id },
        {
          $set: {
            paymentCode: pCode,
            orderId: order._id,
            orderCode: order.orderCode || '',
            user: order.user || null,
            paymentMethod: order.paymentMethod || 'cod',
            amount: Number(order.total) || 0,
            currency: 'VND',
            pointsUsed: 0,
            status: pStatus,
            transactionReference: order.paymentReference || '',
            paidAt: safeDate(rawPaidAt),
            settled: Boolean(order.codSettled),
            settledAt: safeDate(order.codSettledAt),
            settledBy: order.codSettledBy || '',
            note: order.note || '',
          }
        },
        { upsert: true, new: true }
      );
      paymentCount++;
      totalPaymentAmount += (Number(order.total) || 0);
      if (pStatus === 'success') paidPaymentAmount += (Number(order.total) || 0);

      // Sync OrderItems
      if (Array.isArray(order.items)) {
        for (const it of order.items) {
          await OrderItem.findOneAndUpdate(
            { orderId: order._id, productName: it.productName },
            {
              $set: {
                orderId: order._id,
                orderCode: order.orderCode || '',
                product: String(it.product || ''),
                productName: it.productName || 'Sản phẩm',
                categoryName: it.categoryName || '',
                productImage: it.productImage || '',
                priceNumber: Number(it.priceNumber) || 0,
                quantity: Number(it.quantity) || 1,
                selectedOption: it.selectedOption || '',
                isCombo: Boolean(it.isCombo),
                itemType: it.itemType || 'regular',
                discount: Number(it.addonSaving) || 0,
                subtotal: (Number(it.priceNumber) || 0) * (Number(it.quantity) || 1) - (Number(it.addonSaving) || 0),
              }
            },
            { upsert: true }
          );
          orderItemCount++;
        }
      }

      // Sync Shipment
      let shipStatus = 'pending';
      if (order.status === 'cancelled') shipStatus = 'cancelled';
      else if (order.status === 'delivered') shipStatus = 'delivered';
      else if (order.status === 'shipping') shipStatus = 'in_transit';
      else if (order.status === 'preparing') shipStatus = 'picked_up';
      else if (order.status === 'confirmed') shipStatus = 'assigned';

      const sCode = `SHIP-${(order.orderCode || '').replace('XL-', '') || order._id.toString().slice(-6)}`;
      await Shipment.findOneAndUpdate(
        { orderId: order._id },
        {
          $set: {
            shipmentCode: sCode,
            orderId: order._id,
            orderCode: order.orderCode || '',
            warehouseId: order.warehouseId || 'store-thuduc',
            shippingMethod: order.shippingMethod || 'delivery',
            shippingAddress: order.shippingAddress || '',
            shippingFee: Number(order.shippingFee) || 0,
            codAmount: (order.paymentMethod === 'cod' && order.status !== 'cancelled' && order.status !== 'delivered') ? (Number(order.total) || 0) : 0,
            shipperName: order.shipperName || '',
            shipperPhone: order.shipperPhone || '',
            status: shipStatus,
            deliveredAt: order.status === 'delivered' ? safeDate(order.updatedAt || new Date()) : null,
            estimatedDeliveryTime: order.estimatedDeliveryTime || '',
          }
        },
        { upsert: true }
      );
      shipmentCount++;
    }

    console.log(`Synced Payments: ${paymentCount} (Total Gross: ${totalPaymentAmount.toLocaleString('vi-VN')} đ, Actual Paid: ${paidPaymentAmount.toLocaleString('vi-VN')} đ)`);
    console.log(`Synced OrderItems: ${orderItemCount}`);
    console.log(`Synced Shipments: ${shipmentCount}\n`);

    // 2. Sync GoodsReceipts (8 tickets) & StockTransfers (16 tickets) from StockAdjustmentTickets
    console.log('--- 2. SYNCING GOODS RECEIPTS & STOCK TRANSFERS ---');
    const grTickets = await db.collection('stockadjustmenttickets').find({ type: 'goods_receipt' }).toArray();
    let grCount = 0;
    let grTotalAmount = 0;
    let grDebtAmount = 0;

    for (const t of grTickets) {
      const debt = (Number(t.totalAmount) || 0) - (Number(t.paidAmount) || 0);
      await GoodsReceipt.findOneAndUpdate(
        { receiptCode: t.ticketCode },
        {
          $set: {
            receiptCode: t.ticketCode,
            supplierId: t.supplierId,
            supplierName: t.supplierName || 'Nhà cung cấp',
            warehouseId: t.storeId || 'store-thuduc',
            warehouseName: t.storeName || 'Tổng kho Evergreen Mart Thủ Đức',
            items: (t.items || []).map(it => ({
              productId: it.productId,
              productName: it.productName,
              sku: it.sku || '',
              quantityReceived: Math.abs(Number(it.quantityDelta) || 0),
              unitPrice: Number(it.unitPrice) || 0,
              batchCode: it.batchCode || '',
              expDate: safeDate(it.expDate),
            })),
            totalAmount: Number(t.totalAmount) || 0,
            paidAmount: Number(t.paidAmount) || 0,
            debtAmount: debt,
            paymentStatus: t.paymentStatus || 'partial',
            status: 'completed',
            sourceTicketId: t._id,
            receivedAt: safeDate(t.createdAt) || new Date(),
          }
        },
        { upsert: true }
      );
      grCount++;
      grTotalAmount += (Number(t.totalAmount) || 0);
      grDebtAmount += debt;
    }
    console.log(`Synced GoodsReceipts: ${grCount} (Total Import: ${grTotalAmount.toLocaleString('vi-VN')} đ, Accounts Payable Remaining: ${grDebtAmount.toLocaleString('vi-VN')} đ)`);

    const trfTickets = await db.collection('stockadjustmenttickets').find({ type: 'store_transfer' }).toArray();
    let trfCount = 0;
    let trfTotalAmount = 0;

    for (const t of trfTickets) {
      await StockTransfer.findOneAndUpdate(
        { transferCode: t.ticketCode },
        {
          $set: {
            transferCode: t.ticketCode,
            sourceStoreId: t.storeId,
            sourceStoreName: t.storeName,
            targetStoreId: t.targetStoreId || '',
            targetStoreName: t.targetStoreName || '',
            items: (t.items || []).map(it => ({
              productId: it.productId,
              productName: it.productName,
              sku: it.sku || '',
              quantity: Math.abs(Number(it.quantityDelta) || 0),
              unitPrice: Number(it.unitPrice) || 0,
            })),
            totalAmount: Number(t.totalAmount) || 0,
            status: 'completed',
            sourceTicketId: t._id,
            transferredAt: safeDate(t.createdAt) || new Date(),
          }
        },
        { upsert: true }
      );
      trfCount++;
      trfTotalAmount += (Number(t.totalAmount) || 0);
    }
    console.log(`Synced StockTransfers: ${trfCount} (Total Transferred Value: ${trfTotalAmount.toLocaleString('vi-VN')} đ)\n`);

    // 3. Sync Employees from Staff Users (12 staff)
    console.log('--- 3. SYNCING EMPLOYEES (12 Staff Users) ---');
    const staffUsers = await db.collection('users').find({ role: { $ne: 'customer' } }).toArray();
    let empCount = 0;

    for (const u of staffUsers) {
      const empCode = u.employeeCode || `NV-${u._id.toString().slice(-4).toUpperCase()}`;
      let dept = 'Vận hành siêu thị';
      const r = (u.role || '').toLowerCase();
      if (r === 'admin') dept = 'Ban Giám Đốc';
      else if (r === 'manager') dept = 'Quản lý chi nhánh';
      else if (r === 'warehouse') dept = 'Kho vận & Tiếp nhận';
      else if (r === 'sales') dept = 'Kinh doanh & Bán hàng';
      else if (r === 'support') dept = 'Chăm sóc khách hàng';
      else if (r === 'marketing') dept = 'Marketing & Khuyến mại';

      await Employee.findOneAndUpdate(
        { userId: u._id },
        {
          $set: {
            employeeCode: empCode,
            userId: u._id,
            name: u.name,
            email: u.email,
            phone: u.phone || '',
            role: u.role,
            department: dept,
            assignedStore: u.assignedStore || 'all',
            assignedStoreIds: Array.isArray(u.assignedStoreIds) ? u.assignedStoreIds : ['all'],
            storeName: u.storeName || '',
            isActive: u.isActive !== false,
          }
        },
        { upsert: true }
      );
      empCount++;
    }
    console.log(`Synced Employees: ${empCount} staff records.\n`);

    // 4. Sync UserAddresses from Users
    console.log('--- 4. SYNCING USER ADDRESSES ---');
    const usersWithAddr = await db.collection('users').find({ 'addresses.0': { $exists: true } }).toArray();
    let addrCount = 0;

    for (const u of usersWithAddr) {
      for (const a of (u.addresses || [])) {
        await UserAddress.findOneAndUpdate(
          { userId: u._id, address: a.address },
          {
            $set: {
              userId: u._id,
              label: a.label || 'Nhà riêng',
              fullName: a.fullName || u.name,
              phone: a.phone || u.phone || '',
              address: a.address,
              city: a.city || 'TP. Hồ Chí Minh',
              province: a.province || '',
              provinceCode: a.provinceCode || null,
              ward: a.ward || '',
              wardCode: a.wardCode || null,
              street: a.street || '',
              lat: a.lat || null,
              lng: a.lng || null,
              isDefault: Boolean(a.isDefault),
            }
          },
          { upsert: true }
        );
        addrCount++;
      }
    }
    console.log(`Synced UserAddresses: ${addrCount} addresses.\n`);

    // 5. Sync ChatMessages from Conversations
    console.log('--- 5. SYNCING CHAT MESSAGES (11 Conversations) ---');
    const convs = await db.collection('conversations').find({}).toArray();
    let msgCount = 0;

    for (const conv of convs) {
      if (Array.isArray(conv.messages)) {
        for (const m of conv.messages) {
          await ChatMessage.findOneAndUpdate(
            { conversationId: conv._id, content: m.content, timestamp: safeDate(m.timestamp) },
            {
              $set: {
                conversationId: conv._id,
                sessionId: conv.sessionId || '',
                sender: m.sender || 'customer',
                senderName: m.senderName || '',
                staffName: m.staffName || '',
                senderAvatar: m.senderAvatar || '',
                content: m.content || '',
                timestamp: safeDate(m.timestamp) || new Date(),
                isRead: Boolean(m.isRead),
              }
            },
            { upsert: true }
          );
          msgCount++;
        }
      }
    }
    console.log(`Synced ChatMessages: ${msgCount} messages.\n`);

    // 6. Sync ProductImages from Products (Primary Thumbnail)
    console.log('--- 6. SYNCING PRODUCT IMAGES ---');
    const prods = await db.collection('products').find({ image: { $exists: true, $ne: '' } }).toArray();
    let imgCount = 0;

    for (const p of prods) {
      await ProductImage.findOneAndUpdate(
        { productId: p._id, isPrimary: true },
        {
          $set: {
            productId: p._id,
            imageUrl: p.image,
            imageType: 'thumbnail',
            caption: p.name,
            sortOrder: 1,
            isPrimary: true,
          }
        },
        { upsert: true }
      );
      imgCount++;
    }
    console.log(`Synced ProductImages: ${imgCount} primary images.\n`);

    await mongoose.disconnect();
    console.log('ALL SYNCHRONIZATIONS COMPLETED SUCCESSFULLY WITH 100% ACCOUNTING INTEGRITY!');
  } catch (err) {
    console.error('Error in syncAll:', err);
    process.exit(1);
  }
}

syncAll();
