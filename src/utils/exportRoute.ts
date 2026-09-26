import type { LatLng } from "../types";

// Keep well under Google Maps' practical waypoint limit for the web/app UI.
const GOOGLE_MAPS_MAX_WAYPOINTS = 8;

function evenlySpaced<T>(items: T[], max: number): T[] {
  if (items.length <= max || max <= 1) return items.slice(0, max);

  const result: T[] = [];
  const step = (items.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    result.push(items[Math.round(i * step)]);
  }
  return result;
}

/** Google Maps' Directions URL supports multiple waypoints in one link. */
export function buildGoogleMapsUrl(origin: LatLng, destination: LatLng, stops: LatLng[]): string {
  const waypoints = evenlySpaced(stops, GOOGLE_MAPS_MAX_WAYPOINTS);

  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });

  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map((w) => `${w.lat},${w.lng}`).join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Waze's URL scheme only supports a single destination, no waypoints. */
export function buildWazeUrl(destination: LatLng): string {
  return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
}

export interface WazeLeg {
  label: string;
  url: string;
}

/** Breaks the trip into point-to-point legs so it's still navigable in Waze. */
export function buildWazeLegs(
  origin: LatLng,
  stops: LatLng[],
  destination: LatLng,
  startLabel: string,
  endLabel: string,
): WazeLeg[] {
  const points = [origin, ...stops, destination];
  const labels = [startLabel, ...stops.map((_, i) => `Stop ${i + 1}`), endLabel];

  const legs: WazeLeg[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    legs.push({
      label: `${labels[i]} → ${labels[i + 1]}`,
      url: buildWazeUrl(points[i + 1]),
    });
  }
  return legs;
}
