import { NextResponse } from "next/server";
import { getBagsCoins } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tokens = await getBagsCoins();
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("BagsApp coins error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
