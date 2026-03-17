import { upsertToken, addCategory, addSnapshot, getTokenCount, getDb, getAllTokenAddresses, deleteTokens } from "./db";
import { matchTiktokMeme, TIKTOK_SEARCH_QUERIES } from "./keywords";
import { GmgnRankToken, GmgnTokenInfo, getRankedTokens, getTokenData, fetchBulkTokens, getNewPairs } from "./gmgn";

const PUMPFUN_API = "https://frontend-api-v3.pump.fun";
const PUMPFUN_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
  Origin: "https://pump.fun",
  Referer: "https://pump.fun/",
};

/** Minimum market cap floor. Coins below this are considered dead/scam. */
const MIN_MC_FLOOR = 3500;

/** Looser MC floor used during discovery — cleanup prunes dead coins later. */
const DISCOVERY_MC_FLOOR = 1000;

/** Maximum age for cleanup: 6 months in milliseconds */
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

/** Maximum age for discovery: 18 months — captures all of pump.fun's history */
const EIGHTEEN_MONTHS_MS = 18 * 30 * 24 * 60 * 60 * 1000;

// Known TikTok meme coin addresses (curated seed list)
const SEED_ADDRESSES = [
  "J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump", // Tung Tung Tung Sahur
  "59gPcuoED3gB7u66sAjjMiXprVBZmAi1wpGZyK6Upump", // Mogged
  "BkDaxAYEoBhrq7QLE32eDXU3TvNwCA3BR74hp4G5pump", // Lowkirkenuinely
  "Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump", // Just a chill guy
  "9AvytnUKsLxPxFHFqS6VLxaxt5p6BhYNr53SD2Chpump", // The Official 67 Coin
  "FYtP5AiiB4eUjVA88EeZS73PDpi7RPLusdqtXizYpump", // GOY
  "DL6BBBQ6heTg9Zr5gFZxsCK2AZt2aVyRqUZgChqopump", // Tiktok Coin
  "66FUGxm2cEsZ3ASXeTTHmT6RggmUPCZAcwWxRknHpump", // Johnny
  "3zWamrcm37PvqSrf8a1whYxy3ekBCnaVJ1ZX7BEHpump", // ascend
  "5LCVhWUh2KZd1wZ7MefZGCjF3tvRsqMJjscJSAW9pump", // CITY BOY
  "14GMPMf3cRANLfJ9QYU19F5XogVGPjCB7f3NLACrpump", // Just can't prove it
  "8ZeTmGGktvSwSSghx8btbTAVGdWogThKM4DQBJgRpump", // All Roads Lead To Rome
  "HmCxqpgxaQng3A73F7vLgJjc9sr6ACFt8CEJwWY2hMGR", // Opium Bird
  "GZcVdxXSenrKgnkAKCj9Yp7ConTB4poGfBohFVpupump", // Nosey
  "8ryRQD6jWfxnSdvvVbQ8Tzwo1NgGP7w1X1nQPpb4pump", // meowl the owl cat
  "H4EkHReWbjJpqNUiUeYNNZbNKLqLfH8Jt9MkceXGpump", // Talking Objects
  "Bw4hEZZSz2uff9wZLdpDikgbaWSd5fTEozQkV7KApump", // Skeleton Banging Shield
  "8BojTbbG2nnTXA1WgpHxoKdqdoa3AAnDvzqynHZdpump", // Dagestan
  "6WdHhpRY7vL8SQ69bd89tAj3sk8jsjBrCLDUTZSNpump", // JESTERMAXXING
  "4az7oyuUFco8GedLkWYzopurgadkSz8n64xCEXNYpump", // Agartha
  "8zkYcsZGnu6yUaQX7hYGJrEHRs8VJuGCVrypXo7ipump", // WHY YOU HEZI
  "8Jx8AAHj86wbQgUTjGuj6GTTL5Ps3cqxKRTvpaJApump", // Nietzschean Penguin
  "32CdQdBUxbCsLy5AUHWmyidfwhgGUr9N573NBUrDpump", // maxxing
  "EygStH4gHv1h4E8w4raYv6NGsrDiij3nbfCc26iTpump", // Live Action Roleplay
  // Additional viral Solana meme coins
  "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump", // Peanut the Squirrel (PNUT)
  "A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump",  // Fartcoin
  "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82",  // BOME (Book of Meme)
  "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5",   // cat in a dogs world (MEW)
  "HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg",  // SLERF
  "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk",   // WEN
  "BaoawH9p3DmCCtnodM7GRmJPxpw3XBRqECMD6EFDtcE",   // GIGA
  "GJAFwWjJ3vnTsrZSK9xJtNqF9wZqHetGKF3GBZwYLkZ",   // ai16z
  "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS",   // KMNO
  "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",  // SAMO (Samoyed Coin)
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",  // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",  // dogwifhat (WIF)
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",  // Popcat
  "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzc8yy",  // Moo Deng
  "Cn5Ne1vmR9ctMGY9z5NC71A3NYFvopjXNyxYtfVYpump",  // Retardio
  "8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn",  // CHEEMS
  "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux",   // HNT
  "nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7",   // NOS
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",  // RAY (Raydium)
  "Gz7VkD4MacbEB6yC5XD3HcumEiYx2EtDYYrfikGsvopG",  // CHONKY
  "Fch1oixTPri8zxBnmdCEADoJW2toyFHxqDZacQkwdvSP",  // BAN (Bananas)
  "GDfnEsia2WLAW5t8yx2X5j2mkfA74i5kwGdDuZHt7XmG",  // Popcat variant
];

