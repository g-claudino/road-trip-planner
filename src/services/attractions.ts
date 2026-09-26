import type { Attraction, LatLng } from "../types";
import { haversineKm } from "../utils/geo";

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

const TOURISM_VALUES = "attraction|viewpoint|museum|zoo|theme_park|gallery|artwork";

function buildQuery(point: LatLng, radiusM: number): string {
  const { lat, lng } = point;
  return `
    [out:json][timeout:25];
    (
      node["tourism"~"${TOURISM_VALUES}"](around:${radiusM},${lat},${lng});
      node["historic"](around:${radiusM},${lat},${lng});
      node["natural"="waterfall"](around:${radiusM},${lat},${lng});
    );
    out body ${40};
  `;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryOverpass(query: string): Promise<unknown> {
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

export async function fetchAttractionsNear(
  point: LatLng,
  radiusM = 20000,
  limit = 6,
): Promise<Attraction[]> {
  const query = buildQuery(point, radiusM);
  const data = (await queryOverpass(query)) as { elements?: unknown[] };

  const elements = (data.elements ?? []) as Array<{
    id: number;
    lat: number;
    lon: number;
    tags?: Record<string, string>;
  }>;

  const attractions: Attraction[] = elements
    .filter((el) => el.tags?.name)
    .map((el) => {
      const tags = el.tags!;
      const category =
        tags.tourism ?? tags.historic ?? tags.natural ?? "attraction";
      return {
        id: el.id,
        name: tags.name,
        category: category.replace(/_/g, " "),
        lat: el.lat,
        lng: el.lon,
        distanceKm: haversineKm(point, { lat: el.lat, lng: el.lon }),
      };
    });

  const seen = new Set<number>();
  const deduped = attractions.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  deduped.sort((a, b) => a.distanceKm - b.distanceKm);

  return deduped.slice(0, limit);
}
