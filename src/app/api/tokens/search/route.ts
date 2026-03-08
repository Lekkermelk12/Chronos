import { NextRequest, NextResponse } from "next/server";
import { searchTokens } from "@/lib/dexscreener";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  try {
    const tokens = await searchTokens(query);
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search tokens" },
      { status: 500 }
    );
  }
}
