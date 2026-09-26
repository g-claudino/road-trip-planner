import type { DayPlan, LatLng, RouteResult, RouteStop } from "../types";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export interface SampledStop {
  location: LatLng;
  distanceFromStartKm: number;
}

/**
 * Walks the route polyline and picks a point every `intervalKm`,
 * skipping a final stop that would land too close to the destination.
 */
export function sampleStopsAlongRoute(
  coordinates: LatLng[],
  totalDistanceKm: number,
  intervalKm: number,
): SampledStop[] {
  if (coordinates.length < 2 || intervalKm <= 0) return [];

  const cumulative: number[] = [0];
  for (let i = 1; i < coordinates.length; i++) {
    cumulative.push(
      cumulative[i - 1] + haversineKm(coordinates[i - 1], coordinates[i]),
    );
  }

  const stops: SampledStop[] = [];
  const minGapFromEnd = intervalKm * 0.3;

  let target = intervalKm;
  while (target < totalDistanceKm - minGapFromEnd) {
    const idx = cumulative.findIndex((d) => d >= target);
    if (idx <= 0) break;

    const d0 = cumulative[idx - 1];
    const d1 = cumulative[idx];
    const t = d1 === d0 ? 0 : (target - d0) / (d1 - d0);

    const p0 = coordinates[idx - 1];
    const p1 = coordinates[idx];

    stops.push({
      location: {
        lat: p0.lat + (p1.lat - p0.lat) * t,
        lng: p0.lng + (p1.lng - p0.lng) * t,
      },
      distanceFromStartKm: target,
    });

    target += intervalKm;
  }

  return stops;
}

/**
 * Interpolates a cumulative value (e.g. driving hours) at a given cumulative
 * distance, using the route's actual per-segment data rather than assuming a
 * constant average speed — important on routes with a slow mountain crossing.
 */
export function interpolateCumulative(
  cumulativeDistanceKm: number[],
  cumulativeValue: number[],
  targetKm: number,
): number {
  if (cumulativeDistanceKm.length === 0) return 0;

  const idx = cumulativeDistanceKm.findIndex((d) => d >= targetKm);
  if (idx <= 0) return cumulativeValue[cumulativeValue.length - 1] ?? 0;

  const d0 = cumulativeDistanceKm[idx - 1];
  const d1 = cumulativeDistanceKm[idx];
  const t = d1 === d0 ? 0 : (targetKm - d0) / (d1 - d0);

  return cumulativeValue[idx - 1] + (cumulativeValue[idx] - cumulativeValue[idx - 1]) * t;
}

/**
 * Greedily picks which of the (already-sampled) sightseeing stops should
 * double as overnight stays, so trip planning always sleeps at a place the
 * user can already see attractions for, rather than an arbitrary point on
 * the road. Targets equal-duration days and never repeats or reorders a stop.
 */
