import { upsertToken, addCategory, addSnapshot, getTokenCount, getDb, getAllTokenAddresses, deleteTokens } from "./db";
import { matchTiktokMeme, TIKTOK_SEARCH_QUERIES } from "./keywords";
import { GmgnRankToken, GmgnTokenInfo, getRankedTokens, getTokenData, fetchBulkTokens } from "./gmgn";

const PUMPFUN_API = "https://frontend-api-v3.pump.fun";
const PUMPFUN_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
  Origin: "https://pump.fun",
  Referer: "https://pump.fun/",
};

/** Minimum market cap floor. Coins below this are considered dead/scam. */
const MIN_MC_FLOOR = 3500;

/** Maximum age: 6 months in milliseconds */
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

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
    minMc: MIN_MC_FLOOR,
    maxAgeMs: SIX_MONTHS_MS,
  });

  let newCount = 0;
  for (const token of gmgnTokens) {
    if (seenAddresses.has(token.address)) continue;
    if (!isBondedToken(token)) continue;
    if (!isWithinAgeLimit(token.creation_timestamp)) continue;

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
 * Full index run: seed (if needed) + discover new + refresh snapshots.
 */
export async function runFullIndex(): Promise<{
  seeded: number;
  discovered: number;
  refreshed: number;
  totalTokens: number;
}> {
  let seeded = 0;
  if (getTokenCount() === 0) {
    const seedResult = await seedDatabase();
    seeded = seedResult.seeded;
  }

  const discoverResult = await discoverNewTokens();
  const refreshResult = await refreshSnapshots();

  return {
    seeded,
    discovered: discoverResult.discovered,
    refreshed: refreshResult.updated,
    totalTokens: discoverResult.total || getTokenCount(),
  };
}

/**
 * Index graduated coins from PumpFun API using all sort orders and directions.
 * Filters for bonded coins above $3.5K MC and within 6 months old.
 */
export async function indexFromPumpFun(maxCoins = 1050): Promise<{
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

          // Skip coins below MC floor
          if ((coin.usd_market_cap ?? 0) < MIN_MC_FLOOR) continue;

          // Skip coins older than 6 months
          if (coin.created_timestamp) {
            const ageMs = now - coin.created_timestamp * 1000;
            if (ageMs > SIX_MONTHS_MS) continue;
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
    minMc: MIN_MC_FLOOR,
    maxAgeMs: SIX_MONTHS_MS,
  });

  let stored = 0;
  for (const token of tokens) {
    if (!isBondedToken(token)) continue;
    if (!isWithinAgeLimit(token.creation_timestamp)) continue;

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

const BAGS_API = "https://bags.fm";
const BAGS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://bags.fm",
  Referer: "https://bags.fm/",
};

interface BagsCoin {
  mint: string;
  name: string;
  symbol: string;
  image_uri?: string;
  usd_market_cap?: number;
  created_timestamp?: number;
  complete?: boolean;
}

/**
 * Index coins from BagsApp (bags.fm) launchpad.
 * Fetches from both the bags.fm API and GMGN filtering by launchpad="bags".
 */
export async function indexFromBagsApp(maxCoins = 200): Promise<{
  scanned: number;
  stored: number;
}> {
  let stored = 0;
  let scanned = 0;
  const PAGE_SIZE = 50;
  const seenMints = new Set<string>();
  const now = Date.now();

  const bagsSortCombos = [
    "market_cap&order=desc",
    "market_cap&order=asc",
    "created_timestamp&order=desc",
    "created_timestamp&order=asc",
  ];

  // 1. Fetch from bags.fm API across multiple sort orders
  for (const sortCombo of bagsSortCombos) {
  for (let offset = 0; offset < maxCoins; offset += PAGE_SIZE) {
    try {
      const res = await fetch(
        `${BAGS_API}/api/coins?limit=${PAGE_SIZE}&offset=${offset}&sort=${sortCombo}`,
        { headers: BAGS_HEADERS }
      );
      if (!res.ok) break;
      const raw = await res.json();
      const coins: BagsCoin[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.coins) ? raw.coins : []);
      if (coins.length === 0) break;
      scanned += coins.length;

      for (const coin of coins) {
        if (!coin.mint || seenMints.has(coin.mint)) continue;
        seenMints.add(coin.mint);
        if ((coin.usd_market_cap ?? 0) < MIN_MC_FLOOR) continue;
        if (coin.created_timestamp) {
          const ageMs = now - coin.created_timestamp * 1000;
          if (ageMs > SIX_MONTHS_MS) continue;
        }

        upsertToken({
          address: coin.mint,
          name: coin.name || "Unknown",
          symbol: coin.symbol || "???",
          imageUrl: coin.image_uri ?? undefined,
          source: "bags.fm",
        });
        addCategory(coin.mint, "bags", 1.0, "bags-api");
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
  } // end sortCombo loop

  // 2. GMGN fallback - filter by launchpad containing "bags"
  try {
    const { fetchBulkTokens: bulkFetch } = await import("./gmgn");
    const tokens = await bulkFetch({ limit: 500, minMc: MIN_MC_FLOOR });
    for (const token of tokens) {
      const launchpad = (token.launchpad ?? "").toLowerCase();
      const pool = (token.pool_type_str ?? "").toLowerCase();
      if (!launchpad.includes("bags") && !pool.includes("bags")) continue;
      if (seenMints.has(token.address)) continue;
      seenMints.add(token.address);
      scanned++;

      processGmgnToken(token, "bags");
      stored++;
    }
  } catch (err) {
    console.error("[BagsApp] GMGN fallback failed:", err);
  }

  console.log(`[BagsApp] Scanned ${scanned}, stored ${stored} new tokens`);
  return { scanned, stored };
}
