import type { LatLng } from "../types";
import { haversineKm } from "../utils/geo";
import { queryOverpass } from "./overpass";

export interface CityCandidate {
  id: number;
  name: string;
  placeType: string;
  lat: number;
  lng: number;
  distanceKm: number;
  population: number | null;
}

const PLACE_RANK: Record<string, number> = { city: 0, town: 1, village: 2 };

// A circular Overpass "around" search costs roughly the area scanned — an
// 100km radius (25x the area of a 20km one) reliably times out on the free
// mirrors. Measured empirically: 50-70km stays under ~3s, so cap there.
export const MAX_CITY_SEARCH_RADIUS_KM = 70;

// Villages vastly outnumber towns/cities, and including them turns a
// wide-radius search (e.g. 10% of a 1000km stop interval = 100km) into a
// query the free Overpass mirrors can't finish before timing out. Only
// widen to villages for a tight radius, where the extra nodes are cheap.
function placeFilter(radiusKm: number): string {
  return radiusKm <= 25 ? "city|town|village" : "city|town";
}

function buildQuery(point: LatLng, radiusM: number, radiusKm: number): string {
  const { lat, lng } = point;
  return `
    [out:json][timeout:20];
    (
      node["place"~"^(${placeFilter(radiusKm)})$"](around:${radiusM},${lat},${lng});
    );
    out body 20;
  `;
}

/** Finds real towns/cities near a point — used to suggest a sensible place to
 * stop instead of an arbitrary point on the highway. */
export async function fetchNearbyCities(
  point: LatLng,
  requestedRadiusKm: number,
  limit = 8,
): Promise<CityCandidate[]> {
  const radiusKm = Math.min(requestedRadiusKm, MAX_CITY_SEARCH_RADIUS_KM);
  const query = buildQuery(point, radiusKm * 1000, radiusKm);
  const data = await queryOverpass(query);
  const elements = data.elements ?? [];

  const candidates: CityCandidate[] = elements
    .filter((el) => el.tags?.name && el.tags?.place)
    .map((el) => {
      const tags = el.tags!;
      return {
        id: el.id,
        name: tags.name,
        placeType: tags.place,
        lat: el.lat,
        lng: el.lon,
        distanceKm: haversineKm(point, { lat: el.lat, lng: el.lon }),
        population: tags.population ? parseInt(tags.population, 10) || null : null,
      };
    });

  const seen = new Set<number>();
  const deduped = candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  deduped.sort((a, b) => {
    const rankA = PLACE_RANK[a.placeType] ?? 3;
    const rankB = PLACE_RANK[b.placeType] ?? 3;
    if (rankA !== rankB) return rankA - rankB;
    return a.distanceKm - b.distanceKm;
  });

  return deduped.slice(0, limit);
}
