// Bulk-index tokens from PumpFun + Jupiter into chronos.db (proxy-aware)
import Database from "better-sqlite3";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "chronos.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
function pfetch(url, opts = {}) {
  if (dispatcher) return undiciFetch(url, { ...opts, dispatcher });
  return fetch(url, opts);
}

const PUMPFUN_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
  Origin: "https://pump.fun",
  Referer: "https://pump.fun/",
};

const MIN_MC = 3500;
const SIX_MONTHS_S = 6 * 30 * 24 * 60 * 60;

const upsertToken = db.prepare(`
  INSERT INTO tokens (address, name, symbol, image_url, dex_url, dex_id, pair_created_at, source, first_seen, last_updated)
  VALUES (@address, @name, @symbol, @image_url, @dex_url, @dex_id, @pair_created_at, @source, @now, @now)
  ON CONFLICT(address) DO UPDATE SET
    name = @name, symbol = @symbol, image_url = COALESCE(@image_url, tokens.image_url),
    dex_url = COALESCE(@dex_url, tokens.dex_url), dex_id = COALESCE(@dex_id, tokens.dex_id),
    pair_created_at = COALESCE(@pair_created_at, tokens.pair_created_at),
    source = COALESCE(@source, tokens.source), last_updated = @now
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

const now = Date.now();
const nowS = Math.floor(now / 1000);

function storeToken(t) {
  try {
    upsertToken.run({
      address: t.address,
      name: t.name || "Unknown",
      symbol: t.symbol || "???",
      image_url: t.logo || t.image_uri || null,
      dex_url: `https://gmgn.ai/sol/token/${t.address}`,
      dex_id: t.pool_type_str || null,
      pair_created_at: t.open_timestamp ? t.open_timestamp * 1000 : (t.creation_timestamp ? t.creation_timestamp * 1000 : null),
      source: t.address.endsWith("pump") ? "pump.fun" : (t.launchpad || "unknown"),
      now,
    });
    if (t.address.endsWith("pump")) {
      upsertCategory.run({ address: t.address, category: "migrated", confidence: 1.0, keyword: t.pool_type_str || "pumpfun" });
    }
    const name = (t.name || "").toLowerCase();
    const symbol = (t.symbol || "").toLowerCase();
    if (name.includes("bonk") || symbol.includes("bonk")) {
      upsertCategory.run({ address: t.address, category: "bonk", confidence: 1.0, keyword: "name-match" });
    }
    insertSnapshot.run({
      address: t.address, timestamp: now,
      price_usd: t.price ?? 0, market_cap: t.market_cap ?? t.usd_market_cap ?? 0,
      volume_24h: t.volume ?? 0, liquidity: t.liquidity ?? 0,
      buys_24h: t.buys ?? 0, sells_24h: t.sells ?? 0,
    });
    return true;
  } catch { return false; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- PumpFun: exhaustive with higher offsets per sort ----
async function indexPumpFun() {
  const PAGE_SIZE = 50;
  const MAX_OFFSET = 1050; // PumpFun caps at ~1050
  const seenMints = new Set();
  let stored = 0, scanned = 0;

  // All sort combos, both directions where useful
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

          if (storeToken({
            address: coin.mint, name: coin.name || "Unknown", symbol: coin.symbol || "???",
            image_uri: coin.image_uri, market_cap: coin.usd_market_cap ?? 0,
            price: 0, volume: 0, liquidity: 0, buys: 0, sells: 0,
            open_timestamp: coin.created_timestamp, creation_timestamp: coin.created_timestamp,
          })) { stored++; batch++; }
        }
        if (batch > 0) process.stdout.write(`  [PF] ${sort}/${order} @${offset}: +${batch}\n`);
        await sleep(150);
      } catch { break; }
    }
    console.log(`  [PF] ${sort} ${order} done: ${seenMints.size} unique, ${stored} stored`);
  }

  return { scanned, stored, unique: seenMints.size };
}

