const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Store = require('../models/Store');
const { DEFAULT_WAREHOUSES } = require('../utils/shippingCalculator');

async function seedStores() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected.');

    const ops = DEFAULT_WAREHOUSES.map((wh) => {
      const code = `BHX-${wh.id.replace('store-', '').toUpperCase()}`;
      return {
        updateOne: {
          filter: { _id: wh.id },
          update: {
            $set: {
              code,
              name: wh.name,
              address: wh.address,
              province: wh.province || '',
              district: wh.district || '',
              phone: wh.phone || '',
              location: {
                type: 'Point',
                coordinates: [wh.lng, wh.lat],
              },
              deliveryRadiusMeters: wh.isHeadquarter ? 10000 : 5000,
              maxActiveOrders: wh.isHeadquarter ? 80 : 35,
              currentActiveOrders: Math.floor(Math.random() * 8) + 2,
              operatingHours: { open: '06:30', close: '21:30' },
              isAcceptingOnlineOrders: true,
              isHeadquarter: !!wh.isHeadquarter,
            },
          },
          upsert: true,
        },
      };
    });

    console.log(`Writing ${ops.length} stores to Stores collection...`);
    await Store.bulkWrite(ops);
    console.log('Stores collection seeded successfully with 2dsphere index.');

    const count = await Store.countDocuments();
    console.log(`Total stores in DB: ${count}`);

    await mongoose.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error('Error seeding stores:', err);
    process.exit(1);
  }
}

seedStores();
