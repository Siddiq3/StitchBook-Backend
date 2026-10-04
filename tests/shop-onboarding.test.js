const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const responder = require('../src/utils/responder');

function load(file, imports) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module,
    exports: module.exports,
    require(name) {
      assert.ok(name in imports, `Unexpected import ${name}`);
      return imports[name];
    },
  });
  return module.exports;
}

function shopController(getShopByUserId) {
  const logger = { info() {}, error() {} };
  const service = load('services/shop.service.js', {
    '../models/shop.model': { getShopByUserId },
    '../utils/logger': logger,
  });
  return load('controllers/shop.controller.js', {
    '../services/shop.service': service,
    '../services/authorization.service': {},
    '../utils/responder': responder,
    '../utils/logger': logger,
  });
}

async function getShop(controller) {
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
  await controller.getShop({ user: { id: 7 } }, res);
  return res;
}

test('new owner without a shop receives the onboarding error code', async () => {
  const res = await getShop(shopController(async userId => {
    assert.equal(userId, 7);
    return null;
  }));
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, 'Shop not found');
  assert.equal(res.body.error.code, 'SHOP_NOT_FOUND');
});

test('existing owner receives their shop', async () => {
  const shop = { id: 3, user_id: 7, name: 'My shop' };
  const res = await getShop(shopController(async () => shop));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data, shop);
});

test('database failure does not masquerade as a missing shop', async () => {
  const res = await getShop(shopController(async () => {
    throw new Error('private database details');
  }));
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, 'Failed to load shop');
  assert.equal(res.body.error, null);
});
