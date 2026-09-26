import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./App.css";
import type {
  BorderCrossing,
  CostSettings,
  LatLng,
  LegKey,
  LegState,
  Place,
  RouteResult,
  RouteStop,
} from "./types";
import { PlaceSearchInput } from "./components/PlaceSearchInput";
import { MapView, type LegMapData } from "./components/MapView";
import { TripSidebar } from "./components/TripSidebar";
import { ItineraryPanel } from "./components/ItineraryPanel";
import { BorderCrossingPanel } from "./components/BorderCrossingPanel";
import { PassportSelector } from "./components/PassportSelector";
import { CostEstimatorPanel } from "./components/CostEstimatorPanel";
import { ThemeToggle } from "./components/ThemeToggle";
import { fetchRoute } from "./services/routing";
import { fetchAttractionsNear } from "./services/attractions";
import { reverseGeocode } from "./services/geocoding";
import {
  buildDayPlans,
  interpolateCumulative,
  pickMostDistinctRouteIndex,
  sampleStopsAlongRoute,
} from "./utils/geo";
import { DEFAULT_COST_SETTINGS, type LegCostInput } from "./data/costDefaults";

type Theme = "light" | "dark";

function readStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem("roadtrip-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // localStorage unavailable — fall through to system preference
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredJSON<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(fallback)) {
        return (Array.isArray(parsed) ? parsed : fallback) as T;
      }
      return { ...fallback, ...parsed };
    }
  } catch {
    // localStorage unavailable or malformed — use fallback
  }
  return fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const EMPTY_LEG: LegState = {
  route: null,
  routeOptions: [],
  selectedRouteIndex: 0,
  stops: [],
  days: 1,
  dayPlans: [],
  planning: false,
  error: null,
  borderCrossings: [],
  detectingBorders: false,
  borderError: null,
};

function computeLegDerived(route: RouteResult, intervalKm: number, maxHoursPerDay: number) {
  const sampled = sampleStopsAlongRoute(route.coordinates, route.distanceKm, intervalKm);
  const stops: RouteStop[] = sampled.map((s) => ({
    location: s.location,
    distanceFromStartKm: s.distanceFromStartKm,
    cumulativeDurationH: interpolateCumulative(
      route.cumulativeDistanceKm,
      route.cumulativeDurationH,
      s.distanceFromStartKm,
    ),
    attractions: [],
    loadingAttractions: false,
    attractionsError: false,
    attractionsLoaded: false,
  }));
  const days = Math.max(1, Math.ceil(route.durationH / maxHoursPerDay));
  const dayPlans = buildDayPlans(stops, route, days);
  return { stops, days, dayPlans };
}

