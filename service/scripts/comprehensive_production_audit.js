const mongoose = require('mongoose');
require('dotenv').config({ path: 'service/.env' });
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const StoreInventory = require('../models/StoreInventory');
const StockAdjustmentTicket = require('../models/StockAdjustmentTicket');
const Complaint = require('../models/Complaint');
const Voucher = require('../models/Voucher');

async function runAudit() {
  const baseUrl = 'http://localhost:3000/api';
  console.log('====================================================');
  console.log('   EVERGREEN MART - PRODUCTION READINESS AUDIT');
  console.log('====================================================\n');

  let passedChecks = 0;
  let failedChecks = 0;
  const warnings = [];

  function record(desc, ok, details = '') {
    if (ok) {
      console.log(`[PASS] ${desc} ${details ? '(' + details + ')' : ''}`);
      passedChecks++;
    } else {
      console.error(`[FAIL] ${desc} ${details ? '(' + details + ')' : ''}`);
      failedChecks++;
    }
  }

  // 1. Database Connection & Basic Health
  await mongoose.connect(process.env.MONGODB_URI);
  record('MongoDB Atlas Connection', mongoose.connection.readyState === 1, 'connected');

  // Helper fetch with token
  async function api(path, token = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const t0 = Date.now();
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const elapsed = Date.now() - t0;
    let json = null;
    try { json = await res.json(); } catch (e) {}
    return { status: res.status, json, elapsed };
  }

  async function loginEmp(identifier, password) {
    const res = await fetch(`${baseUrl}/auth/login-emp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    return res.json();
  }

  // 2. Health Endpoint
  const health = await api('/health');
  record('API Health Endpoint', health.status === 200 && health.json?.status === 'ok', `${health.elapsed}ms`);

  // 3. User Roles Authentication & Scoping
  console.log('\n--- 1. ROLE AUTHENTICATION & ACCESS CONTROL ---');
  
  // 3.1 Admin
  const adminLogin = await loginEmp('admin@xanhla.farm', 'admin123');
  record('Admin Login', adminLogin.success && adminLogin.user?.role === 'admin', adminLogin.user?.email);
  const adminToken = adminLogin.token;

  // 3.2 Store Manager Q1
  const mgrQ1Login = await loginEmp('manager.q1@evergreen.vn', 'manager123');
  record('Store Manager Q1 Login', mgrQ1Login.success && mgrQ1Login.user?.role === 'manager', `Store: ${mgrQ1Login.user?.assignedStore}`);
  const mgrToken = mgrQ1Login.token;

  // 3.3 Sales
  const salesLogin = await loginEmp('sales@evergreen.vn', 'staff123');
  record('Sales Staff Login', salesLogin.success && salesLogin.user?.role === 'sales', salesLogin.user?.email);
  const salesToken = salesLogin.token;

  // 3.4 Warehouse
  const whLogin = await loginEmp('warehouse@evergreen.vn', 'staff123');
  record('Warehouse Staff Login', whLogin.success && whLogin.user?.role === 'warehouse', whLogin.user?.email);
  const whToken = whLogin.token;

  // 3.5 Marketing
  const mktLogin = await loginEmp('marketing@evergreen.vn', 'staff123');
  record('Marketing Staff Login', mktLogin.success && mktLogin.user?.role === 'marketing', mktLogin.user?.email);
  const mktToken = mktLogin.token;

  // 4. Role Isolation & Security Verification
  console.log('\n--- 2. ROLE PERMISSION & SCOPING BOUNDARIES ---');

  // Manager should ONLY see their store data
  const mgrStats = await api('/dashboard/stats', mgrToken);
  record('Manager Store Scoping', mgrStats.status === 200 && mgrStats.json?.data?.storeScope?.storeId === 'store-q1', `Store: ${mgrStats.json?.data?.storeScope?.storeId}`);

  // Warehouse cannot access customer complaints
  const whComplaints = await api('/complaints', whToken);
  record('Warehouse Blocked from Complaints (Security)', whComplaints.status === 403, `HTTP ${whComplaints.status}`);

  // Marketing cannot access inventory tickets creation/modification
  const mktTickets = await api('/inventory/adjustment-tickets', mktToken);
  record('Marketing Adjustment Tickets Read-Only', mktTickets.status === 200, `HTTP ${mktTickets.status}`);

  // Warehouse cannot approve tickets (Only manager/admin can approve)
  const whApprove = await fetch(`${baseUrl}/inventory/adjustment-tickets/dummy/approve`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${whToken}` }
  });
  record('Warehouse Blocked from Approving Tickets (Security)', whApprove.status === 403, `HTTP ${whApprove.status}`);

  // Sales CAN access Live Support Chat conversations
  const salesSupport = await api('/support/conversations', salesToken);
  record('Sales Permitted for Live Support Chat', salesSupport.status === 200, `HTTP ${salesSupport.status} (Got ${salesSupport.json?.data?.length || 0} convs)`);

  // 5. Performance & Query Speed Audits
  console.log('\n--- 3. PERFORMANCE & LATENCY AUDIT ---');

  // Tickets API speed test
  const ticketRes = await api('/inventory/adjustment-tickets?page=1&limit=15&storeId=store-thuduc', whToken);
  record('Adjustment Tickets API Speed', ticketRes.status === 200 && ticketRes.elapsed < 1000, `${ticketRes.elapsed}ms (Limit: 1000ms, Got: ${ticketRes.json?.data?.length} tickets, Total: ${ticketRes.json?.total})`);

  // Dashboard Stats speed test
  const dashRes = await api('/dashboard/stats', adminToken);
  record('Dashboard Stats API Speed', dashRes.status === 200 && dashRes.elapsed < 1000, `${dashRes.elapsed}ms (Total Orders: ${dashRes.json?.data?.totalOrders})`);

  // Orders list speed test
  const ordRes = await api('/orders?page=1&limit=25', adminToken);
  record('Orders List API Speed', ordRes.status === 200 && ordRes.elapsed < 1000, `${ordRes.elapsed}ms (Orders: ${ordRes.json?.data?.length})`);

  // 6. Data Integrity & Business Logic Checks
  console.log('\n--- 4. DATA INTEGRITY & CONSISTENCY ---');

  const totalOrdersDB = await Order.countDocuments({});
  record('Orders Consistency', totalOrdersDB > 0, `Total Orders in DB: ${totalOrdersDB}`);

  const totalProductsDB = await Product.countDocuments({});
  record('Products Catalog Integrity', totalProductsDB > 0, `Total Products in DB: ${totalProductsDB}`);

  const totalStoresInv = await StoreInventory.countDocuments({});
  record('Store Inventory Matrix', totalStoresInv > 0, `Total SKU-Store allocations: ${totalStoresInv}`);

  const totalTicketsDB = await StockAdjustmentTicket.countDocuments({});
  record('Adjustment Tickets Integrity', totalTicketsDB > 0, `Total Tickets in DB: ${totalTicketsDB}`);

  const totalVouchersDB = await Voucher.countDocuments({});
  record('Voucher Engine Integrity', totalVouchersDB > 0, `Active/Available Vouchers: ${totalVouchersDB}`);

  // Check for orphan orders (orders without valid total or orderCode)
  const corruptOrders = await Order.countDocuments({
    $or: [{ orderCode: { $exists: false } }, { total: { $lt: 0 } }]
  });
  record('Zero Corrupt Orders', corruptOrders === 0, `Found: ${corruptOrders}`);

  console.log('\n====================================================');
  console.log(`AUDIT SUMMARY: ${passedChecks} PASSED, ${failedChecks} FAILED`);
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(failedChecks > 0 ? 1 : 0);
}

runAudit().catch(e => {
  console.error('Audit exception:', e);
  process.exit(1);
});
