import { useState } from "react";
import type { CostSettings, LegKey } from "../types";
import { computeCosts, type LegCostInput } from "../data/costDefaults";

interface Props {
  settings: CostSettings;
  onChange: (settings: CostSettings) => void;
  legs: LegCostInput[];
  onDetectTolls: (legKey: LegKey) => void;
}

export function CostEstimatorPanel({ settings, onChange, legs, onDetectTolls }: Props) {
  const [expandedLeg, setExpandedLeg] = useState<LegKey | null>(null);

  const hasDistance = legs.some((l) => l.distanceKm > 0);
  if (!hasDistance) return null;

  const { perLeg, grandTotal } = computeCosts(legs, settings);

  function set<K extends keyof CostSettings>(key: K, value: CostSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <div className="sidebar-section cost-panel">
      <h2>Estimated Costs</h2>
      <p className="border-hint">
        Rough estimate only — fuel prices, toll rates and hotel rates vary a lot by country,
        city and season. Adjust the numbers below to match your trip.
      </p>

      <div className="cost-inputs">
        <label>
          Currency
          <input
            type="text"
            value={settings.currency}
            onChange={(e) => set("currency", e.target.value)}
          />
        </label>
        <label>
          Fuel economy
          <input
            type="number"
            min={1}
            step={0.5}
            value={settings.fuelEconomyKmPerL}
            onChange={(e) => set("fuelEconomyKmPerL", Number(e.target.value))}
          />
          km/L
        </label>
        <label>
          Fuel price
          <input
            type="number"
            min={0}
            step={0.05}
            value={settings.fuelPricePerL}
            onChange={(e) => set("fuelPricePerL", Number(e.target.value))}
          />
          /L
        </label>
        <label>
          Tolls (flat rate)
          <input
            type="number"
            min={0}
            step={0.5}
            value={settings.tollPer100Km}
            onChange={(e) => set("tollPer100Km", Number(e.target.value))}
          />
          /100km
        </label>
        <label>
          Tolls (per booth)
          <input
            type="number"
            min={0}
            step={0.5}
            value={settings.tollPerBooth}
            onChange={(e) => set("tollPerBooth", Number(e.target.value))}
          />
          /booth
        </label>
        <label>
          Hotel
          <input
            type="number"
            min={0}
            step={5}
            value={settings.hotelPerNight}
            onChange={(e) => set("hotelPerNight", Number(e.target.value))}
          />
          /night
        </label>
      </div>

      <div className="cost-breakdown">
        {perLeg.map((leg, i) => {
          const legInput = legs[i];
          const isExpanded = expandedLeg === legInput.key;

          return (
            <div key={legInput.key} className="cost-leg-row">
              <div className="cost-leg-label">{leg.label}</div>
              <div className="cost-leg-items">
                <span>
                  Fuel: {settings.currency}
                  {leg.fuel.toFixed(0)}
                </span>
                <span>
                  Tolls: {settings.currency}
                  {leg.tolls.toFixed(0)}
                  {leg.tollBoothCount !== null && ` (${leg.tollBoothCount} booths)`}
                </span>
                <span>
                  Hotel: {settings.currency}
                  {leg.hotel.toFixed(0)}
                </span>
              </div>

              {legInput.detectingTolls && (
                <div className="stop-attractions-loading">Looking for toll booths on the route…</div>
              )}

              {!legInput.detectingTolls && legInput.tollError && (
                <div className="stop-attractions-error">
                  {legInput.tollError}{" "}
                  <button className="retry-link" onClick={() => onDetectTolls(legInput.key)}>
                    Retry
                  </button>
                </div>
              )}

              {!legInput.detectingTolls && !legInput.tollError && legInput.tollBooths === null && (
                <button className="load-attractions-btn" onClick={() => onDetectTolls(legInput.key)}>
                  Detect toll booths on route
                </button>
              )}

              {!legInput.detectingTolls && legInput.tollBooths !== null && (
                <div className="toll-detection-controls">
                  <button
                    className="retry-link"
                    onClick={() => setExpandedLeg(isExpanded ? null : legInput.key)}
                  >
                    {isExpanded ? "Hide" : "Show"} detected booths
                  </button>
                  <button className="retry-link" onClick={() => onDetectTolls(legInput.key)}>
                    Re-detect
                  </button>
                </div>
              )}

              {isExpanded && legInput.tollBooths && (
                <>
                  <p className="border-hint toll-detection-note">
                    Sampled along the route — a lower-bound count, not exhaustive. Toll booths
                    between sample points may be missed.
                  </p>
                  {legInput.tollBooths.length === 0 ? (
                    <div className="stop-attractions-loading">No toll booths detected.</div>
                  ) : (
                    <ul className="toll-booth-list">
                      {legInput.tollBooths.map((booth) => (
                        <li key={booth.id}>
                          <span>{booth.name ?? "Toll booth"}</span>
                          <span className="toll-booth-km">
                            {booth.distanceFromStartKm.toFixed(0)} km
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          );
        })}

        <div className="cost-total-row">
          <span>Estimated total</span>
          <strong>
            {settings.currency}
            {grandTotal.toFixed(0)}
          </strong>
        </div>
      </div>
    </div>
  );
}
