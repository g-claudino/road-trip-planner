import type { RouteResult, RouteStop } from "../types";

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
}: Props) {
  if (!route) return null;

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
      </div>

      <div className="sidebar-section">
        <h2>Suggested Stops &amp; Attractions</h2>
        <ol className="stop-list">
          <li className="stop-item stop-item-endpoint">
            <div className="stop-item-header">
              <span className="stop-badge stop-badge-a">A</span>
              <span>{startLabel ?? "Start"}</span>
            </div>
          </li>

          {stops.map((stop, i) => (
            <li key={i} className="stop-item">
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

              {!stop.attractionsLoaded && !stop.loadingAttractions && !stop.attractionsError && (
                <button className="load-attractions-btn" onClick={() => onLoadStop?.(i)}>
                  Show nearby attractions
                </button>
              )}

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
            </li>
          ))}

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
