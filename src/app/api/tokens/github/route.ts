import { NextResponse } from "next/server";
import { getGithubCoins } from "@/lib/dexscreener";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tokens = await getGithubCoins();
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("GitHub coins error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