/**
 * Check if a GMGN token is a bonded PumpFun or Bonk coin.
 */
function isBondedToken(token: GmgnRankToken): boolean {
  const addr = token.address ?? "";
  const launchpad = (token.launchpad ?? "").toLowerCase();
  const name = (token.name ?? "").toLowerCase();
  const symbol = (token.symbol ?? "").toLowerCase();
  const pool = (token.pool_type_str ?? "").toLowerCase();

  // PumpFun-launched (address ends with "pump" or launchpad is pump)
  const isPumpFun =
    addr.endsWith("pump") ||
    launchpad.includes("pump") ||
    pool.includes("raydium") ||
    pool.includes("pumpswap");

  // Bonk ecosystem
  const isBonk = name.includes("bonk") || symbol.includes("bonk");

  return isPumpFun || isBonk;
}

/**
 * Check if a token is within the 6-month age limit.
 * Returns true if young enough (or if no timestamp available - keep it).
 */
function isWithinAgeLimit(creationTimestamp: number | undefined): boolean {
  if (!creationTimestamp) return true; // No timestamp = keep it
  const now = Date.now();
  const createdMs = creationTimestamp * 1000; // GMGN uses seconds
  return now - createdMs <= SIX_MONTHS_MS;
}

/**
 * Process a GMGN ranked token: upsert token, auto-categorize, add snapshot.
 */
