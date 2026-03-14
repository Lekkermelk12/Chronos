import { NextResponse } from "next/server";
import { getMigratedCoins } from "@/lib/dexscreener";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tokens = await getMigratedCoins();
    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Migrated coins error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
