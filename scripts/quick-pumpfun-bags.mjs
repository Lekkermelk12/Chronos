#!/usr/bin/env node
// Quick indexer: PumpFun (graduated + bonding curve) + bags.fm only.
// Runs in ~5-10 minutes vs the full bulk-index which takes 30–60 min.
import Database from "better-sqlite3";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { fileURLToPath } from "url";
import path from "path";
import { execSync } from "child_process";
import { readFileSync } from "fs";

// Load .env
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { /* no .env */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "chronos.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const MIN_MC = 3500;
const SIX_MONTHS_S = 6 * 30 * 24 * 60 * 60;
const now = Date.now();
const nowS = Math.floor(now / 1000);

// ---- DB prepared statements (matches bulk-index schema) ----
const upsertToken = db.prepare(`
  INSERT INTO tokens (address, name, symbol, image_url, dex_url, dex_id, pair_created_at, source, first_seen, last_updated)
  VALUES (@address, @name, @symbol, @image_url, @dex_url, @dex_id, @pair_created_at, @source, @now, @now)
  ON CONFLICT(address) DO UPDATE SET
    name = @name, symbol = @symbol,
    image_url = COALESCE(@image_url, tokens.image_url),
    dex_url = COALESCE(@dex_url, tokens.dex_url),
    source = COALESCE(@source, tokens.source),
    last_updated = @now
`);

const upsertCategory = db.prepare(`
  INSERT INTO token_categories (address, category, confidence, matched_keyword)
  VALUES (@address, @category, @confidence, @keyword)
  ON CONFLICT(address, category) DO UPDATE SET confidence = MAX(token_categories.confidence, @confidence)
`);

const insertSnapshot = db.prepare(`
  INSERT INTO token_snapshots (address, timestamp, price_usd, market_cap, volume_24h, liquidity, buys_24h, sells_24h)
  VALUES (@address, @timestamp, @price_usd, @market_cap, @volume_24h, @liquidity, @buys_24h, @sells_24h)
`);

function storeToken(t) {
  try {
    const isNew = !db.prepare("SELECT 1 FROM tokens WHERE address=?").get(t.address);
    upsertToken.run({
      address: t.address,
      name: t.name || "Unknown",
      symbol: t.symbol || "???",
      image_url: t.logo || t.image_uri || null,
      dex_url: `https://gmgn.ai/sol/token/${t.address}`,
      dex_id: t.pool_type_str || null,
      pair_created_at: t.open_timestamp ? t.open_timestamp * 1000 : null,
      source: t.launchpad || (t.address.endsWith("pump") ? "pump.fun" : "unknown"),
      now,
    });
    insertSnapshot.run({
      address: t.address, timestamp: now,
      price_usd: t.price ?? 0, market_cap: t.market_cap ?? 0,
      volume_24h: t.volume ?? 0, liquidity: t.liquidity ?? 0,
      buys_24h: t.buys ?? 0, sells_24h: t.sells ?? 0,
    });
    return isNew;
  } catch { return false; }
}

// ---- Proxy-aware fetch ----
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
async function pfetch(url, opts = {}) {
  return dispatcher ? undiciFetch(url, { ...opts, dispatcher }) : undiciFetch(url, opts);
}

function curlFetch(url, extraHeaders = {}) {
  const headerArgs = Object.entries({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    ...extraHeaders,
  }).map(([k, v]) => `-H "${k}: ${v}"`).join(" ");
  try {
    const out = execSync(`curl -s --max-time 15 ${headerArgs} "${url}"`, { timeout: 20000 });
    return JSON.parse(out.toString());
  } catch { return null; }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const PUMPFUN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
  Origin: "https://pump.fun",
  Referer: "https://pump.fun/",
};

const GMGN_BASE = "https://gmgn.ai";

// ---- PumpFun ----
async function indexPumpFun() {
  const PAGE_SIZE = 50;
  const MAX_OFFSET = 1050;
  const seenMints = new Set();
  let stored = 0, scanned = 0;

  // Graduated tokens — all sort combos
  const sortCombos = [
    ["market_cap", "DESC"], ["market_cap", "ASC"],
    ["created_timestamp", "DESC"], ["created_timestamp", "ASC"],
    ["last_trade_timestamp", "DESC"], ["last_trade_timestamp", "ASC"],
    ["reply_count", "DESC"], ["reply_count", "ASC"],
    ["currently_live", "DESC"],
  ];

  for (const [sort, order] of sortCombos) {
    let emptyStreak = 0;
    for (let offset = 0; offset < MAX_OFFSET; offset += PAGE_SIZE) {
      try {
        const url = `https://frontend-api-v3.pump.fun/coins?limit=${PAGE_SIZE}&offset=${offset}&sort=${sort}&order=${order}&includeNsfw=false&complete=true`;
        const res = await pfetch(url, { headers: PUMPFUN_HEADERS });
        if (!res.ok) break;
        const coins = await res.json();
        if (!Array.isArray(coins) || coins.length === 0) { emptyStreak++; if (emptyStreak > 2) break; continue; }
        emptyStreak = 0;
        scanned += coins.length;
        let batch = 0;
        for (const coin of coins) {
          if (!coin.mint || !coin.complete) continue;
          if (seenMints.has(coin.mint)) continue;
          seenMints.add(coin.mint);
          if ((coin.usd_market_cap ?? 0) < MIN_MC) continue;
          if (coin.created_timestamp && (nowS - coin.created_timestamp) > SIX_MONTHS_S) continue;
          if (storeToken({ address: coin.mint, name: coin.name, symbol: coin.symbol, image_uri: coin.image_uri, market_cap: coin.usd_market_cap ?? 0, price: 0, volume: 0, liquidity: 0, buys: 0, sells: 0, open_timestamp: coin.created_timestamp, launchpad: "pump.fun" })) { stored++; batch++; }
        }
        if (batch > 0) process.stdout.write(`  [PF-GRAD] ${sort}/${order} @${offset}: +${batch}\n`);
        await sleep(150);
      } catch { break; }
    }
    console.log(`  [PF-GRAD] ${sort} ${order}: ${seenMints.size} unique, ${stored} stored`);
  }

  // Bonding-curve (non-graduated) — higher MC threshold
  const BONDING_MIN_MC = Math.max(MIN_MC, 10_000);
  console.log(`  [PF-BC] Bonding-curve tokens (MC >= $${BONDING_MIN_MC.toLocaleString()})...`);
  let bondingStored = 0;
  for (const [sort, order] of [["market_cap", "DESC"], ["last_trade_timestamp", "DESC"], ["reply_count", "DESC"]]) {
    let emptyStreak = 0;
    for (let offset = 0; offset < MAX_OFFSET; offset += PAGE_SIZE) {
      try {
        const url = `https://frontend-api-v3.pump.fun/coins?limit=${PAGE_SIZE}&offset=${offset}&sort=${sort}&order=${order}&includeNsfw=false&complete=false`;
        const res = await pfetch(url, { headers: PUMPFUN_HEADERS });
        if (!res.ok) break;
        const coins = await res.json();
        if (!Array.isArray(coins) || coins.length === 0) { emptyStreak++; if (emptyStreak > 2) break; continue; }
        emptyStreak = 0;
        scanned += coins.length;
        let batch = 0;
        for (const coin of coins) {
          if (!coin.mint || coin.complete) continue;
          if (seenMints.has(coin.mint)) continue;
          seenMints.add(coin.mint);
          if ((coin.usd_market_cap ?? 0) < BONDING_MIN_MC) continue;
          if (coin.created_timestamp && (nowS - coin.created_timestamp) > SIX_MONTHS_S) continue;
          if (storeToken({ address: coin.mint, name: coin.name, symbol: coin.symbol, image_uri: coin.image_uri, market_cap: coin.usd_market_cap ?? 0, price: 0, volume: 0, liquidity: 0, buys: 0, sells: 0, open_timestamp: coin.created_timestamp, launchpad: "pump.fun" })) { stored++; bondingStored++; batch++; }
        }
        if (batch > 0) process.stdout.write(`  [PF-BC] ${sort}/${order} @${offset}: +${batch}\n`);
        await sleep(150);
      } catch { break; }
    }
  }
  console.log(`  [PF-BC] Done: ${bondingStored} new bonding-curve tokens`);

  return { scanned, stored, unique: seenMints.size };
}

// ---- bags.fm ----
// All bags.fm tokens have addresses ending in "BAGS" (vanity suffix).
// Their DEX is "bags" on DexScreener. liq=0 is expected — don't filter on it.
async function indexBags() {
  const seen = new Set();
  let stored = 0, scanned = 0;

  function storeBagsPair(pair) {
    const addr = pair.baseToken?.address;
    if (!addr || seen.has(addr)) return;
    seen.add(addr);
    scanned++;
    const mc = pair.marketCap ?? pair.fdv ?? 0;
    if (mc < MIN_MC) return;
    const liq = pair.liquidity?.usd ?? 0;
    if (storeToken({
      address: addr, name: pair.baseToken.name, symbol: pair.baseToken.symbol,
      logo: pair.info?.imageUrl, price: parseFloat(pair.priceUsd) || 0,
      market_cap: mc, volume: pair.volume?.h24 ?? 0, liquidity: liq,
      buys: pair.txns?.h24?.buys ?? 0, sells: pair.txns?.h24?.sells ?? 0,
      open_timestamp: pair.pairCreatedAt ? Math.floor(pair.pairCreatedAt / 1000) : undefined,
      launchpad: "bags.fm",
    })) {
      upsertCategory.run({ address: addr, category: "bags", confidence: 1.0, keyword: "bags-dexscreener" });
      stored++;
    }
  }

  // DexScreener: "BAGS" matches token addresses ending in BAGS + name matches
  for (const q of ["BAGS", "bags", "bags.fm", "bagsapp", "bagsfm"]) {
    try {
      const res = await pfetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const pair of (data.pairs ?? [])) {
        if (pair.chainId !== "solana") continue;
        const isBags = pair.dexId === "bags" || (pair.baseToken?.address ?? "").endsWith("BAGS");
        if (!isBags) continue;
        storeBagsPair(pair);
      }
      await sleep(300);
    } catch { /* skip */ }
  }
  console.log(`  [Bags] DexScreener: ${scanned} scanned, ${stored} stored`);

  // GMGN: filter for bags launchpad or BAGS address suffix
  for (const tf of ["1m", "5m", "1h", "6h", "24h"]) {
    try {
      const data = curlFetch(`${GMGN_BASE}/defi/quotation/v1/rank/sol/swaps/${tf}?orderby=marketcap&direction=desc&limit=200`);
      if (!data || data.code !== 0) continue;
      for (const t of (data.data?.rank ?? [])) {
        const lp = (t.launchpad ?? "").toLowerCase();
        const addr = t.address ?? "";
        if (!lp.includes("bag") && !addr.endsWith("BAGS")) continue;
        if (seen.has(addr)) continue;
        seen.add(addr);
        scanned++;
        if ((t.market_cap ?? 0) < MIN_MC) continue;
        if (storeToken({
          address: addr, name: t.name, symbol: t.symbol, logo: t.logo,
          price: t.price ?? 0, market_cap: t.market_cap ?? 0,
          volume: t.volume ?? 0, liquidity: t.liquidity ?? 0,
          buys: t.buys ?? 0, sells: t.sells ?? 0,
          open_timestamp: t.open_timestamp, launchpad: "bags.fm",
        })) {
          upsertCategory.run({ address: addr, category: "bags", confidence: 1.0, keyword: "bags-gmgn" });
          stored++;
        }
      }
    } catch { /* skip */ }
    await sleep(200);
  }

  console.log(`  [Bags] total: ${scanned} candidates, ${stored} stored`);
  return { scanned, stored };
}

