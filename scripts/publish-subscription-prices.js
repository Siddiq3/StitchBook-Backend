// Run only from the manually dispatched main-branch workflow.
const { parsePrices } = require('../src/config/subscriptionPrices');
async function publish({ env = process.env, request = fetch } = {}) {
  const keys = ['BASIC_PLAN_PRICE', 'TEAM_PLAN_PRICE', 'PRO_PLAN_PRICE'];
  if (keys.some(key => !/^\d+(\.\d{1,2})?$/.test(env[key] || ''))) {
    throw new Error('Set BASIC_PLAN_PRICE, TEAM_PLAN_PRICE and PRO_PLAN_PRICE to numeric rupee amounts');
  }
  const value = JSON.stringify(parsePrices(JSON.stringify({ basic: Number(env.BASIC_PLAN_PRICE), team: Number(env.TEAM_PLAN_PRICE), pro: Number(env.PRO_PLAN_PRICE) })));
  if (!env.RENDER_API_KEY || !/^srv-[a-zA-Z0-9]+$/.test(env.RENDER_SERVICE_ID || '')) {
    throw new Error('Set the RENDER_API_KEY secret and RENDER_SERVICE_ID variable');
  }
  const base = `https://api.render.com/v1/services/${env.RENDER_SERVICE_ID}`;
  const headers = { Authorization: `Bearer ${env.RENDER_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' };
  // Update ONE key; never use Render's replace-all-environment endpoint.
  const update = await request(`${base}/env-vars/SUBSCRIPTION_PRICES_JSON`, { method: 'PUT', headers, body: JSON.stringify({ value }) });
  if (!update.ok) throw new Error(`Price update failed (HTTP ${update.status}); no deploy requested`);
  const deploy = await request(`${base}/deploys`, { method: 'POST', headers, body: JSON.stringify({ clearCache: 'do_not_clear' }) });
  if (!deploy.ok) throw new Error(`Prices saved but deployment failed (HTTP ${deploy.status}). Re-run this workflow or deploy from Render.`);
  const result = await deploy.json();
  return { prices: JSON.parse(value), deployId: result.id };
}
if (require.main === module) {
  publish().then(result => {
    console.log(`Saved prices: ${JSON.stringify(result.prices)}. Render deployment requested: ${result.deployId || 'see Render dashboard'}. Prices go live only after successful deployment.`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { publish };
