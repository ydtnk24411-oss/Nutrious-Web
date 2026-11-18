require('dotenv').config({ path: 'service/.env' });
const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const Order = require('../models/Order');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Find sample orders for different stores
  const orderThuduc = await Order.findOne({ warehouseId: 'store-thuduc' });
  const orderQ1 = await Order.findOne({ warehouseId: 'store-q1' });
  const orderBinhthanh = await Order.findOne({ warehouseId: 'store-binhthanh' });
  const orderQ7 = await Order.findOne({ warehouseId: 'store-q7' });

  console.log({
    thuduc: orderThuduc?._id,
    q1: orderQ1?._id,
    binhthanh: orderBinhthanh?._id,
    q7: orderQ7?._id,
  });

  // Assign warehouseId and orders to complaints
  await Complaint.findOneAndUpdate(
    { complaintCode: 'KN-32310' },
    { warehouseId: 'store-thuduc', order: orderThuduc?._id }
  );

  await Complaint.findOneAndUpdate(
    { complaintCode: 'KN-70520' },
    { warehouseId: 'store-q1', order: orderQ1?._id }
  );

  await Complaint.findOneAndUpdate(
    { complaintCode: 'KN-50801' },
    { warehouseId: 'store-binhthanh', order: orderBinhthanh?._id }
  );

  await Complaint.findOneAndUpdate(
    { complaintCode: 'KN-2401' },
    { warehouseId: 'store-thuduc' }
  );

  await Complaint.findOneAndUpdate(
    { complaintCode: 'KN-2402' },
    { warehouseId: 'store-q7', order: orderQ7?._id }
  );

  await Complaint.findOneAndUpdate(
    { complaintCode: 'KN-2403' },
    { warehouseId: 'store-tanbinh' }
  );

  console.log('Updated complaints with store scoping');
  const all = await Complaint.find().select('complaintCode title warehouseId order');
  console.log(all);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
