/**
 * Prove Competency 4 — the manager re-checks the work. Run: npm run verify-demo
 */
import { SQL_JOB, LANDING_JOB } from "./fixtures.js";
import { verify } from "./buyer/verify/index.js";
import type { Deliverable } from "./types.js";

const show = (label: string, d: Deliverable, jobType: "sql" | "landing") => {
  const job = jobType === "sql" ? SQL_JOB : LANDING_JOB;
  const v = verify(job, d);
  const mark = v.pass ? "✅ PASS" : "❌ FAIL";
  console.log(`${mark}  score ${v.score}/10  — ${label}`);
  console.log(`        ${v.notes}\n`);
};

console.log(`\n=== SQL verification (the query is actually executed) ===\n`);

// correct query
show("correct query", {
  jobId: SQL_JOB.id, sellerId: "PixelPro",
  content: `SELECT c.name AS name, SUM(o.amount) AS total FROM customers c JOIN orders o ON o.customer_id=c.id GROUP BY c.id ORDER BY total DESC LIMIT 3;`,
}, "sql");

// wrong query (ascending order -> wrong customers)
show("wrong query (ascending, wrong rows)", {
  jobId: SQL_JOB.id, sellerId: "CheapBot",
  content: `SELECT c.name AS name, SUM(o.amount) AS total FROM customers c JOIN orders o ON o.customer_id=c.id GROUP BY c.id ORDER BY total ASC LIMIT 3;`,
}, "sql");

// broken query (syntax error)
show("broken query (syntax error)", {
  jobId: SQL_JOB.id, sellerId: "BrokenBot",
  content: `SELECT name FRM customers`,
}, "sql");

console.log(`=== Landing-page verification (structural checks) ===\n`);

// good page
show("good landing page", {
  jobId: LANDING_JOB.id, sellerId: "PixelPro",
  content: `<!doctype html><html><head><style>body{background:#111;color:#fff}</style></head>
    <body><h1>Bean Machine</h1><p>tagline</p>
    <section class="feature">Feature 1</section><section class="feature">Feature 2</section><section class="feature">Feature 3</section>
    <form><input type="email" placeholder="your email"/></form></body></html>`,
}, "landing");

// bad page (light theme, missing signup, only 1 feature)
show("bad landing page (missing requirements)", {
  jobId: LANDING_JOB.id, sellerId: "LazyBot",
  content: `<!doctype html><html><body style="background:#fff"><h2>Coffee</h2><div class="feature">only one</div></body></html>`,
}, "landing");
