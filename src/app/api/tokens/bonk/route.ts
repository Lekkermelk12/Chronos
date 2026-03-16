import { NextResponse } from "next/server";
import { getBonkCoins, enrichWithSafety } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let tokens = await getBonkCoins();
    tokens = await enrichWithSafety(tokens);
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Bonk coins error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
