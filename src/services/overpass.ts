const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

let mirrorIndex = 0;
function nextMirror(): string {
  const url = OVERPASS_MIRRORS[mirrorIndex % OVERPASS_MIRRORS.length];
  mirrorIndex++;
  return url;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface OverpassElement {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export async function queryOverpass(query: string): Promise<{ elements?: OverpassElement[] }> {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(nextMirror(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (res.ok) {
      return res.json();
    }

    const retryable = res.status === 429 || res.status === 504;
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`Overpass query failed: ${res.status}`);
    }

    await sleep(1000 * attempt);
  }

  throw new Error("Overpass query failed after retries");
}
