import { NextRequest, NextResponse } from "next/server";
import { getTokenAddressesByCategoryAfter } from "@/lib/db";
import { pairToTokenData, storeMigratedPair } from "@/lib/dexscreener";
import { pfetch } from "@/lib/fetch";
import { DexScreenerPair, TokenData } from "@/types/token";
import { indexGraduatedTokens } from "@/lib/indexer";

export const dynamic = "force-dynamic";

const DEXSCREENER_BASE = "https://api.dexscreener.com";
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") ?? "50")));

    const sixMonthsAgo = Date.now() - SIX_MONTHS_MS;

    // Get migrated (bonded) addresses created in the last 6 months
    let addresses = getTokenAddressesByCategoryAfter("migrated", sixMonthsAgo);

    // If DB is empty and Moralis key is configured, trigger initial index
    if (addresses.length === 0 && process.env.MORALIS_API_KEY) {
      console.log("[Bonded] DB empty, running initial Moralis index (5 pages)...");
      await indexGraduatedTokens(5);
      addresses = getTokenAddressesByCategoryAfter("migrated", sixMonthsAgo);
    }

    const totalCount = addresses.length;

    if (totalCount === 0) {
      return NextResponse.json({ tokens: [], total: 0, page, pageSize });
    }

    // Paginate
    const start = (page - 1) * pageSize;
    const pageAddresses = addresses.slice(start, start + pageSize);

    if (pageAddresses.length === 0) {
      return NextResponse.json({ tokens: [], total: totalCount, page, pageSize });
    }

    // Fetch live data from DexScreener
    const allTokens: TokenData[] = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < pageAddresses.length; i += BATCH_SIZE) {
      const batch = pageAddresses.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (addr) => {
          const res = await pfetch(`${DEXSCREENER_BASE}/tokens/v1/solana/${addr}`);
          if (!res.ok) return null;
          const pairs: DexScreenerPair[] = await res.json();
          if (!pairs || pairs.length === 0) return null;

          const MAX_LIQ = 10_000_000;
          const bonded = pairs
            .filter((p) => {
              const dex = p.dexId?.toLowerCase() ?? "";
              const liq = p.liquidity?.usd ?? 0;
              return p.chainId === "solana" &&
                (dex.includes("raydium") || dex.includes("pumpswap")) &&
                liq > 0 && liq <= MAX_LIQ;
            })
            .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

          const best = bonded[0] ?? pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
          if (!best) return null;
          storeMigratedPair(best);
          return pairToTokenData(best);
        })
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          allTokens.push(result.value);
        }
      }
    }

    allTokens.sort((a, b) => b.marketCap - a.marketCap);

    return NextResponse.json({
      tokens: allTokens,
      total: totalCount,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Bonded coins error:", error);
    return NextResponse.json({ tokens: [], total: 0, page: 1, pageSize: 50 }, { status: 500 });
  }
}
