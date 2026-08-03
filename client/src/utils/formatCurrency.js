// Fallback used until a live rate has been fetched from the backend, and as
// a permanent fallback if that fetch ever fails - currency display must
// never break just because the rate endpoint is unreachable.
export const NGN_TO_EUR_RATE_FALLBACK = 0.0006;

// Module-level cache for the live rate. Set by LanguageContext after it
// fetches GET /exchange-rate (which itself is backed by a server-side cache
// refreshed every 6h - see backend/src/utils/exchangeRate.js). Kept as a
// plain variable rather than component state so every existing
// formatCurrency(amount, language) call site across the app keeps working
// unchanged once the live rate arrives.
let liveRate = null;

export function setLiveExchangeRate(rate) {
  if (typeof rate === 'number' && rate > 0) liveRate = rate;
}

// amountInKobo is always the input (every stored amount is in kobo);
// language selects the display currency: 'en' -> Naira, 'de' -> Euro.
export function formatCurrency(amountInKobo = 0, language = 'en') {
  const naira = (amountInKobo || 0) / 100;
  if (language === 'de') {
    const rate = liveRate || NGN_TO_EUR_RATE_FALLBACK;
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(naira * rate);
  }
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(naira);
}
