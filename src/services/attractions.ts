import type { Attraction, LatLng } from "../types";
import { haversineKm } from "../utils/geo";
import { queryOverpass } from "./overpass";

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

export async function fetchAttractionsNear(
  point: LatLng,
  radiusM = 20000,
  limit = 6,
): Promise<Attraction[]> {
  const query = buildQuery(point, radiusM);
  const data = await queryOverpass(query);
  const elements = data.elements ?? [];

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
