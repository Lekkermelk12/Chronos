import { getTokenAddressesByCategory } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cat: string }> }
) {
  const { cat } = await params;
  const allowed = ["tiktok-meme", "migrated", "bonk", "bags", "github"];
  if (!allowed.includes(cat)) {
    return Response.json({ error: "unknown category" }, { status: 400 });
  }

  const addresses = getTokenAddressesByCategory(cat);
  return Response.json({ addresses });
}
