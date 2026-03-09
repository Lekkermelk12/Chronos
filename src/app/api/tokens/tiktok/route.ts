import { NextResponse } from "next/server";
import { getTiktokCoins } from "@/lib/dexscreener";

export async function GET() {
  try {
    const tokens = await getTiktokCoins();
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("TikTok coins error:", error);
    return NextResponse.json(
      { error: "Failed to fetch TikTok coins" },
      { status: 500 }
    );
  }
}
