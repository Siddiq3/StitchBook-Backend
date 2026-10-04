const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePrices } = require('../src/config/subscriptionPrices');
const { publish } = require('../scripts/publish-subscription-prices');

test('prices default only when absent and validate the entire configured price set', () => {
  assert.deepEqual(parsePrices(), { basic:299, team:399, pro:599 });
  assert.deepEqual(parsePrices('{"basic":249.5,"team":449,"pro":699}'), { basic:249.5, team:449, pro:699 });
  for (const raw of ['', 'null', '{}', '{"basic":0,"team":399,"pro":599}', '{"basic":299,"team":-2,"pro":599}', '{"basic":"299","team":399,"pro":599}', '{"basic":1.001,"team":399,"pro":599}', '{"basic":299,"team":399,"pro":599,"annual":999}']) {
    assert.throws(() => parsePrices(raw));
  }
});
const env = { BASIC_PLAN_PRICE:'249.50', TEAM_PLAN_PRICE:'449', PRO_PLAN_PRICE:'699', RENDER_SERVICE_ID:'srv-test', RENDER_API_KEY:'test-only' };
test('GitHub publisher updates only the pricing key then requests a deployment', async () => {
  const calls=[];
  await publish({env,request:async(url,options)=>{calls.push({url,...options});return {ok:true,json:async()=>({id:'dep-test'})};}});
  assert.equal(calls.length,2);
  assert.match(calls[0].url,/\/env-vars\/SUBSCRIPTION_PRICES_JSON$/);
  assert.deepEqual(JSON.parse(JSON.parse(calls[0].body).value),{basic:249.5,team:449,pro:699});
  assert.match(calls[1].url,/\/deploys$/);
});
test('publisher refuses bad values before any API writes and does not deploy after failed update', async () => {
  let count=0;
  const request=async()=>{count++;return {ok:false,status:403};};
  await assert.rejects(publish({env:{...env,BASIC_PLAN_PRICE:'0'},request}));
  assert.equal(count,0);
  await assert.rejects(publish({env,request}),/no deploy requested/);
  assert.equal(count,1);
});
