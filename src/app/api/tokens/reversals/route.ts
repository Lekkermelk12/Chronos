import { NextResponse } from "next/server";
import { getReversalCoins, enrichWithSafety } from "@/lib/tokens";

export async function GET() {
  try {
    let tokens = await getReversalCoins();
    tokens = await enrichWithSafety(tokens);
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Reversal coins error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
