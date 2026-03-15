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

    CREATE INDEX IF NOT EXISTS idx_categories_category ON token_categories(category);
    CREATE INDEX IF NOT EXISTS idx_snapshots_address ON token_snapshots(address);
    CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON token_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tokens_source ON tokens(source);
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
