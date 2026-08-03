const axios = require('axios');

// Used until the first successful live fetch, and as a permanent fallback if
// the upstream API ever becomes unreachable - currency display must never
// break just because a third-party rate provider is down.
const FALLBACK_RATE = 0.0006; // 1 NGN ≈ 0.0006 EUR

let cache = { rate: FALLBACK_RATE, updatedAt: null, source: 'fallback' };

async function refreshExchangeRate() {
  try {
    const response = await axios.get('https://open.er-api.com/v6/latest/NGN', { timeout: 8000 });
    const eurRate = response.data?.rates?.EUR;
    if (typeof eurRate === 'number' && eurRate > 0) {
      cache = { rate: eurRate, updatedAt: new Date(), source: 'live' };
      console.log(`Exchange rate refreshed: 1 NGN = ${eurRate} EUR`);
    } else {
      console.error('Exchange rate refresh returned no EUR rate, keeping last known value');
    }
  } catch (error) {
    console.error('Failed to refresh NGN/EUR exchange rate, keeping last known value:', error.message);
  }
}

function getExchangeRate() {
  return cache;
}

module.exports = { refreshExchangeRate, getExchangeRate, FALLBACK_RATE };
