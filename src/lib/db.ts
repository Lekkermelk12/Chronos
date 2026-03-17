import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "chronos.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      address TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      image_url TEXT,
      dex_url TEXT,
      dex_id TEXT,
      pair_address TEXT,
      pair_created_at INTEGER,
      source TEXT DEFAULT 'unknown',
      first_seen INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      last_updated INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS token_categories (
      address TEXT NOT NULL,
      category TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      matched_keyword TEXT,
      PRIMARY KEY (address, category),
      FOREIGN KEY (address) REFERENCES tokens(address) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS token_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      price_usd REAL,
      market_cap REAL,
      volume_24h REAL,
      liquidity REAL,
      buys_24h INTEGER,
      sells_24h INTEGER,
      FOREIGN KEY (address) REFERENCES tokens(address) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS watchlists (
      session_id TEXT NOT NULL,
      address TEXT NOT NULL,
      added_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY (session_id, address)
    );

    CREATE TABLE IF NOT EXISTS reversal_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      signature TEXT UNIQUE,
      alert_type TEXT NOT NULL,
      description TEXT,
      swap_amount_usd REAL,
      reversal_score INTEGER DEFAULT 0,
      detected_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_categories_category ON token_categories(category);
    CREATE INDEX IF NOT EXISTS idx_snapshots_address ON token_snapshots(address);
    CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON token_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tokens_source ON tokens(source);
    CREATE INDEX IF NOT EXISTS idx_watchlists_session ON watchlists(session_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_address ON reversal_alerts(address);
    CREATE INDEX IF NOT EXISTS idx_alerts_detected ON reversal_alerts(detected_at);
  `);
}

// --- Token CRUD ---

export interface DbToken {
  address: string;
  name: string;
  symbol: string;
  image_url: string | null;
  dex_url: string | null;
  dex_id: string | null;
  pair_address: string | null;
  pair_created_at: number | null;
  source: string;
  first_seen: number;
  last_updated: number;
}

export function upsertToken(token: {
  address: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  dexUrl?: string;
  dexId?: string;
  pairAddress?: string;
  pairCreatedAt?: number;
  source?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO tokens (address, name, symbol, image_url, dex_url, dex_id, pair_address, pair_created_at, source, last_updated)
    VALUES (@address, @name, @symbol, @imageUrl, @dexUrl, @dexId, @pairAddress, @pairCreatedAt, @source, @now)
    ON CONFLICT(address) DO UPDATE SET
      name = @name,
      symbol = @symbol,
      image_url = COALESCE(@imageUrl, tokens.image_url),
      dex_url = COALESCE(@dexUrl, tokens.dex_url),
      dex_id = COALESCE(@dexId, tokens.dex_id),
      pair_address = COALESCE(@pairAddress, tokens.pair_address),
      pair_created_at = COALESCE(@pairCreatedAt, tokens.pair_created_at),
      source = COALESCE(@source, tokens.source),
      last_updated = @now
  `).run({
    address: token.address,
    name: token.name,
    symbol: token.symbol,
    imageUrl: token.imageUrl ?? null,
    dexUrl: token.dexUrl ?? null,
    dexId: token.dexId ?? null,
    pairAddress: token.pairAddress ?? null,
    pairCreatedAt: token.pairCreatedAt ?? null,
    source: token.source ?? "unknown",
    now: Date.now(),
  });
}

export function addCategory(address: string, category: string, confidence = 1.0, matchedKeyword?: string) {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO token_categories (address, category, confidence, matched_keyword)
    VALUES (?, ?, ?, ?)
  `).run(address, category, confidence, matchedKeyword ?? null);
}

export function addSnapshot(address: string, data: {
  priceUsd?: number;
  marketCap?: number;
  volume24h?: number;
  liquidity?: number;
  buys24h?: number;
  sells24h?: number;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO token_snapshots (address, price_usd, market_cap, volume_24h, liquidity, buys_24h, sells_24h)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    address,
    data.priceUsd ?? null,
    data.marketCap ?? null,
    data.volume24h ?? null,
    data.liquidity ?? null,
    data.buys24h ?? null,
    data.sells24h ?? null,
  );
}

export function getTokensByCategory(category: string): DbToken[] {
  const db = getDb();
  return db.prepare(`
    SELECT t.* FROM tokens t
    JOIN token_categories tc ON t.address = tc.address
    WHERE tc.category = ?
    ORDER BY t.last_updated DESC
  `).all(category) as DbToken[];
}

export function getTokenAddressesByCategory(category: string): string[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.address FROM tokens t
    JOIN token_categories tc ON t.address = tc.address
    WHERE tc.category = ?
  `).all(category) as { address: string }[];
  return rows.map((r) => r.address);
}

