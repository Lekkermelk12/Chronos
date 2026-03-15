import { NextResponse } from "next/server";
import { getGithubCoins, enrichWithSafety } from "@/lib/dexscreener";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let tokens = await getGithubCoins();
    tokens = await enrichWithSafety(tokens);
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("GitHub coins error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