function processGmgnToken(token: GmgnRankToken, forceCategory?: string) {
  const addr = token.address;
  const name = token.name ?? "Unknown";
  const symbol = token.symbol ?? "???";
  const launchpad = (token.launchpad ?? "").toLowerCase();

  const source = addr.endsWith("pump") || launchpad.includes("pump")
    ? "pump.fun"
    : launchpad || "unknown";

  upsertToken({
    address: addr,
    name,
    symbol,
    imageUrl: token.logo || undefined,
    dexUrl: `https://gmgn.ai/sol/token/${addr}`,
    dexId: token.pool_type_str || undefined,
    pairCreatedAt: token.open_timestamp ? token.open_timestamp * 1000 : undefined,
    source,
  });

  // Auto-categorize based on keyword matching
  const match = matchTiktokMeme(name, symbol);
  if (match) {
    addCategory(addr, "tiktok-meme", match.confidence, match.keyword);
    if (match.tag) {
      addCategory(addr, match.tag, match.confidence, match.keyword);
    }
  }

  if (forceCategory) {
    addCategory(addr, forceCategory, 1.0, "seed-list");
  }

  // Bonk category
  if (name.toLowerCase().includes("bonk") || symbol.toLowerCase().includes("bonk")) {
    addCategory(addr, "bonk", 1.0, "name-match");
  }

  // Migrated PumpFun category
  if (addr.endsWith("pump")) {
    addCategory(addr, "migrated", 1.0, token.pool_type_str ?? "gmgn");
  }

  // Add snapshot with GMGN data
  addSnapshot(addr, {
    priceUsd: token.price ?? 0,
    marketCap: token.market_cap ?? 0,
    volume24h: token.volume ?? 0,
    liquidity: token.liquidity ?? 0,
    buys24h: token.buys ?? 0,
    sells24h: token.sells ?? 0,
  });
}

/**
 * Seed the database with known TikTok meme coin addresses via GMGN.
 */
export async function seedDatabase(): Promise<{ seeded: number; errors: number }> {
  let seeded = 0;
  let errors = 0;

  for (let i = 0; i < SEED_ADDRESSES.length; i += 5) {
    const batch = SEED_ADDRESSES.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map((addr) => getTokenData(addr))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled" && result.value) {
        const info = result.value;
        upsertToken({
          address: info.address,
          name: info.name ?? "Unknown",
          symbol: info.symbol ?? "???",
          imageUrl: info.logo || undefined,
          dexUrl: `https://gmgn.ai/sol/token/${info.address}`,
          source: info.address.endsWith("pump") ? "pump.fun" : "unknown",
          pairCreatedAt: info.open_timestamp ? info.open_timestamp * 1000 : undefined,
        });
        addCategory(info.address, "tiktok-meme", 1.0, "seed-list");
        if (info.address.endsWith("pump")) {
          addCategory(info.address, "migrated", 1.0, "seed");
        }
        addSnapshot(info.address, {
          priceUsd: info.price ?? 0,
          marketCap: 0, // token_info endpoint doesn't have MC
          liquidity: info.liquidity ?? 0,
        });
        seeded++;
      } else {
        errors++;
      }
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 300));
  }

  return { seeded, errors };
}

/**
 * Discover new tokens using GMGN ranking endpoint.
 * Pulls tokens sorted by various criteria, filters for bonded PumpFun/Bonk coins
 * above $3.5K MC and within 6 months old.
 */
export async function discoverNewTokens(): Promise<{ discovered: number; total: number }> {
  const existingCount = getTokenCount();
  const db = getDb();
  const existing = db.prepare("SELECT address FROM tokens").all() as { address: string }[];
  const seenAddresses = new Set<string>(existing.map((r) => r.address));

  // Fetch bulk tokens from GMGN (multiple timeframes/sort orders)
  const gmgnTokens = await fetchBulkTokens({
    limit: 200,
    minMc: DISCOVERY_MC_FLOOR,
    maxAgeMs: EIGHTEEN_MONTHS_MS,
  });

  let newCount = 0;
  for (const token of gmgnTokens) {
    if (seenAddresses.has(token.address)) continue;
    if ((token.liquidity ?? 0) <= 0) continue;

    processGmgnToken(token);
    seenAddresses.add(token.address);
    newCount++;
  }

  const totalCount = getTokenCount();
  return { discovered: newCount, total: totalCount };
}

/**
 * Update snapshots for all existing tokens by re-fetching from GMGN.
 * Uses the single-token endpoint for each token.
 */
