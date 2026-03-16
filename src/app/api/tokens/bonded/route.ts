import { NextRequest, NextResponse } from "next/server";
import { getTokenAddressesByCategoryAfter } from "@/lib/db";
import { getTokenPairs } from "@/lib/tokens";
import { TokenData } from "@/types/token";

export const dynamic = "force-dynamic";

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") ?? "50")));

    const sixMonthsAgo = Date.now() - SIX_MONTHS_MS;

    // Get migrated (bonded) addresses created in the last 6 months
    const addresses = getTokenAddressesByCategoryAfter("migrated", sixMonthsAgo);
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

    // Fetch live data from GMGN for this page
    const allTokens: TokenData[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < pageAddresses.length; i += BATCH_SIZE) {
      const batch = pageAddresses.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (addr) => {
          const pairs = await getTokenPairs(addr);
          if (pairs.length === 0) return null;
          const best = pairs.sort((a, b) => b.liquidity - a.liquidity)[0];
          return best.liquidity > 0 ? best : null;
        })
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          allTokens.push(result.value);
        }
      }

      // Rate limit
      if (i + BATCH_SIZE < pageAddresses.length) {
        await new Promise((r) => setTimeout(r, 300));
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
