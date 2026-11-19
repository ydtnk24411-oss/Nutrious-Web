const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cats = await Category.find({}).sort({ order: 1, createdAt: 1 });
  console.log(`Found ${cats.length} categories:`);
  for (const c of cats) {
    const isBase64 = c.image && c.image.startsWith('data:');
    console.log(`- ID: ${c._id}, Name: "${c.name}", Slug: "${c.slug}", Image Type: ${isBase64 ? 'BASE64 (' + c.image.slice(0, 30) + '... length ' + c.image.length + ')' : c.image}`);
  }
  await mongoose.disconnect();
}

run().catch(console.error);