export function pickOvernightStops(
  stops: RouteStop[],
  totalDurationH: number,
  days: number,
): number[] {
  if (days <= 1) return [];

  const chosen: number[] = [];
  let searchStart = 0;

  for (let day = 1; day < days; day++) {
    const target = (totalDurationH * day) / days;
    let bestIdx = -1;
    let bestDiff = Infinity;

    for (let i = searchStart; i < stops.length; i++) {
      const diff = Math.abs(stops[i].cumulativeDurationH - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    chosen.push(bestIdx);
    searchStart = bestIdx + 1;
  }

  return chosen;
}

/**
 * Builds the day-by-day plan from the chosen overnight stops. If there
 * aren't enough sightseeing stops to support the requested day count, the
 * result simply has fewer days than requested (see pickOvernightStops).
 */
export function buildDayPlans(stops: RouteStop[], route: RouteResult, days: number): DayPlan[] {
  const overnightIndices = pickOvernightStops(stops, route.durationH, days);
  const plans: DayPlan[] = [];

  let prevDist = 0;
  let prevDur = 0;

  for (let i = 0; i <= overnightIndices.length; i++) {
    const isLast = i === overnightIndices.length;
    const stopIdx = isLast ? null : overnightIndices[i];
    const endDist = isLast ? route.distanceKm : stops[stopIdx!].distanceFromStartKm;
    const endDur = isLast ? route.durationH : stops[stopIdx!].cumulativeDurationH;

    plans.push({
      dayNumber: i + 1,
      startDistanceKm: prevDist,
      endDistanceKm: endDist,
      distanceKm: endDist - prevDist,
      drivingHours: endDur - prevDur,
      overnightStopIndex: stopIdx,
    });

    prevDist = endDist;
    prevDur = endDur;
  }

  return plans;
}

/**
 * Coarse similarity score (average nearest-point distance, km) between a
 * candidate route and a reference route — used to auto-pick a return route
 * that's visibly different from the outbound leg rather than the same road
 * reversed.
 */
function routeDistinctnessScore(candidate: LatLng[], reference: LatLng[]): number {
  if (candidate.length === 0 || reference.length === 0) return 0;

  const refSampleSize = Math.min(200, reference.length);
  const refStep = Math.max(1, Math.floor(reference.length / refSampleSize));
  const refSample: LatLng[] = [];
  for (let i = 0; i < reference.length; i += refStep) refSample.push(reference[i]);

  const sampleSize = Math.min(40, candidate.length);
  const step = Math.max(1, Math.floor(candidate.length / sampleSize));

  let total = 0;
  let count = 0;

  for (let i = 0; i < candidate.length; i += step) {
    const p = candidate[i];
    let minDist = Infinity;
    for (const q of refSample) {
      const d = haversineKm(p, q);
      if (d < minDist) minDist = d;
      if (minDist < 1) break;
    }
    total += minDist;
    count++;
  }

  return count === 0 ? 0 : total / count;
}

export interface RouteProjection {
  /** Distance along the route (km) of the nearest point to the given location. */
  distanceKm: number;
  /** Driving time along the route (h) of the nearest point to the given location. */
  durationH: number;
  /** How far the given location is from the route itself (km). */
  offRouteKm: number;
}

/**
 * Projects an arbitrary point (a dragged marker, a suggested city) onto the
 * route polyline, returning where along the route it falls. The point itself
 * doesn't have to sit exactly on the route — a stop can be a real town a few
 * km off the highway — this just answers "how far into the trip is this?"
 * so drag-and-drop and city suggestions stay consistent with the itinerary
 * math (day splitting, distances, driving time).
 */
export function projectPointOntoRoute(route: RouteResult, point: LatLng): RouteProjection {
  const { coordinates, cumulativeDistanceKm, cumulativeDurationH } = route;

  if (coordinates.length < 2) {
    return { distanceKm: 0, durationH: 0, offRouteKm: 0 };
  }

  // Scale longitude distances by cos(latitude) so the projection isn't
  // skewed away from the equator.
  const kx = Math.cos((point.lat * Math.PI) / 180);

  let bestDist = Infinity;
  let bestSegment = 0;
  let bestT = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = coordinates[i];
    const b = coordinates[i + 1];

    const ax = a.lng * kx;
    const ay = a.lat;
    const bx = b.lng * kx;
    const by = b.lat;
    const px = point.lng * kx;
    const py = point.lat;

    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const candidate: LatLng = {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    };
    const dist = haversineKm(point, candidate);

    if (dist < bestDist) {
      bestDist = dist;
      bestSegment = i;
      bestT = t;
    }
  }

  const d0 = cumulativeDistanceKm[bestSegment];
  const d1 = cumulativeDistanceKm[bestSegment + 1];
  const h0 = cumulativeDurationH[bestSegment];
  const h1 = cumulativeDurationH[bestSegment + 1];

  return {
    distanceKm: d0 + (d1 - d0) * bestT,
    durationH: h0 + (h1 - h0) * bestT,
    offRouteKm: bestDist,
  };
}

/** Picks the route option (from OSRM alternatives) least similar to a reference route. */
export function pickMostDistinctRouteIndex(
  options: RouteResult[],
  referenceCoordinates: LatLng[],
): number {
  let bestIdx = 0;
  let bestScore = -Infinity;

  options.forEach((opt, i) => {
    const score = routeDistinctnessScore(opt.coordinates, referenceCoordinates);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });

  return bestIdx;
}