// ---- main ----
const start = db.prepare("SELECT COUNT(*) as c FROM tokens").get().c;
const startBags = db.prepare("SELECT COUNT(*) as c FROM token_categories WHERE category='bags'").get().c;
const startPF = db.prepare("SELECT COUNT(*) as c FROM tokens WHERE source='pump.fun'").get().c;
console.log(`Starting: ${start} total tokens | PumpFun: ${startPF} | Bags: ${startBags}\n`);

console.log("=== PumpFun (graduated + bonding curve) ===");
const pf = await indexPumpFun();
console.log(`PumpFun: scanned ${pf.scanned}, ${pf.unique} unique, ${pf.stored} new\n`);

console.log("=== bags.fm ===");
const bags = await indexBags();
console.log(`bags.fm: scanned ${bags.scanned}, ${bags.stored} new\n`);

const end = db.prepare("SELECT COUNT(*) as c FROM tokens").get().c;
const endBags = db.prepare("SELECT COUNT(*) as c FROM token_categories WHERE category='bags'").get().c;
const endPF = db.prepare("SELECT COUNT(*) as c FROM tokens WHERE source='pump.fun'").get().c;

console.log(`Done. ${end} tokens total (+${end - start})`);
console.log(`PumpFun: ${endPF} (+${endPF - startPF}) | Bags: ${endBags} (+${endBags - startBags})`);

db.close();
