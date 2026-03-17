/**
 * TikTok meme keywords and patterns for auto-categorizing tokens.
 *
 * These are organized by confidence level:
 * - HIGH (1.0): Very specific TikTok/brainrot meme terms
 * - MEDIUM (0.7): Terms commonly associated with TikTok memes but could appear elsewhere
 * - LOW (0.5): Broad cultural terms that lean TikTok but aren't exclusive
 */

interface KeywordEntry {
  pattern: RegExp;
  confidence: number;
  tag?: string; // optional sub-tag for the meme
}

// Italian brainrot / surreal memes
const ITALIAN_BRAINROT: KeywordEntry[] = [
  { pattern: /bombardino/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /tralalero/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /tung\s*tung/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /sahur/i, confidence: 0.8, tag: "italian-brainrot" },
  { pattern: /lirili/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /larila/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /brr\s*brr\s*patapim/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /patapim/i, confidence: 0.9, tag: "italian-brainrot" },
  { pattern: /crocodilo/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /cocofanto/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /cappuccino\s*assassino/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /bobritto\s*bandito/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /spaghetti/i, confidence: 0.4, tag: "italian-brainrot" },
  { pattern: /bombombini/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /glorbo/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /chimpanzini/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /frulli\s*frulla/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /ballerina\s*cappuccina/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /frigo\s*camion/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /gusini/i, confidence: 0.9, tag: "italian-brainrot" },
  { pattern: /saturnita/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /tropicana.*banana/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /burbaloni/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /lirilì/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /larilà/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /tralalà/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /tralala/i, confidence: 0.8, tag: "italian-brainrot" },
  { pattern: /crocofanto/i, confidence: 1.0, tag: "italian-brainrot" },
  { pattern: /pianissimo/i, confidence: 0.6, tag: "italian-brainrot" },
];

// Classic brainrot terms
const BRAINROT_CORE: KeywordEntry[] = [
  { pattern: /brainrot/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /brain\s*rot/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /skibidi/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /gyatt/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /rizz/i, confidence: 0.9, tag: "brainrot" },
  { pattern: /rizzler/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /sigma/i, confidence: 0.7, tag: "brainrot" },
  { pattern: /ohio/i, confidence: 0.6, tag: "brainrot" },
  { pattern: /fanum\s*tax/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /nuh\s*uh/i, confidence: 0.9, tag: "brainrot" },
  { pattern: /erm\s*what/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /what\s*the\s*sigma/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /mewing/i, confidence: 0.9, tag: "brainrot" },
  { pattern: /mogger/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /mogged/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /mogging/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /looksmax/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /maxxing/i, confidence: 0.9, tag: "brainrot" },
  { pattern: /jestermaxxing/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /aura/i, confidence: 0.5, tag: "brainrot" },
  { pattern: /npc/i, confidence: 0.6, tag: "brainrot" },
  { pattern: /slay/i, confidence: 0.4, tag: "brainrot" },
  { pattern: /bussin/i, confidence: 0.8, tag: "brainrot" },
  { pattern: /no\s*cap/i, confidence: 0.7, tag: "brainrot" },
  { pattern: /goated/i, confidence: 0.7, tag: "brainrot" },
  { pattern: /based/i, confidence: 0.5, tag: "brainrot" },
  { pattern: /delulu/i, confidence: 0.9, tag: "brainrot" },
  { pattern: /sus\b/i, confidence: 0.5, tag: "brainrot" },
  { pattern: /amogus/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /opium\s*bird/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /talking\s*object/i, confidence: 1.0, tag: "brainrot" },
  { pattern: /nietzsche/i, confidence: 0.7, tag: "brainrot" },
];

