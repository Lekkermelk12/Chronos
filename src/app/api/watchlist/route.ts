import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import {
  getWatchlistAddresses,
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/db";

export const dynamic = "force-dynamic";

async function getSessionId(): Promise<string> {
  const store = await cookies();
  return store.get("chronos_session")?.value ?? randomUUID();
}

function sessionResponse<T>(body: T, sessionId: string): NextResponse {
  const res = NextResponse.json(body);
  res.cookies.set("chronos_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return res;
}

// GET /api/watchlist — return all watched addresses for this session
export async function GET() {
  const sessionId = await getSessionId();
  const addresses = getWatchlistAddresses(sessionId);
  return sessionResponse({ addresses }, sessionId);
}

// POST /api/watchlist — add an address
export async function POST(request: Request) {
  const sessionId = await getSessionId();
  let address: string | undefined;
  try {
    const body = await request.json();
    address = body.address;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!address || typeof address !== "string" || address.length < 32) {
    return NextResponse.json({ error: "Valid address required" }, { status: 400 });
  }
  addToWatchlist(sessionId, address);
  return sessionResponse({ ok: true }, sessionId);
}

// DELETE /api/watchlist — remove an address
export async function DELETE(request: Request) {
  const sessionId = await getSessionId();
  let address: string | undefined;
  try {
    const body = await request.json();
    address = body.address;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }
  removeFromWatchlist(sessionId, address);
  return sessionResponse({ ok: true }, sessionId);
}
