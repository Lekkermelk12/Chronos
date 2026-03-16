// Enrich tokens that have 0 liquidity with DexScreener data
// DexScreener allows batching 30 addresses per request
import Database from "better-sqlite3";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "..", "chronos.db"));
db.pragma("journal_mode = WAL");

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
function pfetch(url, opts = {}) {
  if (dispatcher) return undiciFetch(url, { ...opts, dispatcher });
  return fetch(url, opts);
}

const now = Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const insertSnapshot = db.prepare(`
  INSERT INTO token_snapshots (address, timestamp, price_usd, market_cap, volume_24h, liquidity, buys_24h, sells_24h)
  VALUES (@address, @timestamp, @price_usd, @market_cap, @volume_24h, @liquidity, @buys_24h, @sells_24h)
`);

const upsertToken = db.prepare(`
  UPDATE tokens SET
    dex_url = COALESCE(@dex_url, tokens.dex_url),
    dex_id = COALESCE(@dex_id, tokens.dex_id),
    pair_address = COALESCE(@pair_address, tokens.pair_address),
    image_url = COALESCE(@image_url, tokens.image_url),
    last_updated = @now
  WHERE address = @address
`);

// Get all tokens with no liquidity in latest snapshot
const noLiqTokens = db.prepare(`
  SELECT t.address FROM tokens t
  INNER JOIN (
    SELECT address, MAX(timestamp) as max_ts FROM token_snapshots GROUP BY address
  ) latest ON t.address = latest.address
  INNER JOIN token_snapshots s ON s.address = latest.address AND s.timestamp = latest.max_ts
  WHERE s.liquidity <= 0 OR s.liquidity IS NULL
`).all().map(r => r.address);

console.log(`Found ${noLiqTokens.length} tokens with no liquidity data`);

const BATCH_SIZE = 30; // DexScreener allows 30 per request
let enriched = 0, removed = 0, checked = 0;
const toRemove = [];

for (let i = 0; i < noLiqTokens.length; i += BATCH_SIZE) {
  const batch = noLiqTokens.slice(i, i + BATCH_SIZE);
  const addrList = batch.join(",");

  try {
    const res = await pfetch(`https://api.dexscreener.com/tokens/v1/solana/${addrList}`);
    if (!res.ok) { checked += batch.length; continue; }
    const pairs = await res.json();
    if (!Array.isArray(pairs)) { checked += batch.length; continue; }

    // Best pair per token
    const bestByToken = new Map();
    for (const p of pairs) {
      if (p.chainId !== "solana") continue;
      const addr = p.baseToken.address;
      const existing = bestByToken.get(addr);
      if (!existing || (p.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
        bestByToken.set(addr, p);
      }
    }

    for (const addr of batch) {
      const best = bestByToken.get(addr);
      if (!best) {
        toRemove.push(addr);
        checked++;
        continue;
      }

      const mc = best.marketCap ?? best.fdv ?? 0;
      const liq = best.liquidity?.usd ?? 0;
      const dex = best.dexId?.toLowerCase() ?? "";
      const isBonded = dex.includes("raydium") || dex.includes("pumpswap") || dex.includes("pump");

      if (liq <= 0 || mc < 3500 || !isBonded) {
        toRemove.push(addr);
      } else {
        insertSnapshot.run({
          address: addr, timestamp: now,
          price_usd: parseFloat(best.priceUsd) || 0,
          market_cap: mc, volume_24h: best.volume?.h24 ?? 0,
          liquidity: liq, buys_24h: best.txns?.h24?.buys ?? 0,
          sells_24h: best.txns?.h24?.sells ?? 0,
        });
        upsertToken.run({
          address: addr, dex_url: best.url, dex_id: best.dexId,
          pair_address: best.pairAddress, image_url: best.info?.imageUrl || null, now,
        });
        enriched++;
      }
      checked++;
    }

    if (checked % 300 === 0 || i + BATCH_SIZE >= noLiqTokens.length) {
      console.log(`  Checked ${checked}/${noLiqTokens.length}: enriched ${enriched}, dead ${toRemove.length}`);
    }
    await sleep(250);
  } catch (e) {
    checked += batch.length;
  }
}

// Remove dead tokens
if (toRemove.length > 0) {
  const del = db.prepare("DELETE FROM tokens WHERE address = ?");
  const delSnap = db.prepare("DELETE FROM token_snapshots WHERE address = ?");
  const delCat = db.prepare("DELETE FROM token_categories WHERE address = ?");
  const tx = db.transaction((addrs) => {
    for (const a of addrs) { del.run(a); delSnap.run(a); delCat.run(a); }
  });
  tx(toRemove);
  console.log(`Removed ${toRemove.length} dead tokens`);
}

const finalCount = db.prepare("SELECT COUNT(*) as c FROM tokens").get().c;
const alive = db.prepare(`
  SELECT COUNT(DISTINCT s.address) as c FROM token_snapshots s
  INNER JOIN (SELECT address, MAX(timestamp) as max_ts FROM token_snapshots GROUP BY address) latest
  ON s.address = latest.address AND s.timestamp = latest.max_ts
  WHERE s.market_cap >= 3500 AND s.liquidity > 0
`).get().c;

console.log(`\n=== FINAL ===`);
console.log(`Total tokens: ${finalCount}`);
console.log(`Enriched: ${enriched}`);
console.log(`Removed dead: ${toRemove.length}`);
console.log(`Alive (MC>=3.5k + liq>0): ${alive}`);
db.close();
