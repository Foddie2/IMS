#!/usr/bin/env node
/**
 * End-to-end integration check of a RUNNING IMS API (in-memory demo or Supabase PostgreSQL).
 *
 *   npm run test:smoke                         # http://localhost:5000
 *   node backend/tests/smoke/api-smoke.mjs http://localhost:5000
 *
 * Exercises every endpoint and role with the seeded demo accounts. It creates a SMOKE-* product,
 * moves stock (inbound, outbound, transfer, adjustment), creates a Draft purchase order, then
 * zeroes the stock and soft-deletes the product. Audit entries are kept (by design).
 */
const BASE = (process.argv[2] ?? process.env.IMS_API ?? 'http://localhost:5000').replace(/\/+$/, '');
const API = `${BASE}/api`;
const ACCOUNTS = {
  SuperAdmin: ['admin@ims.com', 'Admin123!'],
  Admin: ['manager@ims.com', 'Manager123!'],
  User: ['operator@ims.com', 'Operator123!'],
};

let passed = 0;
let failed = 0;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const section = (title) => console.log(`\n\x1b[1m${title}\x1b[0m`);
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? green('✔') : red('✘')} ${name}${!ok && detail ? `  — ${detail}` : ''}`);
  return ok;
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}
const brief = (r) => `HTTP ${r.status} ${typeof r.body === 'object' ? JSON.stringify(r.body).slice(0, 160) : String(r.body).slice(0, 160)}`;

const stamp = Date.now().toString(36).toUpperCase();
const sku = `SMOKE-${stamp}`;

try {
  // ------------------------------------------------------------------ 1. health
  section(`1. Health  (${BASE})`);
  const health = await call('GET', `${BASE}/health`);
  if (!check('GET /health is Healthy (API up, database reachable)', health.status === 200, brief(health))) {
    throw new Error('API not healthy – is it running? Is the database reachable?');
  }

  // ------------------------------------------------------------------ 2. auth
  section('2. Authentication');
  const tokens = {};
  const users = {};
  for (const [role, [email, password]] of Object.entries(ACCOUNTS)) {
    const r = await call('POST', '/auth/login', { body: { email, password } });
    if (check(`login ${role} (${email})`, r.status === 200 && r.body?.user?.role === role, brief(r))) {
      tokens[role] = r.body.accessToken;
      users[role] = r.body.user;
    }
  }
  if (!tokens.SuperAdmin || !tokens.Admin || !tokens.User) throw new Error('Demo logins missing – was the database seeded?');
  const bad = await call('POST', '/auth/login', { body: { email: ACCOUNTS.Admin[0], password: 'wrong-password' } });
  check('wrong password → 401', bad.status === 401, brief(bad));
  const me = await call('GET', '/auth/me', { token: tokens.User });
  check('GET /auth/me returns the profile', me.status === 200 && me.body.email === ACCOUNTS.User[0], brief(me));
  check('GET /auth/me without token → 401', (await call('GET', '/auth/me')).status === 401);

  // ------------------------------------------------------------------ 3. RBAC
  section('3. Role-based access');
  for (const path of ['/products', '/inventory', '/warehouses', '/reports/inventory-summary', '/stock-movements']) {
    check(`anonymous ${path} → 401`, (await call('GET', path)).status === 401);
  }
  check('User cannot create products → 403',
    (await call('POST', '/products', { token: tokens.User, body: { sku: 'X', name: 'X', unitPrice: 1, units: 'pcs', minimumStock: 0 } })).status === 403);
  check('User cannot read purchase orders → 403', (await call('GET', '/purchase-orders', { token: tokens.User })).status === 403);
  check('User cannot read audit logs → 403', (await call('GET', '/audit-logs', { token: tokens.User })).status === 403);
  check('Admin cannot manage users → 403', (await call('GET', '/users', { token: tokens.Admin })).status === 403);

  // ------------------------------------------------------------------ 4. reference data
  section('4. Reference data');
  const categories = await call('GET', '/categories', { token: tokens.Admin });
  check('GET /categories', categories.status === 200 && categories.body.length > 0, brief(categories));
  const warehouses = await call('GET', '/warehouses', { token: tokens.Admin });
  check('GET /warehouses (Admin sees all)', warehouses.status === 200 && warehouses.body.length >= 2, brief(warehouses));
  const userWarehouses = await call('GET', '/warehouses', { token: tokens.User });
  const assigned = users.User.assignedWarehouseIds;
  check('GET /warehouses (User sees only assigned)',
    userWarehouses.status === 200 && userWarehouses.body.every((w) => assigned.includes(w.id)) && userWarehouses.body.length === assigned.length,
    brief(userWarehouses));
  const suppliers = await call('GET', '/suppliers', { token: tokens.Admin });
  check('GET /suppliers', suppliers.status === 200 && suppliers.body.length > 0, brief(suppliers));

  const [whA, whB] = userWarehouses.body; // both accessible to the User role
  const foreign = warehouses.body.find((w) => !assigned.includes(w.id));

  // ------------------------------------------------------------------ 5. products
  section('5. Products');
  const list = await call('GET', '/products', { token: tokens.Admin });
  check('GET /products', list.status === 200 && list.body.length > 0, brief(list));
  const search = await call('GET', '/products?search=cable', { token: tokens.Admin });
  check('GET /products?search=cable filters by name/SKU',
    search.status === 200 && search.body.every((p) => /cable/i.test(p.name) || /cable/i.test(p.sku)), brief(search));
  const out = await call('GET', '/products?stockStatus=OutOfStock', { token: tokens.Admin });
  check('GET /products?stockStatus=OutOfStock', out.status === 200 && out.body.every((p) => p.stockStatus === 'OutOfStock'), brief(out));
  check('User sees no unit cost', (await call('GET', '/products', { token: tokens.User })).body.every((p) => p.unitPrice === null));

  const payload = { sku, name: `Smoke Test Item ${stamp}`, description: 'Created by api-smoke.mjs', categoryId: categories.body[0].id,
    unitPrice: 12.5, units: 'pcs', minimumStock: 10, barcode: null, imageUrl: null };
  const created = await call('POST', '/products', { token: tokens.Admin, body: payload });
  check('POST /products (Admin) → 201', created.status === 201 && created.body.sku === sku, brief(created));
  const productId = created.body?.id;
  check('duplicate SKU → 409', (await call('POST', '/products', { token: tokens.Admin, body: payload })).status === 409);
  check('invalid product → 400',
    (await call('POST', '/products', { token: tokens.Admin, body: { ...payload, sku: 'bad sku!', unitPrice: -1 } })).status === 400);
  const updated = await call('PUT', `/products/${productId}`, { token: tokens.Admin, body: { ...payload, name: `${payload.name} (edited)`, minimumStock: 8 } });
  check('PUT /products/{id} (Admin)', updated.status === 200 && updated.body.minimumStock === 8, brief(updated));
  const got = await call('GET', `/products/${productId}`, { token: tokens.User });
  check('GET /products/{id}', got.status === 200 && got.body.name.endsWith('(edited)'), brief(got));
  check('Admin cannot delete → 403', (await call('DELETE', `/products/${productId}`, { token: tokens.Admin })).status === 403);

  // ------------------------------------------------------------------ 6. stock movements (transactional)
  section('6. Stock movements (transactions)');
  const move = (token, body) => call('POST', '/stock-movements', { token, body: { destinationWarehouseId: null, notes: null, ...body } });
  const qtyAt = async (warehouseId) => {
    const r = await call('GET', `/inventory?search=${encodeURIComponent(sku)}`, { token: tokens.Admin });
    return r.body?.[0]?.warehouses.find((w) => w.warehouseId === warehouseId)?.quantity ?? 0;
  };

  const inbound = await move(tokens.User, { productId, warehouseId: whA.id, type: 'Inbound', quantity: 20, referenceNumber: `GRN-${stamp}` });
  check('Inbound +20 (User, assigned warehouse) → 201', inbound.status === 201 && inbound.body.updatedStock[0].quantity === 20, brief(inbound));
  const outbound = await move(tokens.User, { productId, warehouseId: whA.id, type: 'Outbound', quantity: 5, referenceNumber: `SO-${stamp}` });
  check('Outbound −5 → stock 15', outbound.status === 201 && outbound.body.updatedStock[0].quantity === 15, brief(outbound));
  const tooMany = await move(tokens.User, { productId, warehouseId: whA.id, type: 'Outbound', quantity: 999, referenceNumber: null });
  check('Outbound beyond stock → 409 Insufficient stock', tooMany.status === 409 && tooMany.body?.available === 15, brief(tooMany));
  check('…and stock is unchanged (rolled back)', (await qtyAt(whA.id)) === 15);
  const transfer = await move(tokens.User, { productId, warehouseId: whA.id, type: 'Transfer', quantity: 5, destinationWarehouseId: whB.id, referenceNumber: `TR-${stamp}` });
  check('Transfer 5 between warehouses (two legs)',
    transfer.status === 201 && transfer.body.movements.length === 2 && (await qtyAt(whA.id)) === 10 && (await qtyAt(whB.id)) === 5, brief(transfer));
  const adjust = await move(tokens.User, { productId, warehouseId: whB.id, type: 'Adjustment', quantity: -2, referenceNumber: `ADJ-${stamp}` });
  check('Adjustment −2', adjust.status === 201 && (await qtyAt(whB.id)) === 3, brief(adjust));
  check('invalid movement (zero quantity) → 400',
    (await move(tokens.User, { productId, warehouseId: whA.id, type: 'Inbound', quantity: 0, referenceNumber: null })).status === 400);
  if (foreign) {
    check('User in unassigned warehouse → 403',
      (await move(tokens.User, { productId, warehouseId: foreign.id, type: 'Inbound', quantity: 1, referenceNumber: null })).status === 403);
  }
  const history = await call('GET', `/stock-movements?productId=${productId}&take=20`, { token: tokens.User });
  check('GET /stock-movements lists the 5 movement rows', history.status === 200 && history.body.length === 5, brief(history));

  // ------------------------------------------------------------------ 7. inventory
  section('7. Inventory');
  const inventory = await call('GET', '/inventory', { token: tokens.Admin });
  const mine = inventory.body?.find((i) => i.productId === productId);
  check('GET /inventory aggregates per warehouse', inventory.status === 200 && mine?.totalQuantity === 13, brief(inventory));
  const scoped = await call('GET', `/inventory?warehouseId=${whA.id}`, { token: tokens.Admin });
  check('GET /inventory?warehouseId narrows to one warehouse',
    scoped.status === 200 && scoped.body.every((i) => i.warehouses.every((w) => w.warehouseId === whA.id)), brief(scoped));
  const low = await call('GET', '/inventory/low-stock', { token: tokens.Admin });
  check('GET /inventory/low-stock', low.status === 200 && low.body.every((i) => i.stockStatus !== 'InStock'), brief(low));

  // ------------------------------------------------------------------ 8. purchase orders
  section('8. Purchase orders');
  const po = await call('POST', '/purchase-orders', { token: tokens.Admin, body: {
    supplierId: suppliers.body[0].id, warehouseId: whA.id, status: 'Draft',
    items: [{ productId, quantity: 10, unitCost: 11 }] } });
  check('POST /purchase-orders (Admin, Draft) → 201', po.status === 201 && po.body.totalAmount === 110, brief(po));
  const pos = await call('GET', '/purchase-orders', { token: tokens.Admin });
  check('GET /purchase-orders includes it', pos.status === 200 && pos.body.some((o) => o.id === po.body?.id), brief(pos));
  check('User cannot create purchase orders → 403',
    (await call('POST', '/purchase-orders', { token: tokens.User, body: { supplierId: 1, warehouseId: whA.id, items: [{ productId, quantity: 1, unitCost: 1 }] } })).status === 403);

  // ------------------------------------------------------------------ 9. reports
  section('9. Reports');
  const summary = await call('GET', '/reports/inventory-summary', { token: tokens.Admin });
  check('GET /reports/inventory-summary (Admin, with stock value)',
    summary.status === 200 && summary.body.totalStockValue !== null && summary.body.recentActivity.length > 0, brief(summary));
  const userSummary = await call('GET', '/reports/inventory-summary', { token: tokens.User });
  check('…User gets no stock value', userSummary.status === 200 && userSummary.body.totalStockValue === null, brief(userSummary));
  const flow = await call('GET', '/reports/stock-flow?months=12', { token: tokens.Admin });
  const total = inventory.body.reduce((s, i) => s + i.totalQuantity, 0);
  check('GET /reports/stock-flow → 12 months ending at current stock',
    flow.status === 200 && flow.body.length === 12 && flow.body.at(-1).closingStock === total, brief(flow));
  const audit = await call('GET', '/audit-logs?take=200', { token: tokens.Admin });
  const auditFor = (action) => audit.body?.some((a) => a.action === action && (a.details ?? '').includes(sku));
  check('GET /audit-logs records product + movement actions',
    audit.status === 200 && auditFor('Create') && auditFor('StockMovement.Transfer') && auditFor('StockMovement.Outbound'), brief(audit));

  // ------------------------------------------------------------------ 10. users
  section('10. User management');
  const userList = await call('GET', '/users', { token: tokens.SuperAdmin });
  check('GET /users (SuperAdmin)', userList.status === 200 && userList.body.length >= 3, brief(userList));
  const superAdmins = userList.body?.filter((u) => u.role === 'SuperAdmin' && u.isActive) ?? [];
  if (superAdmins.length === 1) {
    // Only safe to probe when the API must refuse – never demote a real SuperAdmin.
    const self = superAdmins[0];
    const demote = await call('PUT', `/users/${self.id}`, { token: tokens.SuperAdmin,
      body: { fullName: self.fullName, role: 'Admin', assignedWarehouseIds: [], isActive: true } });
    check('last SuperAdmin cannot be demoted → 409', demote.status === 409, brief(demote));
  } else {
    console.log(`  – skipped "last SuperAdmin" probe (${superAdmins.length} SuperAdmins; demoting one would change real data)`);
  }

  // ------------------------------------------------------------------ 11. cleanup
  section('11. Cleanup');
  for (const wh of [whA, whB]) {
    const q = await qtyAt(wh.id);
    if (q > 0) await move(tokens.Admin, { productId, warehouseId: wh.id, type: 'Adjustment', quantity: -q, referenceNumber: `SMOKE-CLEANUP` });
  }
  check('smoke stock zeroed', (await qtyAt(whA.id)) === 0 && (await qtyAt(whB.id)) === 0);
  const del = await call('DELETE', `/products/${productId}`, { token: tokens.SuperAdmin });
  check('DELETE /products/{id} (SuperAdmin, soft delete) → 204', del.status === 204, brief(del));
  check('deleted product → 404', (await call('GET', `/products/${productId}`, { token: tokens.Admin })).status === 404);
} catch (error) {
  failed++;
  console.log(red(`\n  ✘ Aborted: ${error.message}`));
}

console.log(`\n${failed ? red(`${failed} failed`) : green('all passed')} · ${passed} passed · ${BASE}`);
process.exit(failed ? 1 : 0);
