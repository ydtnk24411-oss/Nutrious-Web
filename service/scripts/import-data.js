/**
 * Nạp toàn bộ dữ liệu mẫu từ service/data/xanh-la-snapshot.json.gz vào MongoDB.
 * Mặc định chỉ nạp vào MongoDB local để tránh ghi đè nhầm dữ liệu Atlas.
 *
 * Chạy:
 *   cd service && npm run import-data
 * Hoặc ép trỏ vào MongoDB local (bỏ qua MONGODB_URI trong .env):
 *   cd service && npm run import-data -- --local
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { EJSON } = require('bson');

const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'xanh-la-snapshot.json.gz');
const LOCAL_URI = 'mongodb://127.0.0.1:27017/xanh-la';
const BATCH_SIZE = 500;

async function importSnapshot() {
  const args = process.argv.slice(2);
  const useLocalFlag = args.includes('--local');
  const forceRemote = args.includes('--force-remote');
  const targetUri = useLocalFlag ? LOCAL_URI : process.env.MONGODB_URI || LOCAL_URI;

  const isLocalUri = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/i.test(targetUri);
  if (!isLocalUri && !forceRemote) {
    console.error(
      '[ABORT] MONGODB_URI dang tro den MongoDB tu xa (Atlas), huy import de bao ve du lieu.'
    );
    console.error(
      'Neu muon nap vao MongoDB local, chay: npm run import-data -- --local'
    );
    process.exit(1);
  }

  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(`[ERROR] Khong tim thay file snapshot tai: ${SNAPSHOT_PATH}`);
    process.exit(1);
  }

  console.log('[1/3] Dang giai nen du lieu snapshot...');
  const rawJson = zlib.gunzipSync(fs.readFileSync(SNAPSHOT_PATH)).toString('utf8');
  const snapshot = EJSON.parse(rawJson);
  const entries = Object.entries(snapshot);

  console.log(`[2/3] Dang ket noi MongoDB (${isLocalUri ? targetUri : 'remote'})...`);
  await mongoose.connect(targetUri, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;

  console.log(`[3/3] Dang nap ${entries.length} collections...`);
  let totalInserted = 0;

  for (const [colName, docs] of entries) {
    if (!Array.isArray(docs)) continue;
    const col = db.collection(colName);
    await col.deleteMany({});

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      await col.insertMany(chunk, { ordered: false });
    }
    totalInserted += docs.length;
    console.log(`  - ${colName}: ${docs.length} docs`);
  }

  console.log(`[OK] Da nap xong ${totalInserted} ban ghi vao ${entries.length} collections.`);
  await mongoose.disconnect();
}

importSnapshot().catch(async (err) => {
  console.error('[ERROR] Import failed:', err.message);
  console.error('Kiem tra MongoDB Community Server da duoc khoi dong o cong 27017 chua.');
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

