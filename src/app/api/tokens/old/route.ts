import { NextResponse } from "next/server";
import { getOldCoins } from "@/lib/dexscreener";

export async function GET() {
  try {
    const tokens = await getOldCoins();
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Old coins error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
