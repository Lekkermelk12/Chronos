import { NextResponse } from "next/server";
import { runFullIndex, seedDatabase, discoverNewTokens, indexGraduatedTokens } from "@/lib/indexer";
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
      result = await indexGraduatedTokens(maxPages ?? 100);
    } else {
      result = await runFullIndex();
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
