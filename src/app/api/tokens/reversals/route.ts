import { NextResponse } from "next/server";
import { getReversalCoins } from "@/lib/dexscreener";

export async function GET() {
  try {
    const tokens = await getReversalCoins();
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Reversal coins error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reversal coins" },
      { status: 500 }
    );
  }
}
