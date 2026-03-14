import { NextResponse } from "next/server";
import { getTrendingTokens } from "@/lib/dexscreener";

export async function GET() {
  try {
    const tokens = await getTrendingTokens();
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Trending tokens error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