function App() {
  const [start, setStart] = useState<Place | null>(null);
  const [end, setEnd] = useState<Place | null>(null);
  const [intervalKm, setIntervalKm] = useState(350);
  const [maxHoursPerDay, setMaxHoursPerDay] = useState(8);

  const [roundTrip, setRoundTrip] = useState(false);
  const [returnVia, setReturnVia] = useState<Place | null>(null);
  const [activeLeg, setActiveLeg] = useState<LegKey>("outbound");

  const [legs, setLegs] = useState<Record<LegKey, LegState>>({
    outbound: EMPTY_LEG,
    return: EMPTY_LEG,
  });

  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const [passports, setPassports] = useState<string[]>(() =>
    readStoredJSON("roadtrip-passports", [] as string[]),
  );
  const [costSettings, setCostSettings] = useState<CostSettings>(() =>
    readStoredJSON("roadtrip-costs", DEFAULT_COST_SETTINGS),
  );

  const canPlan = !!start && !!end && !planning;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("roadtrip-theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem("roadtrip-passports", JSON.stringify(passports));
    } catch {
      // ignore
    }
  }, [passports]);

  useEffect(() => {
    try {
      localStorage.setItem("roadtrip-costs", JSON.stringify(costSettings));
    } catch {
      // ignore
    }
  }, [costSettings]);

  function updateLeg(legKey: LegKey, updater: (leg: LegState) => LegState) {
    setLegs((prev) => ({ ...prev, [legKey]: updater(prev[legKey]) }));
  }

  async function planLeg(
    legKey: LegKey,
    referenceCoordinates?: LatLng[],
  ): Promise<RouteResult | null> {
    const origin = legKey === "outbound" ? start : end;
    const destination = legKey === "outbound" ? end : start;
    if (!origin || !destination) return null;

    updateLeg(legKey, (leg) => ({
      ...leg,
      planning: true,
      error: null,
      route: null,
      routeOptions: [],
      stops: [],
      dayPlans: [],
      borderCrossings: [],
      borderError: null,
    }));

    try {
      const waypoints: LatLng[] =
        legKey === "return" && returnVia
          ? [origin, returnVia, destination].map((p) => ({ lat: p.lat, lng: p.lng }))
          : [origin, destination].map((p) => ({ lat: p.lat, lng: p.lng }));

      const routeOptions = await fetchRoute(waypoints, { alternatives: legKey === "return" });

      let selectedIndex = 0;
      if (legKey === "return" && routeOptions.length > 1 && referenceCoordinates) {
        selectedIndex = pickMostDistinctRouteIndex(routeOptions, referenceCoordinates);
      }

      const chosen = routeOptions[selectedIndex];
      const derived = computeLegDerived(chosen, intervalKm, maxHoursPerDay);

      updateLeg(legKey, (leg) => ({
        ...leg,
        route: chosen,
        routeOptions,
        selectedRouteIndex: selectedIndex,
        ...derived,
        planning: false,
      }));

      return chosen;
    } catch (err) {
      updateLeg(legKey, (leg) => ({
        ...leg,
        planning: false,
        error: err instanceof Error ? err.message : "Something went wrong.",
      }));
      return null;
    }
  }

  async function handlePlan() {
    setPlanning(true);
    setError(null);
    setActiveLeg("outbound");

    try {
      const outboundRoute = await planLeg("outbound");
      if (roundTrip) {
        await planLeg("return", outboundRoute?.coordinates);
      }
    } finally {
      setPlanning(false);
    }
  }

  async function loadStopAttractions(legKey: LegKey, index: number, location: LatLng) {
    updateLeg(legKey, (leg) => {
      const stops = [...leg.stops];
      stops[index] = { ...stops[index], loadingAttractions: true, attractionsError: false };
      return { ...leg, stops };
    });

    try {
      const attractions = await fetchAttractionsNear(location);
      updateLeg(legKey, (leg) => {
        const stops = [...leg.stops];
        stops[index] = {
          ...stops[index],
          attractions,
          loadingAttractions: false,
          attractionsError: false,
          attractionsLoaded: true,
        };
        return { ...leg, stops };
      });
    } catch {
      updateLeg(legKey, (leg) => {
        const stops = [...leg.stops];
        stops[index] = {
          ...stops[index],
          loadingAttractions: false,
          attractionsError: true,
          attractionsLoaded: false,
        };
        return { ...leg, stops };
      });
    }
  }

  async function loadAllStops(legKey: LegKey) {
    const stops = legs[legKey].stops;
    for (let i = 0; i < stops.length; i++) {
      if (!stops[i].attractionsLoaded && !stops[i].loadingAttractions) {
        await loadStopAttractions(legKey, i, stops[i].location);
        if (i < stops.length - 1) await sleep(1000);
      }
    }
  }

  function selectRouteOption(legKey: LegKey, idx: number) {
    updateLeg(legKey, (leg) => {
      const chosen = leg.routeOptions[idx];
      if (!chosen) return leg;
      const derived = computeLegDerived(chosen, intervalKm, maxHoursPerDay);
      return {
        ...leg,
        route: chosen,
        selectedRouteIndex: idx,
        ...derived,
        borderCrossings: [],
        borderError: null,
      };
    });
  }

  function handleDaysChange(legKey: LegKey, newDays: number) {
    updateLeg(legKey, (leg) => {
      if (!leg.route) return { ...leg, days: newDays };
      const dayPlans = buildDayPlans(leg.stops, leg.route, newDays);
      return { ...leg, days: newDays, dayPlans };
    });
  }

  async function detectBorderCrossings(legKey: LegKey) {
    const leg = legs[legKey];
    const origin = legKey === "outbound" ? start : end;
    const destination = legKey === "outbound" ? end : start;
    if (!leg.route || !origin || !destination) return;

    updateLeg(legKey, (l) => ({
      ...l,
      detectingBorders: true,
      borderError: null,
      borderCrossings: [],
    }));

    const points: { location: LatLng; distanceKm: number }[] = [
      { location: { lat: origin.lat, lng: origin.lng }, distanceKm: 0 },
      ...leg.stops.map((s) => ({ location: s.location, distanceKm: s.distanceFromStartKm })),
      { location: { lat: destination.lat, lng: destination.lng }, distanceKm: leg.route.distanceKm },
    ];

    const results: BorderCrossing[] = [];
    for (let i = 0; i < points.length; i++) {
      try {
        const geo = await reverseGeocode(points[i].location);
        if (geo) {
          results.push({
            countryCode: geo.countryCode,
            countryName: geo.countryName,
            atDistanceKm: points[i].distanceKm,
          });
        }
      } catch {
        // skip this sample point, keep going
      }
      if (i < points.length - 1) await sleep(1100);
    }

    const deduped: BorderCrossing[] = [];
    for (const r of results) {
      if (deduped.length === 0 || deduped[deduped.length - 1].countryCode !== r.countryCode) {
        deduped.push(r);
      }
    }

    if (deduped.length === 0) {
      updateLeg(legKey, (l) => ({
        ...l,
        detectingBorders: false,
        borderError: "Couldn't determine countries along the route — try again.",
      }));
    } else {
      updateLeg(legKey, (l) => ({ ...l, detectingBorders: false, borderCrossings: deduped }));
    }
  }

  const outboundSuggestedDays = legs.outbound.route
    ? Math.max(1, Math.ceil(legs.outbound.route.durationH / maxHoursPerDay))
    : 1;
  const returnSuggestedDays = legs.return.route
    ? Math.max(1, Math.ceil(legs.return.route.durationH / maxHoursPerDay))
    : 1;

  const showTabs = roundTrip && !!legs.return.route;
  const currentLegKey: LegKey = showTabs ? activeLeg : "outbound";
  const currentLeg = legs[currentLegKey];
  const currentOvernightIndices = new Set(
    currentLeg.dayPlans
      .filter((d) => d.overnightStopIndex !== null)
      .map((d) => d.overnightStopIndex as number),
  );

  const mapLegs: LegMapData[] = [];
  if (legs.outbound.route) {
    mapLegs.push({
      key: "outbound",
      label: "Outbound",
      color: "#2563eb",
      overnightColor: "#0f766e",
      start,
      end,
      routeCoordinates: legs.outbound.route.coordinates,
      stops: legs.outbound.stops,
      dayPlans: legs.outbound.dayPlans,
      route: legs.outbound.route,
    });
  }
  if (roundTrip && legs.return.route) {
    mapLegs.push({
      key: "return",
      label: "Return",
      color: "#f59e0b",
      overnightColor: "#b45309",
      start: end,
      end: start,
      routeCoordinates: legs.return.route.coordinates,
      stops: legs.return.stops,
      dayPlans: legs.return.dayPlans,
      route: legs.return.route,
    });
  }

  const costLegs: LegCostInput[] = [];
  if (legs.outbound.route) {
    costLegs.push({
      label: "Outbound",
      distanceKm: legs.outbound.route.distanceKm,
      nights: Math.max(0, legs.outbound.dayPlans.length - 1),
    });
  }
  if (roundTrip && legs.return.route) {
    costLegs.push({
      label: "Return",
      distanceKm: legs.return.route.distanceKm,
      nights: Math.max(0, legs.return.dayPlans.length - 1),
    });
  }

  const hasAnyRoute = !!legs.outbound.route || !!legs.return.route;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <h1>Road Trip Planner</h1>
          <ThemeToggle
            theme={theme}
            onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          />
        </div>
        <div className="controls">
          <PlaceSearchInput placeholder="Starting point" value={start} onChange={setStart} />
          <PlaceSearchInput placeholder="Destination" value={end} onChange={setEnd} />

          <label className="interval-control">
            Stop every
            <input
              type="number"
              min={50}
              max={1000}
              step={50}
              value={intervalKm}
              onChange={(e) => setIntervalKm(Number(e.target.value))}
            />
            km
          </label>

          <button onClick={handlePlan} disabled={!canPlan}>
            {planning ? "Planning…" : "Plan Route"}
          </button>
        </div>

        <div className="controls round-trip-controls">
          <label className="round-trip-toggle">
            <input
              type="checkbox"
              checked={roundTrip}
              onChange={(e) => setRoundTrip(e.target.checked)}
            />
            Round trip with a different return route
          </label>

          {roundTrip && (
            <div className="return-via">
              <span>Return via (optional)</span>
              <PlaceSearchInput
                placeholder="Waypoint for the way back"
                value={returnVia}
                onChange={setReturnVia}
              />
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}
      </header>

      <main className="app-main">
        <div className={hasAnyRoute ? "sidebar" : "sidebar sidebar-empty"}>
          {!hasAnyRoute && <p>Set a starting point and destination, then plan your route.</p>}

          {hasAnyRoute && (
            <div className="sidebar-section passport-section">
              <h2>Travel Documents</h2>
              <PassportSelector selected={passports} onChange={setPassports} />
            </div>
          )}

          {showTabs && (
            <div className="leg-tabs">
              <button
                className={currentLegKey === "outbound" ? "leg-tab active" : "leg-tab"}
                onClick={() => setActiveLeg("outbound")}
              >
                Outbound
              </button>
              <button
                className={currentLegKey === "return" ? "leg-tab active" : "leg-tab"}
                onClick={() => setActiveLeg("return")}
              >
                Return
              </button>
            </div>
          )}

          {currentLeg.error && <div className="error-banner">{currentLeg.error}</div>}

          <TripSidebar
            route={currentLeg.route}
            stops={currentLeg.stops}
            startLabel={(currentLegKey === "outbound" ? start : end)?.label}
            endLabel={(currentLegKey === "outbound" ? end : start)?.label}
            onLoadStop={(i) =>
              loadStopAttractions(currentLegKey, i, currentLeg.stops[i].location)
            }
            onLoadAll={() => loadAllStops(currentLegKey)}
            overnightStopIndices={currentOvernightIndices}
            routeOptions={currentLeg.routeOptions}
            selectedRouteIndex={currentLeg.selectedRouteIndex}
            onSelectRouteOption={(idx) => selectRouteOption(currentLegKey, idx)}
          />

          <ItineraryPanel
            route={currentLeg.route}
            stops={currentLeg.stops}
            days={currentLeg.days}
            onDaysChange={(n) => handleDaysChange(currentLegKey, n)}
            maxHoursPerDay={maxHoursPerDay}
            onMaxHoursChange={setMaxHoursPerDay}
            suggestedDays={currentLegKey === "outbound" ? outboundSuggestedDays : returnSuggestedDays}
            dayPlans={currentLeg.dayPlans}
          />

          <BorderCrossingPanel
            passports={passports}
            crossings={currentLeg.borderCrossings}
            detecting={currentLeg.detectingBorders}
            error={currentLeg.borderError}
            onDetect={() => detectBorderCrossings(currentLegKey)}
            hasRoute={!!currentLeg.route}
          />

          <CostEstimatorPanel settings={costSettings} onChange={setCostSettings} legs={costLegs} />
        </div>

        <div className="map-container">
          <MapView legs={mapLegs} />
        </div>
      </main>
    </div>
  );
}

export default App;
