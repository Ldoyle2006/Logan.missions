import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Local, private snapshots for the free database; never write these to public/.
process.loadEnvFile();
if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL first.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  const result = await pool.query("SELECT mode, data, updated_at FROM school_fundraising_ledger ORDER BY mode");
  if (!result.rows.length) throw new Error("No ledger records found; no backup was created.");
  const createdAt = new Date().toISOString();
  const directory = ".local/ledger-backups";
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = `${directory}/${createdAt.replace(/[:.]/g, "-")}-${randomUUID()}.json`;
  await writeFile(path, JSON.stringify({ format: "logan-school-ledger-v1", createdAt, ledgers: result.rows }, null, 2),
    { flag: "wx", mode: 0o600 });
  console.log(`Private ledger snapshot saved to ${path}. Keep a secure copy outside this computer.`);
} finally { await pool.end(); }
