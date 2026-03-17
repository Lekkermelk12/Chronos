import {
  getReversalCoins,
  getTiktokCoins,
  getOldCoins,
  getGithubCoins,
  getBonkCoins,
  getBagsCoins,
} from "@/lib/tokens";
import { TokenData } from "@/types/token";

export const dynamic = "force-dynamic";

type DataTab = "reversals" | "tiktok" | "old" | "github" | "bonk" | "bags";

async function getTabData(tab: DataTab): Promise<TokenData[]> {
  switch (tab) {
    case "reversals": return getReversalCoins();
    case "tiktok":    return getTiktokCoins();
    case "old":       return getOldCoins();
    case "github":    return getGithubCoins();
    case "bonk":      return getBonkCoins();
    case "bags":      return getBagsCoins();
    default:          return [];
  }
}

const VALID_TABS: DataTab[] = ["reversals", "tiktok", "old", "github", "bonk", "bags"];
const POLL_INTERVAL_MS = 20_000; // 20s — faster than the old 45s client polling

/**
 * GET /api/stream?tab=reversals
 *
 * Server-Sent Events endpoint. Sends the current token list immediately on
 * connect, then re-fetches and pushes updates every 20 seconds.
 * The client replaces its polling interval with this persistent connection.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") as DataTab | null;

  if (!tab || !VALID_TABS.includes(tab)) {
    return new Response("tab param required (reversals|tiktok|old|github|bonk|bags)", {
      status: 400,
    });
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Helper that fetches data and sends it, swallowing errors gracefully
      const refresh = async () => {
        try {
          const tokens = await getTabData(tab);
          send({ tokens, timestamp: Date.now(), tab });
        } catch (err) {
          send({ error: String(err), timestamp: Date.now(), tab });
        }
      };

      // Send initial data immediately
      await refresh();

      // Schedule recurring refreshes
      const schedule = () => {
        if (closed) return;
        timer = setTimeout(async () => {
          await refresh();
          schedule(); // re-schedule after each fetch completes
        }, POLL_INTERVAL_MS);
      };
      schedule();

      // Clean up when client disconnects
      request.signal.addEventListener("abort", () => {
        closed = true;
        if (timer) clearTimeout(timer);
        try { controller.close(); } catch { /* already closed */ }
      });
    },

    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering for SSE
    },
  });
}