// TikTok-specific viral memes and trends
const TIKTOK_VIRAL: KeywordEntry[] = [
  { pattern: /tiktok/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /tik\s*tok/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /viral/i, confidence: 0.6, tag: "tiktok-viral" },
  { pattern: /chill\s*guy/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /hawk\s*tuah/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /griddy/i, confidence: 0.9, tag: "tiktok-viral" },
  { pattern: /demure/i, confidence: 0.8, tag: "tiktok-viral" },
  { pattern: /brat/i, confidence: 0.5, tag: "tiktok-viral" },
  { pattern: /very\s*mindful/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /city\s*boy/i, confidence: 0.8, tag: "tiktok-viral" },
  { pattern: /dagestan/i, confidence: 0.7, tag: "tiktok-viral" },
  { pattern: /larp/i, confidence: 0.6, tag: "tiktok-viral" },
  { pattern: /meowl/i, confidence: 0.9, tag: "tiktok-viral" },
  { pattern: /penguin/i, confidence: 0.4, tag: "tiktok-viral" },
  { pattern: /skeleton.*shield/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /raaaaah/i, confidence: 0.9, tag: "tiktok-viral" },
  { pattern: /nosey/i, confidence: 0.6, tag: "tiktok-viral" },
  { pattern: /hezi/i, confidence: 0.7, tag: "tiktok-viral" },
  { pattern: /ascend/i, confidence: 0.5, tag: "tiktok-viral" },
  { pattern: /agartha/i, confidence: 0.7, tag: "tiktok-viral" },
  { pattern: /johnny\b/i, confidence: 0.3, tag: "tiktok-viral" },
  { pattern: /goy\b/i, confidence: 0.5, tag: "tiktok-viral" },
  { pattern: /just\s*can.*prove/i, confidence: 0.9, tag: "tiktok-viral" },
  { pattern: /lowkirkenuinely/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /roman\s*empire/i, confidence: 0.7, tag: "tiktok-viral" },
  { pattern: /all\s*roads\s*lead/i, confidence: 0.8, tag: "tiktok-viral" },
  { pattern: /rolling\s*with\s*milly/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /dreamybull/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /kai\s*cenat/i, confidence: 0.9, tag: "tiktok-viral" },
  { pattern: /speed\b/i, confidence: 0.3, tag: "tiktok-viral" },
  { pattern: /baby\s*gronk/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /livvy\s*dunne/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /grimace/i, confidence: 0.7, tag: "tiktok-viral" },
  { pattern: /quandale/i, confidence: 1.0, tag: "tiktok-viral" },
  { pattern: /dingle/i, confidence: 0.8, tag: "tiktok-viral" },
  { pattern: /bingus/i, confidence: 0.9, tag: "tiktok-viral" },
  { pattern: /floppa/i, confidence: 0.9, tag: "tiktok-viral" },
];

// Search queries to use when discovering new TikTok meme tokens
export const TIKTOK_SEARCH_QUERIES = [
  // Italian brainrot
  "bombardino", "tralalero", "tung tung", "brr patapim", "crocodilo",
  // Brainrot core
  "brainrot", "skibidi", "mogged", "maxxing", "jester", "mewing",
  "sigma", "gyatt", "rizz", "npc", "amogus",
  // TikTok viral
  "tiktok", "viral meme", "chill guy", "hawk tuah", "opium bird",
  "talking objects", "skeleton shield", "meowl", "dagestan",
  "nietzsche penguin", "city boy",
  // Broad meme culture
  "brainrot solana", "meme viral", "tiktok meme",
];

export const ALL_KEYWORDS: KeywordEntry[] = [
  ...ITALIAN_BRAINROT,
  ...BRAINROT_CORE,
  ...TIKTOK_VIRAL,
];

/**
 * Check if a token name/symbol matches TikTok meme patterns.
 * Returns the best match (highest confidence) or null.
 */
export function matchTiktokMeme(name: string, symbol: string): {
  confidence: number;
  keyword: string;
  tag: string;
} | null {
  const text = `${name} ${symbol}`.toLowerCase();
  let bestMatch: { confidence: number; keyword: string; tag: string } | null = null;

  for (const entry of ALL_KEYWORDS) {
    if (entry.pattern.test(text)) {
      if (!bestMatch || entry.confidence > bestMatch.confidence) {
        bestMatch = {
          confidence: entry.confidence,
          keyword: entry.pattern.source,
          tag: entry.tag ?? "tiktok-meme",
        };
      }
    }
  }

  return bestMatch;
}