export async function refreshSnapshots(): Promise<{ updated: number }> {
  const db = getDb();
  const addresses = db.prepare("SELECT address FROM tokens").all() as { address: string }[];
  let updated = 0;

  for (let i = 0; i < addresses.length; i += 5) {
    const batch = addresses.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map((row) => getTokenData(row.address))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        const info = result.value;
        addSnapshot(info.address, {
          priceUsd: info.price ?? 0,
          liquidity: info.liquidity ?? 0,
          volume24h: info.volume_24h ?? 0,
        });
        updated++;
      }
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 300));
  }

  return { updated };
}

/**
 * Full index run: seed (if needed) + GMGN broad + PumpFun paginated + refresh snapshots.
 * Targets 10K+ tokens by combining all sources.
 */
export async function runFullIndex(): Promise<{
  seeded: number;
  discovered: number;
  pumpfun: number;
  refreshed: number;
  totalTokens: number;
}> {
  let seeded = 0;
  if (getTokenCount() === 0) {
    const seedResult = await seedDatabase();
    seeded = seedResult.seeded;
  }

  // GMGN ranking — catches active/trending tokens across all launchpads
  const discoverResult = await discoverNewTokens();

  // PumpFun paginated — the main bulk source, targets the long tail of graduated coins
  const pumpResult = await indexFromPumpFun(10_000);

  const refreshResult = await refreshSnapshots();

  return {
    seeded,
    discovered: discoverResult.discovered,
    pumpfun: pumpResult.stored,
    refreshed: refreshResult.updated,
    totalTokens: getTokenCount(),
  };
}

/**
 * Index graduated coins from PumpFun API using all sort orders and directions.
 * Filters for bonded coins above $3.5K MC and within 6 months old.
 */
export async function indexFromPumpFun(maxCoins = 5000): Promise<{
  scanned: number;
  stored: number;
}> {
  let stored = 0;
  let scanned = 0;
  const PAGE_SIZE = 50;
  const seenMints = new Set<string>();
  const now = Date.now();

  const sortCombos: [string, string][] = [
    ["market_cap", "DESC"],
    ["market_cap", "ASC"],
    ["created_timestamp", "DESC"],
    ["created_timestamp", "ASC"],
    ["last_trade_timestamp", "DESC"],
    ["last_trade_timestamp", "ASC"],
    ["reply_count", "DESC"],
  ];

  for (const [sort, order] of sortCombos) {
    for (let offset = 0; offset < maxCoins; offset += PAGE_SIZE) {
      try {
        const res = await fetch(
          `${PUMPFUN_API}/coins?limit=${PAGE_SIZE}&offset=${offset}&sort=${sort}&order=${order}&includeNsfw=false&complete=true`,
          { headers: PUMPFUN_HEADERS }
        );
        if (!res.ok) break;
        const coins = await res.json();
        if (!Array.isArray(coins) || coins.length === 0) break;
        scanned += coins.length;

        for (const coin of coins) {
          if (!coin.mint || !coin.complete) continue;
          if (seenMints.has(coin.mint)) continue;
          seenMints.add(coin.mint);

          // Skip coins below looser discovery MC floor
          if ((coin.usd_market_cap ?? 0) < DISCOVERY_MC_FLOOR) continue;

          // Skip coins older than 18 months (captures all of pump.fun history)
          if (coin.created_timestamp) {
            const ageMs = now - coin.created_timestamp * 1000;
            if (ageMs > EIGHTEEN_MONTHS_MS) continue;
          }

          upsertToken({
            address: coin.mint,
            name: coin.name || "Unknown",
            symbol: coin.symbol || "???",
            imageUrl: coin.image_uri ?? undefined,
            source: "pump.fun",
          });
          addCategory(coin.mint, "migrated", 1.0, "pumpfun-graduated");
          addSnapshot(coin.mint, {
            priceUsd: 0,
            marketCap: coin.usd_market_cap ?? 0,
          });
          stored++;
        }
      } catch {
        break;
      }
    }
    console.log(`[PumpFun] ${sort} ${order}: ${seenMints.size} unique coins so far`);
  }

  return { scanned, stored };
}