export function getTokenAddressesByCategoryAfter(category: string, afterMs: number): string[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.address FROM tokens t
    JOIN token_categories tc ON t.address = tc.address
    WHERE tc.category = ? AND t.pair_created_at IS NOT NULL AND t.pair_created_at >= ?
    ORDER BY t.pair_created_at DESC
  `).all(category, afterMs) as { address: string }[];
  return rows.map((r) => r.address);
}

export function searchTokensByNameOrSymbol(query: string, limit = 100): DbToken[] {
  const db = getDb();
  const pattern = `%${query}%`;
  return db.prepare(`
    SELECT * FROM tokens
    WHERE name LIKE ? COLLATE NOCASE OR symbol LIKE ? COLLATE NOCASE OR address = ?
    ORDER BY last_updated DESC
    LIMIT ?
  `).all(pattern, pattern, query, limit) as DbToken[];
}

export function getAllCategories(): { category: string; count: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT category, COUNT(*) as count FROM token_categories GROUP BY category ORDER BY count DESC
  `).all() as { category: string; count: number }[];
}

export function getTokenCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM tokens").get() as { count: number };
  return row.count;
}

export function getLastIndexTime(): number | null {
  const db = getDb();
  const row = db.prepare("SELECT MAX(last_updated) as t FROM tokens").get() as { t: number | null };
  return row.t;
}

/**
 * Delete a token and all its related data (categories, snapshots).
 * CASCADE ensures related rows are removed.
 */
export function deleteToken(address: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM tokens WHERE address = ?").run(address);
  return result.changes > 0;
}

/**
 * Delete multiple tokens at once (batch).
 */
export function deleteTokens(addresses: string[]): number {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM tokens WHERE address = ?");
  const tx = db.transaction((addrs: string[]) => {
    let count = 0;
    for (const addr of addrs) {
      const r = stmt.run(addr);
      count += r.changes;
    }
    return count;
  });
  return tx(addresses);
}

/**
 * Get all token addresses in the database.
 */
export function getAllTokenAddresses(): string[] {
  const db = getDb();
  const rows = db.prepare("SELECT address FROM tokens").all() as { address: string }[];
  return rows.map((r) => r.address);
}

// --- Server-side Watchlist ---

export function getWatchlistAddresses(sessionId: string): string[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT address FROM watchlists WHERE session_id = ? ORDER BY added_at DESC"
  ).all(sessionId) as { address: string }[];
  return rows.map((r) => r.address);
}

export function addToWatchlist(sessionId: string, address: string): void {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO watchlists (session_id, address) VALUES (?, ?)"
  ).run(sessionId, address);
}

export function removeFromWatchlist(sessionId: string, address: string): void {
  const db = getDb();
  db.prepare("DELETE FROM watchlists WHERE session_id = ? AND address = ?").run(
    sessionId,
    address
  );
}

export function isInWatchlistDb(sessionId: string, address: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT 1 FROM watchlists WHERE session_id = ? AND address = ?")
    .get(sessionId, address);
  return !!row;
}

// --- Reversal Alerts ---

export interface ReversalAlert {
  id: number;
  address: string;
  signature: string | null;
  alert_type: string;
  description: string | null;
  swap_amount_usd: number | null;
  reversal_score: number;
  detected_at: number;
}

export function insertReversalAlert(alert: {
  address: string;
  signature?: string;
  alertType: string;
  description?: string;
  swapAmountUsd?: number;
  reversalScore?: number;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO reversal_alerts
      (address, signature, alert_type, description, swap_amount_usd, reversal_score)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    alert.address,
    alert.signature ?? null,
    alert.alertType,
    alert.description ?? null,
    alert.swapAmountUsd ?? null,
    alert.reversalScore ?? 0
  );
}

export function getRecentAlerts(limitMs = 300_000): ReversalAlert[] {
  const db = getDb();
  const since = Date.now() - limitMs;
  return db.prepare(`
    SELECT * FROM reversal_alerts WHERE detected_at >= ? ORDER BY detected_at DESC LIMIT 50
  `).all(since) as ReversalAlert[];
}

export function pruneOldAlerts(olderThanMs = 24 * 60 * 60 * 1000): number {
  const db = getDb();
  const cutoff = Date.now() - olderThanMs;
  const result = db.prepare("DELETE FROM reversal_alerts WHERE detected_at < ?").run(cutoff);
  return result.changes;
}
