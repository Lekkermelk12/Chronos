import { NextResponse } from "next/server";
import { runFullIndex, seedDatabase, discoverNewTokens, indexFromPumpFun, indexFromGmgn, indexFromBagsApp, cleanupDeadTokens } from "@/lib/indexer";
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
    } else if (action === "gmgn") {
      result = await indexFromGmgn();
    } else if (action === "pumpfun") {
      result = await indexFromPumpFun(maxPages ? maxPages * 50 : 200);
    } else if (action === "bags") {
      result = await indexFromBagsApp(maxPages ? maxPages * 50 : 200);
    } else if (action === "cleanup") {
      result = await cleanupDeadTokens((checked, total, removed) => {
        console.log(`[Cleanup] ${checked}/${total} checked, ${removed} marked for removal`);
      });
    } else if (action === "mass") {
      // Run all indexing methods for maximum coverage
      const gmgn = await indexFromGmgn();
      const pf = await indexFromPumpFun(500);
      const bags = await indexFromBagsApp(200);
      // After indexing, cleanup dead tokens
      const cleanup = await cleanupDeadTokens();
      result = {
        gmgn,
        pumpfun: pf,
        bags,
        cleanup,
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
