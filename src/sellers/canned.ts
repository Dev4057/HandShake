/**
 * Canned deliverables — the deterministic fallbacks. Real seller agents generate
 * work with AI and fall back to these if AI is off or self-verification fails
 * twice. Mock sellers use them directly.
 */
export const GOOD_SQL = `SELECT c.name AS name, SUM(o.amount) AS total FROM customers c JOIN orders o ON o.customer_id=c.id GROUP BY c.id ORDER BY total DESC LIMIT 3;`;

export const BAD_SQL = `SELECT c.name AS name, SUM(o.amount) AS total FROM customers c JOIN orders o ON o.customer_id=c.id GROUP BY c.id ORDER BY total ASC LIMIT 3;`;

export const GOOD_LANDING = `<!doctype html><html><head><title>Bean Machine</title><style>body{background:#111;color:#fff;font-family:sans-serif;margin:0}header{padding:4rem 2rem;text-align:center}.features{display:flex;gap:1rem;justify-content:center;padding:2rem}.feature{background:#1c1c1f;border-radius:12px;padding:1.5rem;max-width:200px}form{text-align:center;padding:2rem}input{padding:.6rem;border-radius:8px;border:1px solid #333;background:#19191c;color:#fff}button{padding:.6rem 1rem;border-radius:8px;border:0;background:#836ef9;color:#fff;margin-left:.5rem}</style></head><body><header><h1>Bean Machine</h1><p>Coffee that codes with you.</p></header><section class="features"><div class="feature">Single-origin beans</div><div class="feature">48-hour fresh roast</div><div class="feature">Free shipping</div></section><form><input type="email" placeholder="your email"/><button>Sign up</button></form></body></html>`;

export const BAD_LANDING = `<!doctype html><html><body style="background:#fff"><h2>Coffee</h2><div class="feature">only one</div></body></html>`;

export const CANNED_REPORT = `MARKET DATA REPORT — BTC/USD spot price
Source: Handshake DataOracle (on-chain, receipt pending)
Price: $97,420.00
Summary: Bitcoin trades near recent highs; 24h range tight, volatility subdued.`;
