import { NextResponse } from "next/server";
import { runFullIndex, seedDatabase, discoverNewTokens, indexGraduatedTokens, indexMigratedFromDexScreener, indexFromPumpFun } from "@/lib/indexer";
import { getTokenCount, getAllCategories, getLastIndexTime } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: status info
export async function GET() {
  try {
    return NextResponse.json({
      totalTokens: getTokenCount(),
      categories: getAllCategories(),
      lastIndexed: getLastIndexTime(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST: trigger indexing
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = (body as { action?: string }).action ?? "full";

    const maxPages = (body as { maxPages?: number }).maxPages;

    let result;
    if (action === "seed") {
      result = await seedDatabase();
    } else if (action === "discover") {
      result = await discoverNewTokens();
    } else if (action === "graduated") {
      result = await indexGraduatedTokens(maxPages ?? 500);
    } else if (action === "dexscreener") {
      result = await indexMigratedFromDexScreener();
    } else if (action === "pumpfun") {
      result = await indexFromPumpFun(maxPages ? maxPages * 50 : 200);
    } else if (action === "mass") {
      // Run all indexing methods for maximum coverage
      const dex = await indexMigratedFromDexScreener();
      const pf = await indexFromPumpFun(500);
      const moralis = process.env.MORALIS_API_KEY
        ? await indexGraduatedTokens(maxPages ?? 500)
        : { totalScanned: 0, aliveStored: 0, pages: 0 };
      result = {
        dexscreener: dex,
        pumpfun: pf,
        moralis,
        totalTokens: getTokenCount(),
      };
    } else {
      result = await runFullIndex();
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