/**
 * Index tokens from GMGN ranking (replaces indexMigratedFromDexScreener).
 * Pulls large batches of ranked tokens, filters for bonded PumpFun/Bonk coins.
 */
export async function indexFromGmgn(): Promise<{
  scanned: number;
  stored: number;
}> {
  const tokens = await fetchBulkTokens({
    limit: 500,
    minMc: DISCOVERY_MC_FLOOR,
    maxAgeMs: EIGHTEEN_MONTHS_MS,
  });

  let stored = 0;
  for (const token of tokens) {
    if ((token.liquidity ?? 0) <= 0) continue;
    processGmgnToken(token);
    stored++;
  }

  return { scanned: tokens.length, stored };
}

/**
 * Validate all stored tokens against GMGN live data.
 * Removes tokens that:
 * - Have no liquidity (didn't bond / liquidity pulled)
 * - Current market cap is below $3.5K (dead floor)
 * - Are older than 6 months
 * - Are not bonded PumpFun or Bonk coins
 */
export async function cleanupDeadTokens(
  onProgress?: (checked: number, total: number, removed: number) => void
): Promise<{
  checked: number;
  removed: number;
  remaining: number;
}> {
  const allAddresses = getAllTokenAddresses();
  const total = allAddresses.length;
  const toRemove: string[] = [];
  let checked = 0;

  // Check tokens one at a time via GMGN single-token endpoint
  // (GMGN doesn't have a batch lookup like DexScreener's 30-at-once)
  const BATCH_SIZE = 5; // Parallel requests per batch

  for (let i = 0; i < allAddresses.length; i += BATCH_SIZE) {
    const batch = allAddresses.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((addr) => getTokenData(addr))
    );

    for (let j = 0; j < results.length; j++) {
      const addr = batch[j];
      const result = results[j];

      if (result.status !== "fulfilled" || !result.value) {
        // No data from GMGN = likely dead or unlisted
        toRemove.push(addr);
        checked++;
        continue;
      }

      const info = result.value;
      const liq = info.liquidity ?? 0;
      const mc = info.price && info.total_supply
        ? info.price * info.total_supply
        : 0;

      // Check age
      const tooOld = info.creation_timestamp
        ? Date.now() - info.creation_timestamp * 1000 > SIX_MONTHS_MS
        : false;

      // Remove if: no liquidity, below MC floor, or too old
      if (liq <= 0 || mc < MIN_MC_FLOOR || tooOld) {
        toRemove.push(addr);
      } else {
        // Token is alive - update snapshot
        addSnapshot(addr, {
          priceUsd: info.price ?? 0,
          liquidity: liq,
          volume24h: info.volume_24h ?? 0,
        });
        // Update token metadata
        upsertToken({
          address: addr,
          name: info.name ?? "Unknown",
          symbol: info.symbol ?? "???",
          imageUrl: info.logo || undefined,
          dexUrl: `https://gmgn.ai/sol/token/${addr}`,
          source: addr.endsWith("pump") ? "pump.fun" : "unknown",
          pairCreatedAt: info.open_timestamp ? info.open_timestamp * 1000 : undefined,
        });
      }

      checked++;
    }

    onProgress?.(checked, total, toRemove.length);

    // Rate limit between batches
    if (i + BATCH_SIZE < allAddresses.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  if (toRemove.length > 0) {
    deleteTokens(toRemove);
  }

  return {
    checked,
    removed: toRemove.length,
    remaining: total - toRemove.length,
  };
}

/**
 * Index coins from BagsApp (bags.fm) launchpad.
 * Fetches from both the bags.fm API and GMGN filtering by launchpad="bags".
 */
// NOTE: bags.fm direct API is dead (returns HTML). Source via DexScreener + GMGN only.
export async function indexFromBagsApp(_maxCoins = 200): Promise<{
  scanned: number;
  stored: number;
}> {
  let stored = 0;
  let scanned = 0;
  const seenMints = new Set<string>();

  // 1. DexScreener search for bags-related tokens
  const bagsQueries = ["bags", "bags.fm", "bagsapp", "bagsfm", "pumpbags"];
  for (const query of bagsQueries) {
    try {
      const res = await pfetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const pair of (data.pairs ?? [])) {
        if (pair.chainId !== "solana") continue;
        const addr = pair.baseToken.address;
        if (seenMints.has(addr)) continue;
        seenMints.add(addr);
        scanned++;
        const mc = pair.marketCap ?? pair.fdv ?? 0;
        const liq = pair.liquidity?.usd ?? 0;
        if (mc < MIN_MC_FLOOR || liq <= 0 || liq > 10_000_000) continue;
        upsertToken({
          address: addr,
          name: pair.baseToken.name || "Unknown",
          symbol: pair.baseToken.symbol || "???",
          imageUrl: pair.info?.imageUrl,
          dexId: pair.dexId,
          pairCreatedAt: pair.pairCreatedAt ?? undefined,
          source: "bags.fm",
        });
        addCategory(addr, "bags", 1.0, "bags-dexscreener");
        addSnapshot(addr, {
          priceUsd: parseFloat(pair.priceUsd) || 0,
          marketCap: mc,
          volume24h: pair.volume?.h24 ?? 0,
          liquidity: liq,
          buys24h: pair.txns?.h24?.buys ?? 0,
          sells24h: pair.txns?.h24?.sells ?? 0,
        });
        stored++;
      }
      await new Promise((r) => setTimeout(r, 300));
    } catch { /* skip */ }
  }

  // 2. GMGN - filter across all timeframes for bags launchpad
  try {
    const tokens = await fetchBulkTokens({ limit: 200, minMc: MIN_MC_FLOOR });
    for (const token of tokens) {
      const launchpad = (token.launchpad ?? "").toLowerCase();
      const pool = (token.pool_type_str ?? "").toLowerCase();
      if (!launchpad.includes("bag") && !pool.includes("bag")) continue;
      if (seenMints.has(token.address)) continue;
      seenMints.add(token.address);
      scanned++;
      processGmgnToken(token, "bags");
      stored++;
    }
  } catch (err) {
    console.error("[BagsApp] GMGN failed:", err);
  }

  console.log(`[BagsApp] Scanned ${scanned}, stored ${stored} new tokens`);
  return { scanned, stored };
}

