import type { LatLng, RouteResult } from "../types";
import { haversineKm } from "../utils/geo";

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

interface OsrmRoute {
  geometry: { coordinates: [number, number][] };
  distance: number;
  duration: number;
  legs?: { annotation?: { duration?: number[]; distance?: number[] } }[];
}

function parseRoute(route: OsrmRoute): RouteResult {
  const coordinates: LatLng[] = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));

  const distanceKm = route.distance / 1000;
  const durationH = route.duration / 3600;

  // Per-segment duration/distance (from OSRM annotations) let us place day
  // boundaries by actual driving time rather than assuming a constant speed —
  // important on a route like São Paulo–Lima where the Andes crossing is much
  // slower than the flat highway stretches.
  const segmentDurationsS: number[] =
    route.legs?.flatMap((leg) => leg.annotation?.duration ?? []) ?? [];
  const segmentDistancesM: number[] =
    route.legs?.flatMap((leg) => leg.annotation?.distance ?? []) ?? [];

  const hasAnnotations =
    segmentDurationsS.length === coordinates.length - 1 &&
    segmentDistancesM.length === coordinates.length - 1;

  const cumulativeDurationH: number[] = [0];
  const cumulativeDistanceKm: number[] = [0];

  if (hasAnnotations) {
    for (let i = 0; i < segmentDurationsS.length; i++) {
      cumulativeDurationH.push(cumulativeDurationH[i] + segmentDurationsS[i] / 3600);
      cumulativeDistanceKm.push(cumulativeDistanceKm[i] + segmentDistancesM[i] / 1000);
    }
  } else {
    // Fallback: assume constant average speed across the whole route.
    const kmPerHour = distanceKm / durationH;
    for (let i = 1; i < coordinates.length; i++) {
      const segKm = haversineKm(coordinates[i - 1], coordinates[i]);
      cumulativeDistanceKm.push(cumulativeDistanceKm[i - 1] + segKm);
      cumulativeDurationH.push(cumulativeDurationH[i - 1] + segKm / kmPerHour);
    }
  }

  return {
    coordinates,
    distanceKm,
    durationH,
    cumulativeDistanceKm,
    cumulativeDurationH,
  };
}

/**
 * Fetches a driving route through the given waypoints (2 or more — extra
 * waypoints act as "via" points). When `alternatives` is requested, OSRM may
 * return more than one option for a plain two-point trip; each is returned
 * as a separate RouteResult, ordered as OSRM ranked them.
 */
export async function fetchRoute(
  waypoints: LatLng[],
  options: { alternatives?: boolean } = {},
): Promise<RouteResult[]> {
  if (waypoints.length < 2) {
    throw new Error("A route needs at least two points.");
  }

  const coordsParam = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    annotations: "duration,distance",
    alternatives: options.alternatives ? "true" : "false",
  });

  const res = await fetch(`${OSRM_URL}/${coordsParam}?${params.toString()}`);

  if (!res.ok) {
    throw new Error(`Routing failed: ${res.status}`);
  }

  const data = await res.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(
      "No route found between these points (they may not be connected by road).",
    );
  }

  return data.routes.map(parseRoute);
}
