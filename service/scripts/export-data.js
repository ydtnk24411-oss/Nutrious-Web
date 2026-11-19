/**
 * Xuất toàn bộ dữ liệu các collection từ MongoDB ra file nén EJSON:
 *   service/data/xanh-la-snapshot.json.gz
 *
 * Chạy: cd service && npm run export-data
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { EJSON } = require('bson');

const OUT_PATH = path.join(__dirname, '..', 'data', 'xanh-la-snapshot.json.gz');

async function exportSnapshot() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xanh-la';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000 });

  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  const snapshot = {};

  for (const colInfo of cols) {
    if (colInfo.name.startsWith('system.')) continue;
    snapshot[colInfo.name] = await db.collection(colInfo.name).find({}).toArray();
  }

  const ejsonString = EJSON.stringify(snapshot, { relaxed: false });
  const compressed = zlib.gzipSync(Buffer.from(ejsonString, 'utf8'), { level: 9 });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, compressed);

  const totalDocs = Object.values(snapshot).reduce((sum, list) => sum + list.length, 0);
  console.log(
    `[OK] Exported ${Object.keys(snapshot).length} collections (${totalDocs} docs) -> ${OUT_PATH} (${(
      compressed.length /
      1024 /
      1024
    ).toFixed(2)} MB)`
  );

  await mongoose.disconnect();
}

exportSnapshot().catch(async (err) => {
  console.error('[ERROR] Export failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