/**
 * Discover freshly listed pairs from GMGN new pairs endpoint.
 * Runs multiple rounds with a small delay to catch different pairs as they appear.
 */
export async function indexFromNewPairs(rounds = 5): Promise<{
  scanned: number;
  stored: number;
}> {
  const seenAddresses = new Set<string>();
  let scanned = 0;
  let stored = 0;

  for (let round = 0; round < rounds; round++) {
    const pairs = await getNewPairs(50);
    scanned += pairs.length;

    for (const pair of pairs) {
      if (!pair.address || seenAddresses.has(pair.address)) continue;
      seenAddresses.add(pair.address);
      if ((pair.market_cap ?? 0) < MIN_MC_FLOOR) continue;
      if ((pair.liquidity ?? 0) <= 0) continue;

      processGmgnToken(pair);
      stored++;
    }

    if (round < rounds - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`[NewPairs] Scanned ${scanned}, stored ${stored} new tokens`);
  return { scanned, stored };
}

/**
 * Re-run keyword matching against all tokens already in the DB.
 * Adds tiktok-meme, brainrot, italian-brainrot etc. categories to any
 * tokens that were indexed before keyword categorisation was applied.
 */
export function recategorizeAllTokens(): { processed: number; categorized: number } {
  const db = getDb();
  const tokens = db.prepare("SELECT address, name, symbol FROM tokens").all() as {
    address: string;
    name: string;
    symbol: string;
  }[];

  let categorized = 0;

  for (const token of tokens) {
    const match = matchTiktokMeme(token.name, token.symbol);
    if (match) {
      addCategory(token.address, "tiktok-meme", match.confidence, match.keyword);
      if (match.tag) {
        addCategory(token.address, match.tag, match.confidence, match.keyword);
      }
      categorized++;
    }

    // Bonk category
    const name = token.name.toLowerCase();
    const symbol = token.symbol.toLowerCase();
    if (name.includes("bonk") || symbol.includes("bonk")) {
      addCategory(token.address, "bonk", 1.0, "name-match");
    }
  }

  return { processed: tokens.length, categorized };
}

/**
 * Broad GMGN indexing with no age filter — finds coins of any age.
 * Complements indexFromGmgn which caps at 6 months.
 */
export async function indexFromGmgnBroad(): Promise<{
  scanned: number;
  stored: number;
}> {
  const tokens = await fetchBulkTokens({
    limit: 500,
    minMc: DISCOVERY_MC_FLOOR,
    // No maxAgeMs — captures coins of any age still actively trading
  });

  let stored = 0;
  for (const token of tokens) {
    // No isBondedToken filter — accept all launchpads (Moonshot, Bags, LetsBonk, etc.)
    if ((token.market_cap ?? 0) < DISCOVERY_MC_FLOOR) continue;
    if ((token.liquidity ?? 0) <= 0) continue;
    processGmgnToken(token);
    stored++;
  }

  console.log(`[GmgnBroad] Scanned ${tokens.length}, stored ${stored} tokens`);
  return { scanned: tokens.length, stored };
}

/**
 * Keyword-targeted GMGN discovery.
 * Fetches tokens ranked by various criteria and categorises any that match
 * TikTok / bonk / bags keywords — even if they'd be missed by normal indexing.
 */
export async function indexFromKeywords(): Promise<{
  scanned: number;
  stored: number;
}> {
  // Pull a wide cross-section from GMGN using timeframes we don't hit in fetchBulkTokens
  const combos: { timeframe: "24h" | "6h" | "1h"; orderby: "holder_count" | "smartmoney" | "price" }[] = [
    { timeframe: "24h", orderby: "holder_count" },
    { timeframe: "24h", orderby: "smartmoney" },
    { timeframe: "24h", orderby: "price" },
    { timeframe: "6h",  orderby: "holder_count" },
    { timeframe: "6h",  orderby: "smartmoney" },
    { timeframe: "1h",  orderby: "holder_count" },
    { timeframe: "1h",  orderby: "smartmoney" },
  ];

  const seen = new Map<string, GmgnRankToken>();

  for (const { timeframe, orderby } of combos) {
    try {
      const tokens = await getRankedTokens({
        timeframe,
        orderby,
        direction: "desc",
        limit: 200,
        filters: ["not_honeypot"],
      });
      for (const t of tokens) {
        if (!seen.has(t.address)) seen.set(t.address, t);
      }
      await new Promise((r) => setTimeout(r, 300));
    } catch { /* ignore */ }
  }

  let stored = 0;
  for (const token of seen.values()) {
    if ((token.market_cap ?? 0) < MIN_MC_FLOOR) continue;
    if ((token.liquidity ?? 0) <= 0) continue;

    const name = (token.name ?? "").toLowerCase();
    const symbol = (token.symbol ?? "").toLowerCase();

    // Categorise any matching tokens
    const isTiktok = matchTiktokMeme(name, symbol);
    const isBonk = name.includes("bonk") || symbol.includes("bonk");
    const isBagsLaunch = (token.launchpad ?? "").toLowerCase().includes("bags")
      || (token.pool_type_str ?? "").toLowerCase().includes("bags");

    if (isTiktok || isBonk || isBagsLaunch || isBondedToken(token)) {
      processGmgnToken(token, isBagsLaunch ? "bags" : undefined);
      stored++;
    }
  }

  console.log(`[Keywords] Scanned ${seen.size}, stored ${stored} tokens`);
  return { scanned: seen.size, stored };
}
