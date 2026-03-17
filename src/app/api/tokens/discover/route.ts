import { NextRequest, NextResponse } from "next/server";
import { getDiscoverTokens } from "@/lib/tokens";
import { GmgnOrderBy } from "@/lib/gmgn";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const launchpads = sp.getAll("launchpad");
  const poolTypes = sp.getAll("pool");
  const categories = sp.getAll("category");
  const minMc = sp.get("minMc") ? parseFloat(sp.get("minMc")!) : undefined;
  const maxMc = sp.get("maxMc") ? parseFloat(sp.get("maxMc")!) : undefined;
  const maxAgeHours = sp.get("maxAge") ? parseFloat(sp.get("maxAge")!) : undefined;
  const minAgeHours = sp.get("minAge") ? parseFloat(sp.get("minAge")!) : undefined;
  const sortBy = (sp.get("sortBy") as GmgnOrderBy) || "marketcap";
  const sortDir = (sp.get("sortDir") as "asc" | "desc") || "desc";

  try {
    const tokens = await getDiscoverTokens({
      launchpads,
      poolTypes,
      categories,
      minMc,
      maxMc,
      maxAgeHours,
      minAgeHours,
      sortBy,
      sortDir,
    });
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Discover tokens error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
