import { NextRequest, NextResponse } from "next/server";
import { searchTokens, getTokenPairs } from "@/lib/dexscreener";
import { searchTokensByNameOrSymbol } from "@/lib/db";
import { TokenData } from "@/types/token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  try {
    // 1. Search the local DB for matching tokens
    const dbMatches = searchTokensByNameOrSymbol(query);
    const dbAddresses = dbMatches.map((t) => t.address);

    // 2. Fetch live data from GMGN for DB matches
    const dbTokens: TokenData[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < dbAddresses.length; i += BATCH_SIZE) {
      const batch = dbAddresses.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (addr) => {
          const pairs = await getTokenPairs(addr);
          if (pairs.length === 0) return null;
          return pairs.sort((a, b) => b.liquidity - a.liquidity)[0];
        })
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          dbTokens.push(result.value);
        }
      }
    }

    // 3. Also search GMGN ranking for tokens not in our DB
    let gmgnTokens: TokenData[] = [];
    try {
      gmgnTokens = await searchTokens(query);
    } catch {
      // GMGN search can fail, that's fine — we have DB results
    }

    // 4. Merge and deduplicate (DB results first)
    const seen = new Set<string>();
    const merged: TokenData[] = [];

    for (const token of dbTokens) {
      if (!seen.has(token.address)) {
        seen.add(token.address);
        merged.push(token);
      }
    }
    for (const token of gmgnTokens) {
      if (!seen.has(token.address)) {
        seen.add(token.address);
        merged.push(token);
      }
    }

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
