import pg from "pg";

export const SCHOOL_DEFAULTS = [
  { id: "bcc", name: "Bible Core Course on Location", date: "September 2027", goalCents: 830000 },
  { id: "word_by_heart", name: "Word by Heart", date: "Date TBD", goalCents: 500000 },
  { id: "sbs", name: "School of Biblical Studies", date: "Date TBD", goalCents: 1000000 },
];

export function initialLedger() {
  return { version: 1, schools: SCHOOL_DEFAULTS.map(s => ({ ...s, startingKnown: false })),
    checkouts: {}, donations: {}, notifications: {}, operations: {}, audit: [] };
}

// One locked JSONB ledger per mode is deliberately simple for this small site.
// Every financial mutation is atomic across records, audit entries and the outbox.
// PostgreSQL (not the web host's filesystem) owns durability and concurrent locking.
export class SchoolStore {
  constructor(connectionString, mode = "test", pool = null) {
    this.mode = mode;
    this.pool = pool || new pg.Pool({ connectionString, max: 4, connectionTimeoutMillis: 5000 });
    this.pool.on("error", () => console.error("School database connection failed."));
  }
  async initialize() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS school_fundraising_ledger (
      mode text PRIMARY KEY CHECK (mode IN ('test', 'live')),
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await this.pool.query("INSERT INTO school_fundraising_ledger(mode, data) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [this.mode, JSON.stringify(initialLedger())]);
  }
  async read(mode = this.mode) {
    const result = await this.pool.query("SELECT data FROM school_fundraising_ledger WHERE mode=$1", [mode]);
    return result.rows[0]?.data || initialLedger();
  }
  async transaction(work) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '15s'");
      const result = await client.query("SELECT data FROM school_fundraising_ledger WHERE mode=$1 FOR UPDATE", [this.mode]);
      const data = result.rows[0].data;
      const value = await work(data);
      await client.query("UPDATE school_fundraising_ledger SET data=$2, updated_at=now() WHERE mode=$1", [this.mode, JSON.stringify(data)]);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
  async close() { await this.pool.end(); }
}
