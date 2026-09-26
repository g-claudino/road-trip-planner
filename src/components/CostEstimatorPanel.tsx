import type { CostSettings } from "../types";
import { computeCosts, type LegCostInput } from "../data/costDefaults";

interface Props {
  settings: CostSettings;
  onChange: (settings: CostSettings) => void;
  legs: LegCostInput[];
}

export function CostEstimatorPanel({ settings, onChange, legs }: Props) {
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
          Tolls
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
        {perLeg.map((leg) => (
          <div key={leg.label} className="cost-leg-row">
            <div className="cost-leg-label">{leg.label}</div>
            <div className="cost-leg-items">
              <span>
                Fuel: {settings.currency}
                {leg.fuel.toFixed(0)}
              </span>
              <span>
                Tolls: {settings.currency}
                {leg.tolls.toFixed(0)}
              </span>
              <span>
                Hotel: {settings.currency}
                {leg.hotel.toFixed(0)}
              </span>
            </div>
          </div>
        ))}

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
