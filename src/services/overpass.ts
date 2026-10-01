const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Plain fetch() has no timeout of its own — if a mirror is unresponsive
// (rather than cleanly returning 429/504), a call can hang far longer than
// racing the other mirrors would. Bound each attempt so a dead mirror can't
// stall the whole lookup.
const REQUEST_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url: string, body: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Overpass query failed: ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export interface OverpassElement {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

/**
 * Queries all Overpass mirrors at once and uses whichever responds first,
 * instead of trying them one at a time — a mirror that is merely slow (not
 * fully dead) no longer adds its full timeout to the wait on top of the
 * others. Retries the whole round, with backoff, if every mirror fails
 * (e.g. everyone is rate-limiting at once).
 */
export async function queryOverpass(query: string): Promise<{ elements?: OverpassElement[] }> {
  const maxRounds = 2;
  const body = `data=${encodeURIComponent(query)}`;

  for (let round = 1; round <= maxRounds; round++) {
    try {
      const res = await Promise.any(OVERPASS_MIRRORS.map((url) => fetchWithTimeout(url, body)));
      return res.json();
    } catch {
      if (round === maxRounds) {
        throw new Error("Overpass query failed (the free lookup service may be busy).");
      }
      await sleep(1000 * round);
    }
  }

  throw new Error("Overpass query failed after retries");
}
