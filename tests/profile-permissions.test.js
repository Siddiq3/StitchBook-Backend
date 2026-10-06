const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const permissions = require('../src/services/permissions.service');

function loadProfile({ ownedShop = null, staff = null, missingUser = false } = {}) {
  const module = { exports: {} };
  const user = { id: 7, shop_id: 99, name: 'Owner', updated_at: 'today' };
  const mocks = {
    '../models/user.model': { getUserById: async () => missingUser ? null : user },
    '../models/shop.model': { getShopByUserId: async () => ownedShop },
    '../models/staff.model': { getStaffByUserId: async () => staff },
    './token.service': { verifyAccessToken: () => ({ userId: 7 }) },
    './permissions.service': permissions,
    '../utils/logger': { error() {} },
    bcryptjs: { hashSync: () => 'unused' },
    uuid: {},
  };
  for (const name of ['firebase', 'googleAuth', 'msg91Widget', 'session', 'passwordReset', 'tokenBlacklist']) mocks[`./${name}.service`] = {};
  mocks['../utils/phoneUtils'] = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/auth.service.js'), 'utf8'), {
    module, exports: module.exports, process,
    require(name) { assert.ok(name in mocks, `Unexpected import ${name}`); return mocks[name]; },
  });
  return module.exports;
}

test('profile promotes a completed shop owner using live ownership', async () => {
  const profile = await loadProfile({ ownedShop: { id: 12 } }).getUserProfile('token');
  assert.equal(profile.role, 'owner');
  assert.equal(profile.shopId, 12);
  assert.deepEqual(Array.from(profile.permissions), ['*']);
  assert.equal(profile.updatedAt, 'today');
});

test('profile before shop setup keeps only setup permissions', async () => {
  const profile = await loadProfile().getUserProfile('token');
  assert.equal(profile.role, 'pending_owner');
  assert.equal(profile.shopId, null);
  assert.deepEqual(Array.from(profile.permissions), ['shop:read', 'shop:write']);
});

test('staff profile stays restricted and ignores stale users.shop_id', async () => {
  const profile = await loadProfile({ staff: { id: 4, shop_id: 12, access_role: 'helper', can_login: true } }).getUserProfile('token');
  assert.equal(profile.role, 'helper');
  assert.equal(profile.shopId, 12);
  assert.equal(profile.permissions.includes('orders:read'), true);
  assert.equal(profile.permissions.includes('orders:write'), false);
  assert.equal(profile.permissions.includes('*'), false);
});

test('disabled staff cannot regain permissions from profile refresh', async () => {
  const profile = await loadProfile({ staff: { id: 4, shop_id: 12, access_role: 'manager', can_login: false } }).getUserProfile('token');
  assert.equal(profile.permissions.length, 0);
});

test('missing users still fail profile lookup', async () => {
  await assert.rejects(() => loadProfile({ missingUser: true }).getUserProfile('token'), /User not found/);
});
