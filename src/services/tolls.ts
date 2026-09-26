import type { LatLng, RouteResult, TollBooth } from "../types";
import { haversineKm, nearestDistanceKmOnRoute, sampleStopsAlongRoute } from "../utils/geo";
import { queryOverpass } from "./overpass";

// A real toll plaza is usually mapped in OSM as several separate
// `barrier=toll_booth` nodes: one per lane, and often a separate structure
// per direction on a divided highway a couple of km apart. Without
// clustering, a single plaza could be counted (and charged) many times
// over. Overcounting a phantom toll is worse than merging two that happen
// to be genuinely close, so this errs wide.
const PLAZA_CLUSTER_RADIUS_KM = 3;

// A single wide-radius search (like the city lookup) reliably times out the
// free Overpass mirrors. Instead, sample a bounded number of points along
// the route and search a tight radius around each in one combined query —
// this only finds toll booths near a sample point, not the whole corridor,
// so it's a lower bound, not an exhaustive count.
const SEARCH_RADIUS_M = 10000;
const MAX_SAMPLE_POINTS = 40;
const MIN_INTERVAL_KM = 50;

function pickSamplePoints(route: RouteResult): LatLng[] {
  const interval = Math.max(MIN_INTERVAL_KM, route.distanceKm / MAX_SAMPLE_POINTS);
  const sampled = sampleStopsAlongRoute(route.coordinates, route.distanceKm, interval);
  return [route.coordinates[0], ...sampled.map((s) => s.location), route.coordinates[route.coordinates.length - 1]];
}

function buildQuery(points: LatLng[]): string {
  const clauses = points
    .map((p) => `node["barrier"="toll_booth"](around:${SEARCH_RADIUS_M},${p.lat},${p.lng});`)
    .join("\n");
  return `[out:json][timeout:25];(${clauses});out body 200;`;
}

/** Approximate sampling interval actually used, for display in the UI. */
export function tollSampleIntervalKm(route: RouteResult): number {
  return Math.max(MIN_INTERVAL_KM, route.distanceKm / MAX_SAMPLE_POINTS);
}

/** Merges toll-booth nodes that sit within a lane-width of each other into one plaza. */
function clusterIntoPlazas(booths: TollBooth[]): TollBooth[] {
  const plazas: TollBooth[] = [];

  for (const booth of booths) {
    const existing = plazas.find(
      (p) => haversineKm(p, booth) <= PLAZA_CLUSTER_RADIUS_KM,
    );
    if (existing) {
      if (!existing.name && booth.name) existing.name = booth.name;
      continue;
    }
    plazas.push({ ...booth });
  }

  return plazas;
}

/**
 * Finds real toll booths (OSM `barrier=toll_booth` nodes) near sampled
 * points along the route. This is a best-effort lower bound, not an
 * exhaustive scan of the whole corridor — see pickSamplePoints.
 */
export async function findTollBooths(route: RouteResult): Promise<TollBooth[]> {
  const points = pickSamplePoints(route);
  if (points.length === 0) return [];

  const query = buildQuery(points);
  const data = await queryOverpass(query);
  const elements = data.elements ?? [];

  const seen = new Set<number>();
  const booths: TollBooth[] = [];

  for (const el of elements) {
    if (seen.has(el.id) || !el.lat || !el.lon) continue;
    seen.add(el.id);

    booths.push({
      id: el.id,
      name: el.tags?.name ?? null,
      lat: el.lat,
      lng: el.lon,
      distanceFromStartKm: nearestDistanceKmOnRoute(route, { lat: el.lat, lng: el.lon }),
    });
  }

  booths.sort((a, b) => a.distanceFromStartKm - b.distanceFromStartKm);
  return clusterIntoPlazas(booths);
}
