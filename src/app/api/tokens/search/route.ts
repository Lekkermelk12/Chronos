import { NextRequest, NextResponse } from "next/server";
import { searchTokens, pairToTokenData, storeMigratedPair } from "@/lib/dexscreener";
import { searchTokensByNameOrSymbol } from "@/lib/db";
import { pfetch } from "@/lib/fetch";
import { DexScreenerPair, TokenData } from "@/types/token";

export const dynamic = "force-dynamic";

const DEXSCREENER_BASE = "https://api.dexscreener.com";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  try {
    // 1. Search the local DB for matching tokens (name, symbol, address)
    const dbMatches = searchTokensByNameOrSymbol(query);
    const dbAddresses = dbMatches.map((t) => t.address);

    // 2. Fetch live data from DexScreener for DB matches
    const dbTokens: TokenData[] = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < dbAddresses.length; i += BATCH_SIZE) {
      const batch = dbAddresses.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (addr) => {
          const res = await pfetch(`${DEXSCREENER_BASE}/tokens/v1/solana/${addr}`);
          if (!res.ok) return null;
          const pairs: DexScreenerPair[] = await res.json();
          if (!pairs || pairs.length === 0) return null;

          const MAX_LIQ = 10_000_000;
          const best = pairs
            .filter((p) => {
              const dex = p.dexId?.toLowerCase() ?? "";
              const liq = p.liquidity?.usd ?? 0;
              return p.chainId === "solana" &&
                (dex.includes("raydium") || dex.includes("pumpswap")) &&
                liq > 0 && liq <= MAX_LIQ;
            })
            .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
            ?? pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];

          if (!best) return null;
          storeMigratedPair(best);
          return pairToTokenData(best);
        })
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          dbTokens.push(result.value);
        }
      }
    }

    // 3. Also search DexScreener API directly for tokens not in our DB
    let dexTokens: TokenData[] = [];
    try {
      dexTokens = await searchTokens(query);
    } catch {
      // DexScreener search can fail, that's fine — we have DB results
    }

    // 4. Merge and deduplicate (DB results first since they're our indexed coins)
    const seen = new Set<string>();
    const merged: TokenData[] = [];

    for (const token of dbTokens) {
      if (!seen.has(token.address)) {
        seen.add(token.address);
        merged.push(token);
      }
    }
    for (const token of dexTokens) {
      if (!seen.has(token.address)) {
        seen.add(token.address);
        merged.push(token);
      }
    }

    // Sort by market cap
    merged.sort((a, b) => b.marketCap - a.marketCap);

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search tokens" },
      { status: 500 }
    );
  }
}
