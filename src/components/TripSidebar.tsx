import { useState } from "react";
import type { LatLng, RouteResult, RouteStop } from "../types";
import { fetchNearbyCities, MAX_CITY_SEARCH_RADIUS_KM, type CityCandidate } from "../services/cities";

/** A stop has no stable id, so key ephemeral UI state off its location —
 * this naturally invalidates itself when a stop is dragged or reordered,
 * with no effect needed to reset stale state. */
function stopKey(stop: RouteStop): string {
  return `${stop.location.lat.toFixed(5)},${stop.location.lng.toFixed(5)}`;
}

interface Props {
  route: RouteResult | null;
  stops: RouteStop[];
  startLabel?: string;
  endLabel?: string;
  onLoadStop?: (index: number) => void;
  onLoadAll?: () => void;
  overnightStopIndices?: Set<number>;
  routeOptions?: RouteResult[];
  selectedRouteIndex?: number;
  onSelectRouteOption?: (index: number) => void;
  intervalKm?: number;
  onMoveStop?: (index: number, location: LatLng) => void;
  recalculating?: boolean;
}

export function TripSidebar({
  route,
  stops,
  startLabel,
  endLabel,
  onLoadStop,
  onLoadAll,
  overnightStopIndices,
  routeOptions = [],
  selectedRouteIndex = 0,
  onSelectRouteOption,
  intervalKm = 350,
  onMoveStop,
  recalculating = false,
}: Props) {
  const [citySuggestions, setCitySuggestions] = useState<Record<string, CityCandidate[]>>({});
  const [loadingCities, setLoadingCities] = useState<Record<string, boolean>>({});
  const [cityError, setCityError] = useState<Record<string, string | null>>({});

  if (!route) return null;

  const searchRadiusKm = Math.min(Math.max(1, intervalKm * 0.1), MAX_CITY_SEARCH_RADIUS_KM);

  async function suggestCities(index: number) {
    const key = stopKey(stops[index]);
    setLoadingCities((prev) => ({ ...prev, [key]: true }));
    setCityError((prev) => ({ ...prev, [key]: null }));

    try {
      const cities = await fetchNearbyCities(stops[index].location, searchRadiusKm);
      setCitySuggestions((prev) => ({ ...prev, [key]: cities }));
    } catch {
      setCityError((prev) => ({
        ...prev,
        [key]: "Couldn't load city suggestions (the free lookup service may be busy).",
      }));
    } finally {
      setLoadingCities((prev) => ({ ...prev, [key]: false }));
    }
  }

  function pickCity(index: number, city: CityCandidate) {
    onMoveStop?.(index, { lat: city.lat, lng: city.lng });
  }

  return (
    <>
      <div className="trip-summary">
        <h2>Trip Summary</h2>
        <div className="trip-summary-row">
          <span>Distance</span>
          <strong>{route.distanceKm.toFixed(0)} km</strong>
        </div>
        <div className="trip-summary-row">
          <span>Driving time</span>
          <strong>{route.durationH.toFixed(1)} h</strong>
        </div>
        <div className="trip-summary-row">
          <span>Stops suggested</span>
          <strong>{stops.length}</strong>
        </div>

        {routeOptions.length > 1 && (
          <div className="route-options">
            <span className="route-options-label">Route option</span>
            <div className="route-options-list">
              {routeOptions.map((opt, i) => (
                <button
                  key={i}
                  className={i === selectedRouteIndex ? "route-option active" : "route-option"}
                  onClick={() => onSelectRouteOption?.(i)}
                >
                  {i + 1}: {opt.distanceKm.toFixed(0)} km / {opt.durationH.toFixed(1)}h
                </button>
              ))}
            </div>
          </div>
        )}

        {onLoadAll && stops.length > 0 && (
          <button className="load-all-btn" onClick={onLoadAll}>
            Load attractions for all stops
          </button>
        )}

        {recalculating && (
          <div className="stop-attractions-loading recalculating-note">
            Recalculating the route through the moved stop…
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <h2>Suggested Stops &amp; Attractions</h2>
        {onMoveStop && (
          <p className="border-hint stop-drag-hint">
            Drag a stop on the map to move it, or suggest a nearby city (within{" "}
            {Math.round(searchRadiusKm)} km) below.
          </p>
        )}
        <ol className="stop-list">
          <li className="stop-item stop-item-endpoint">
            <div className="stop-item-header">
              <span className="stop-badge stop-badge-a">A</span>
              <span>{startLabel ?? "Start"}</span>
            </div>
          </li>

          {stops.map((stop, i) => {
            const key = stopKey(stop);
            return (
              <li key={key} className="stop-item">
                <div className="stop-item-header">
                  <span className="stop-badge">{i + 1}</span>
                  <span>
                    {stop.distanceFromStartKm.toFixed(0)} km ·{" "}
                    {stop.cumulativeDurationH.toFixed(1)} h in
                  </span>
                  {overnightStopIndices?.has(i) && (
                    <span className="overnight-badge" title="Overnight stay">
                      ☾
                    </span>
                  )}
                </div>

                <div className="stop-actions">
                  {!stop.attractionsLoaded &&
                    !stop.loadingAttractions &&
                    !stop.attractionsError && (
                      <button className="load-attractions-btn" onClick={() => onLoadStop?.(i)}>
                        Show nearby attractions
                      </button>
                    )}

                  {onMoveStop && !loadingCities[key] && !citySuggestions[key] && (
                    <button className="load-attractions-btn" onClick={() => suggestCities(i)}>
                      Suggest a city
                    </button>
                  )}
                </div>

                {stop.loadingAttractions && (
                  <div className="stop-attractions-loading">Loading nearby attractions…</div>
                )}

                {!stop.loadingAttractions && stop.attractionsError && (
                  <div className="stop-attractions-error">
                    Couldn't load attractions (the free lookup service may be busy).{" "}
                    {onLoadStop && (
                      <button className="retry-link" onClick={() => onLoadStop(i)}>
                        Retry
                      </button>
                    )}
                  </div>
                )}

                {stop.attractionsLoaded &&
                  !stop.loadingAttractions &&
                  stop.attractions.length === 0 && (
                    <div className="stop-attractions-loading">No attractions found nearby.</div>
                  )}

                {stop.attractions.length > 0 && (
                  <ul className="attraction-list">
                    {stop.attractions.map((a) => (
                      <li key={a.id}>
                        <span className="attraction-name">{a.name}</span>
                        <span className="attraction-meta">
                          {a.category} · {a.distanceKm.toFixed(1)} km
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {loadingCities[key] && (
                  <div className="stop-attractions-loading">Looking for nearby cities…</div>
                )}

                {cityError[key] && (
                  <div className="stop-attractions-error">
                    {cityError[key]}{" "}
                    <button className="retry-link" onClick={() => suggestCities(i)}>
                      Retry
                    </button>
                  </div>
                )}

                {citySuggestions[key] && citySuggestions[key].length === 0 && (
                  <div className="stop-attractions-loading">
                    No towns found within {Math.round(searchRadiusKm)} km of this point.
                  </div>
                )}

                {citySuggestions[key] && citySuggestions[key].length > 0 && (
                  <ul className="city-suggestion-list">
                    {citySuggestions[key].map((city) => (
                      <li key={city.id}>
                        <button className="city-suggestion" onClick={() => pickCity(i, city)}>
                          <span className="city-suggestion-name">{city.name}</span>
                          <span className="city-suggestion-meta">
                            {city.placeType} · {city.distanceKm.toFixed(0)} km away
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}

          <li className="stop-item stop-item-endpoint">
            <div className="stop-item-header">
              <span className="stop-badge stop-badge-b">B</span>
              <span>{endLabel ?? "Destination"}</span>
            </div>
          </li>
        </ol>
      </div>
    </>
  );
}
