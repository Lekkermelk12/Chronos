import { NextResponse } from "next/server";
import { insertReversalAlert, upsertToken } from "@/lib/db";
import { getTokenData } from "@/lib/gmgn";

export const dynamic = "force-dynamic";

// Optional shared secret set in the Helius webhook dashboard
const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET ?? "";

// Deduplicate events — prevent processing the same tx twice if Helius
// delivers it more than once (they guarantee at-least-once delivery).
const processedSignatures = new Set<string>();
const MAX_SIG_CACHE = 1000;

interface HeliusWebhookEvent {
  signature: string;
  type: string;
  source?: string;
  description?: string;
  timestamp?: number;
  slot?: number;
  tokenTransfers?: Array<{
    mint: string;
    fromUserAccount?: string;
    toUserAccount?: string;
    tokenAmount: number;
  }>;
  accountData?: Array<{ account: string }>;
}

/**
 * POST /api/webhooks/helius
 *
 * Receives enhanced webhook events from Helius.
 * Currently handles SWAP / BUY / SELL events from pump.fun AMM to detect
 * on-chain reversal signals and persist them as alerts.
 *
 * Set up via: POST https://api.helius.xyz/v0/webhooks?api-key=YOUR_KEY
 *   webhookURL: https://your-domain.com/api/webhooks/helius
 *   transactionTypes: ["SWAP", "BUY", "SELL"]
 *   accountAddresses: [pump AMM or token addresses to watch]
 *   webhookType: "enhanced"
 */
export async function POST(request: Request) {
  // Verify shared secret if configured
  if (WEBHOOK_SECRET) {
    const authHeader = request.headers.get("authorization") ?? "";
    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    if (provided !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let events: HeliusWebhookEvent[];
  try {
    events = await request.json();
    if (!Array.isArray(events)) events = [events];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Respond 200 immediately — process async to avoid Helius timeout
  processEvents(events).catch((err) =>
    console.error("[Webhook] Processing error:", err)
  );

  return NextResponse.json({ ok: true });
}

async function processEvents(events: HeliusWebhookEvent[]) {
  for (const event of events) {
    // Deduplicate
    if (processedSignatures.has(event.signature)) continue;
    processedSignatures.add(event.signature);
    if (processedSignatures.size > MAX_SIG_CACHE) {
      // Evict oldest entries to keep memory bounded
      const first = processedSignatures.values().next().value;
      if (first) processedSignatures.delete(first);
    }

    const type = event.type ?? "";
    if (!["SWAP", "BUY", "SELL"].includes(type)) continue;

    // Extract token mint address from token transfers
    const mint = event.tokenTransfers?.[0]?.mint;
    if (!mint) continue;

    // Skip failed txns (transactionError would be non-null but Helius filters
    // by default — still guard here)
    if (!event.signature) continue;

    console.log(`[Webhook] ${type} on ${mint} — sig: ${event.signature.slice(0, 12)}…`);

    // Fetch current token data to check if it qualifies as a reversal alert
    try {
      const info = await getTokenData(mint);
      if (!info) continue;

      // Store/update token in DB
      upsertToken({
        address: mint,
        name: info.name ?? "Unknown",
        symbol: info.symbol ?? "???",
        imageUrl: info.logo || undefined,
        dexUrl: `https://gmgn.ai/sol/token/${mint}`,
        source: "webhook",
      });

      // If liquidity > 0 and MC above threshold, check for reversal-worthy swap
      const mc = info.price && info.total_supply ? info.price * info.total_supply : 0;
      if (mc < 3500 || (info.liquidity ?? 0) <= 0) continue;

      // A large swap event on a qualifying token is interesting — store alert
      const tokenAmount = event.tokenTransfers?.[0]?.tokenAmount ?? 0;
      const swapUsd = tokenAmount * (info.price ?? 0);

      if (swapUsd >= 500) {
        // Only alert on swaps worth $500+ to reduce noise
        insertReversalAlert({
          address: mint,
          signature: event.signature,
          alertType: type.toLowerCase() as "buy" | "sell",
          description: event.description ?? `${type} of $${swapUsd.toFixed(0)} on ${info.symbol}`,
          swapAmountUsd: swapUsd,
          reversalScore: 0, // scored separately by getReversalCoins()
        });
      }
    } catch (err) {
      console.error(`[Webhook] Failed to process ${mint}:`, err);
    }
  }
}

/**
 * GET /api/webhooks/helius
 * Returns recent alerts stored from webhook events (last 5 minutes).
 */
export async function GET() {
  try {
    const { getRecentAlerts } = await import("@/lib/db");
    const alerts = getRecentAlerts(5 * 60 * 1000); // last 5 min
    return NextResponse.json({ alerts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
