export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export interface Attraction {
  id: number;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

export interface RouteStop {
  location: LatLng;
  distanceFromStartKm: number;
  cumulativeDurationH: number;
  attractions: Attraction[];
  loadingAttractions: boolean;
  attractionsError: boolean;
  attractionsLoaded: boolean;
}

export interface RouteResult {
  coordinates: LatLng[];
  distanceKm: number;
  durationH: number;
  /** Cumulative distance (km) at each coordinate, same length as coordinates. */
  cumulativeDistanceKm: number[];
  /** Cumulative driving time (h) at each coordinate, same length as coordinates. */
  cumulativeDurationH: number[];
  /** Cumulative distance (km) at each waypoint passed to OSRM, index 0 = origin (0km). */
  waypointDistanceKm: number[];
  /** Cumulative driving time (h) at each waypoint passed to OSRM, index 0 = origin (0h). */
  waypointDurationH: number[];
}

export interface DayPlan {
  dayNumber: number;
  startDistanceKm: number;
  endDistanceKm: number;
  distanceKm: number;
  drivingHours: number;
  /** Index into the leg's stops[] used as the overnight stay; null on the final day (arrival). */
  overnightStopIndex: number | null;
}

export interface Nationality {
  code: string;
  name: string;
}

export type VisaStatus = "visa-free" | "e-visa" | "visa-required";

export interface VisaEntry {
  status: VisaStatus;
  days?: number;
  idCardAccepted?: boolean;
  feeOnArrival?: boolean;
  note?: string;
}

export interface BorderCrossing {
  countryCode: string;
  countryName: string;
  atDistanceKm: number;
}

export interface CostSettings {
  currency: string;
  fuelEconomyKmPerL: number;
  fuelPricePerL: number;
  tollPer100Km: number;
  tollPerBooth: number;
  hotelPerNight: number;
}

export interface TollBooth {
  id: number;
  name: string | null;
  lat: number;
  lng: number;
  distanceFromStartKm: number;
}

export type LegKey = "outbound" | "return";

export interface LegState {
  route: RouteResult | null;
  routeOptions: RouteResult[];
  selectedRouteIndex: number;
  stops: RouteStop[];
  days: number;
  dayPlans: DayPlan[];
  planning: boolean;
  error: string | null;
  borderCrossings: BorderCrossing[];
  detectingBorders: boolean;
  borderError: string | null;
  /** True while a dragged/relocated stop is being re-routed through OSRM. */
  recalculating: boolean;
  /** null = not yet checked; an array (possibly empty) once detection has run. */
  tollBooths: TollBooth[] | null;
  detectingTolls: boolean;
  tollError: string | null;
}

export interface Favorite {
  id: string;
  name: string;
  start: Place;
  end: Place;
  intervalKm: number;
  roundTrip: boolean;
  returnVia: Place | null;
  savedAt: number;
}