// ---- Jupiter: get popular tokens with price data ----
async function indexFromJupiter() {
  let stored = 0;
  try {
    // Jupiter strict token list - verified tokens
    const res = await pfetch("https://tokens.jup.ag/tokens?tags=verified,community");
    if (!res.ok) { console.log("  Jupiter token list failed:", res.status); return { stored: 0 }; }
    const tokens = await res.json();
    console.log(`  [Jupiter] Got ${tokens.length} tokens from verified list`);

    // Filter for PumpFun/Bonk tokens
    let candidates = tokens.filter(t => {
      if (!t.address) return false;
      const name = (t.name || "").toLowerCase();
      const symbol = (t.symbol || "").toLowerCase();
      return t.address.endsWith("pump") || name.includes("bonk") || symbol.includes("bonk");
    });
    console.log(`  [Jupiter] ${candidates.length} PumpFun/Bonk candidates`);

    // Get prices for candidates in batches of 100
    const BATCH = 100;
    for (let i = 0; i < candidates.length; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      const ids = batch.map(t => t.address).join(",");
      try {
        const priceRes = await pfetch(`https://api.jup.ag/price/v2?ids=${ids}&showExtraInfo=true`);
        if (!priceRes.ok) continue;
        const priceData = await priceRes.json();

        for (const t of batch) {
          const p = priceData.data?.[t.address];
          if (!p) continue;
          const price = parseFloat(p.price) || 0;
          if (price <= 0) continue;

          // Estimate MC from price (rough - assumes ~1B supply for pump tokens)
          // We'll store what we have and let cleanup filter later
          if (storeToken({
            address: t.address,
            name: t.name || "Unknown",
            symbol: t.symbol || "???",
            logo: t.logoURI,
            price,
            market_cap: 0, // Don't have supply info
            volume: 0,
            liquidity: 0,
          })) stored++;
        }
        await sleep(200);
      } catch { /* skip batch */ }
    }
  } catch (e) {
    console.error("  Jupiter error:", e.message);
  }
  return { stored };
}

// ---- DexScreener (still works for search, just not GMGN) ----
async function indexFromDexScreener() {
  let stored = 0, scanned = 0;
  const seen = new Set();

  const queries = [
    "solana", "sol", "pump", "raydium", "pumpswap", "meme", "degen",
    "bonk", "dog", "cat", "pepe", "ai", "trump", "based", "moon",
    "viral", "tiktok", "dev", "nft", "gaming",
    "shib", "doge", "frog", "bear", "bull", "monkey", "ape", "bird",
    "elon", "bitcoin", "crypto", "chad", "wojak", "cope",
    "brainrot", "skibidi", "rizz", "ohio",
    "token", "coin", "swap", "yield", "defi", "web3",
    "baby", "mini", "super", "mega", "giga", "turbo",
    "ninja", "dragon", "wizard", "gold", "diamond", "gem", "rocket",
    "maxxing", "italian", "tung", "sahur", "chill", "jester",
    "agartha", "hezi", "penguin", "larp", "mogged",
  ];

  for (const query of queries) {
    try {
      const res = await pfetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) continue;
      const data = await res.json();
      const pairs = data.pairs ?? [];
      scanned += pairs.length;

      let batch = 0;
      for (const pair of pairs) {
        if (pair.chainId !== "solana") continue;
        const addr = pair.baseToken.address;
        if (seen.has(addr)) continue;
        seen.add(addr);

        // Must be PumpFun or Bonk
        const name = (pair.baseToken.name || "").toLowerCase();
        const symbol = (pair.baseToken.symbol || "").toLowerCase();
        const isPump = addr.endsWith("pump");
        const isBonk = name.includes("bonk") || symbol.includes("bonk");
        if (!isPump && !isBonk) continue;

        const mc = pair.marketCap ?? pair.fdv ?? 0;
        if (mc < MIN_MC) continue;
        const liq = pair.liquidity?.usd ?? 0;
        if (liq <= 0 || liq > 10_000_000) continue;

        // Age filter
        if (pair.pairCreatedAt) {
          const ageS = (now - pair.pairCreatedAt) / 1000;
          if (ageS > SIX_MONTHS_S) continue;
        }

        if (storeToken({
          address: addr,
          name: pair.baseToken.name || "Unknown",
          symbol: pair.baseToken.symbol || "???",
          logo: pair.info?.imageUrl,
          price: parseFloat(pair.priceUsd) || 0,
          market_cap: mc,
          volume: pair.volume?.h24 ?? 0,
          liquidity: liq,
          buys: pair.txns?.h24?.buys ?? 0,
          sells: pair.txns?.h24?.sells ?? 0,
          open_timestamp: pair.pairCreatedAt ? Math.floor(pair.pairCreatedAt / 1000) : undefined,
          pool_type_str: pair.dexId,
        })) { stored++; batch++; }
      }
      if (batch > 0) console.log(`  [DexS] "${query}": +${batch} (${seen.size} unique)`);
      await sleep(300);
    } catch { /* skip */ }
  }

  // Also trending boosts
  try {
    const res = await pfetch("https://api.dexscreener.com/token-boosts/top/v1");
    if (res.ok) {
      const boosts = await res.json();
      const solAddrs = boosts
        .filter(b => b.chainId === "solana")
        .map(b => b.tokenAddress)
        .filter(a => !seen.has(a));

      for (const addr of solAddrs.slice(0, 30)) {
        try {
          const res2 = await pfetch(`https://api.dexscreener.com/tokens/v1/solana/${addr}`);
          if (!res2.ok) continue;
          const pairs = await res2.json();
          if (!Array.isArray(pairs) || pairs.length === 0) continue;
          const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
          if (!best || best.chainId !== "solana") continue;
          const isPump = addr.endsWith("pump");
          const isBonk = (best.baseToken.name || "").toLowerCase().includes("bonk");
          if (!isPump && !isBonk) continue;
          const mc = best.marketCap ?? 0;
          if (mc < MIN_MC) continue;
          if (storeToken({
            address: addr,
            name: best.baseToken.name, symbol: best.baseToken.symbol,
            logo: best.info?.imageUrl, price: parseFloat(best.priceUsd) || 0,
            market_cap: mc, volume: best.volume?.h24 ?? 0,
            liquidity: best.liquidity?.usd ?? 0,
            buys: best.txns?.h24?.buys ?? 0, sells: best.txns?.h24?.sells ?? 0,
            pool_type_str: best.dexId,
          })) stored++;
          await sleep(200);
        } catch { /* skip */ }
      }
    }
  } catch {}

  return { scanned, stored, unique: seen.size };
}

