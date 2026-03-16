import { NextResponse } from "next/server";
import { getOldCoins, enrichWithSafety } from "@/lib/tokens";

export async function GET() {
  try {
    let tokens = await getOldCoins();
    tokens = await enrichWithSafety(tokens);
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Old coins error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
