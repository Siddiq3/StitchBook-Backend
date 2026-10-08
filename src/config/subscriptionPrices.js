// Prices are rupees. One JSON value publishes the three prices atomically.
const DEFAULT_PRICES = Object.freeze({ basic: 299, team: 399, pro: 599 });
function parsePrices(raw) {
  if (raw === undefined) return { ...DEFAULT_PRICES };
  let prices;
  try { prices = JSON.parse(raw); } catch { throw new Error('SUBSCRIPTION_PRICES_JSON must be valid JSON'); }
  if (!prices || Array.isArray(prices) || typeof prices !== 'object' ||
      Object.keys(prices).sort().join(',') !== 'basic,pro,team') {
    throw new Error('SUBSCRIPTION_PRICES_JSON must contain exactly basic, team and pro');
  }
  for (const [key, amount] of Object.entries(prices)) {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1 || amount > 100000 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
      throw new Error(`Invalid ${key} price: use 1–100000 rupees with at most two decimal places`);
    }
  }
  return prices;
}
module.exports = { parsePrices, DEFAULT_PRICES };