// ---- Main ----
async function main() {
  const startCount = db.prepare("SELECT COUNT(*) as c FROM tokens").get().c;
  console.log(`Starting with ${startCount} tokens\n`);

  console.log("=== Phase 1: PumpFun Graduated (all sort combos) ===");
  const pf = await indexPumpFun();
  console.log(`PumpFun: scanned ${pf.scanned}, ${pf.unique} unique, ${pf.stored} new\n`);

  console.log("=== Phase 2: DexScreener Search (60+ queries + trending) ===");
  const dex = await indexFromDexScreener();
  console.log(`DexScreener: scanned ${dex.scanned}, ${dex.unique} unique, ${dex.stored} new\n`);

  console.log("=== Phase 3: Jupiter Verified Tokens ===");
  const jup = await indexFromJupiter();
  console.log(`Jupiter: ${jup.stored} new\n`);

  const endCount = db.prepare("SELECT COUNT(*) as c FROM tokens").get().c;
  const alive = db.prepare(`
    SELECT COUNT(DISTINCT s.address) as c FROM token_snapshots s
    INNER JOIN (SELECT address, MAX(timestamp) as max_ts FROM token_snapshots GROUP BY address) latest
    ON s.address = latest.address AND s.timestamp = latest.max_ts
    WHERE s.market_cap >= 3500
  `).get().c;
  const withLiq = db.prepare(`
    SELECT COUNT(DISTINCT s.address) as c FROM token_snapshots s
    INNER JOIN (SELECT address, MAX(timestamp) as max_ts FROM token_snapshots GROUP BY address) latest
    ON s.address = latest.address AND s.timestamp = latest.max_ts
    WHERE s.market_cap >= 3500 AND s.liquidity > 0
  `).get().c;

  console.log("=== RESULTS ===");
  console.log(`Before: ${startCount}`);
  console.log(`After:  ${endCount} (+${endCount - startCount})`);
  console.log(`MC >= 3.5k: ${alive}`);
  console.log(`MC >= 3.5k + liq > 0: ${withLiq}`);
  db.close();
}

main().catch(console.error);
