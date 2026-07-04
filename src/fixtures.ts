/**
 * Sample jobs used to drive the buyer agent before real sellers exist.
 * These are the two "hero demo" jobs: one landing page, one SQL query.
 */
import type { JobSpec, Offer } from "./types.js";

/** Landing-page job — the visual demo. */
export const LANDING_JOB: JobSpec = {
  id: "job-landing-1",
  type: "landing",
  task: "Build a single-file landing page for a coffee brand, 'Bean Machine'.",
  requirements: [
    "Dark theme",
    "Hero section with brand name and tagline",
    "Exactly 3 feature cards",
    "Email signup form",
    "Single self-contained HTML file (inline CSS)",
  ],
  budget: 500,
  priorities: { quality: 50, speed: 30, price: 20 },
};

/** SQL job — the objectively-verifiable demo (the query actually runs). */
export const SQL_JOB: JobSpec = {
  id: "job-sql-1",
  type: "sql",
  task: "Write a query returning the top 3 customers by total spend.",
  requirements: [
    "Return exactly 3 rows",
    "Columns: name, total",
    "Ordered by total spend descending",
  ],
  budget: 300,
  priorities: { quality: 40, speed: 20, price: 40 },
  sqlContext: {
    schema: `
      CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, amount REAL);
    `,
    seedRows: `
      INSERT INTO customers (id, name) VALUES (1,'Ava'),(2,'Ben'),(3,'Cara'),(4,'Dan');
      INSERT INTO orders (id, customer_id, amount) VALUES
        (1,1,120.0),(2,1,80.0),(3,2,300.0),(4,3,50.0),(5,3,50.0),(6,4,500.0),(7,1,200.0);
    `,
    // Expected result: Dan 500, Ava 400, Ben 300
    expectation: "top 3 customers by total spend, columns: name, total, ordered desc",
    solution: `
      SELECT c.name AS name, SUM(o.amount) AS total
      FROM customers c JOIN orders o ON o.customer_id = c.id
      GROUP BY c.id
      ORDER BY total DESC
      LIMIT 3;
    `,
  },
};

/** Data job — the nested-payment demo (seller buys data on-chain, then sells the report). */
export const DATA_JOB: JobSpec = {
  id: "job-data-1",
  type: "data",
  task: "Deliver a live BTC/USD price report with a one-line market summary.",
  requirements: [
    "Include the current BTC/USD price as a number",
    "Include a one-line market summary",
    "Cite the data source",
  ],
  budget: 200,
  priorities: { quality: 45, speed: 35, price: 20 },
  dataContext: { topic: "BTC/USD spot price", mustCite: true },
};

/** Fake offers so the buyer's scoring + negotiation can be tested with no real sellers. */
export const FAKE_OFFERS: Offer[] = [
  { sellerId: "PixelPro",  jobId: "job-landing-1", price: 480, deliveryEst: 1, pitch: "Clean, mobile-responsive, my specialty." },
  { sellerId: "CheapBot",  jobId: "job-landing-1", price: 300, deliveryEst: 4, pitch: "Cheapest price you'll get." },
  { sellerId: "PremiumCo", jobId: "job-landing-1", price: 510, deliveryEst: 2, pitch: "Premium design, 2-year support." },
];
