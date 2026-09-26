import type { DayPlan, RouteResult, RouteStop } from "../types";

interface Props {
  route: RouteResult | null;
  stops: RouteStop[];
  days: number;
  onDaysChange: (n: number) => void;
  maxHoursPerDay: number;
  onMaxHoursChange: (n: number) => void;
  suggestedDays: number;
  dayPlans: DayPlan[];
}

export function ItineraryPanel({
  route,
  stops,
  days,
  onDaysChange,
  maxHoursPerDay,
  onMaxHoursChange,
  suggestedDays,
  dayPlans,
}: Props) {
  if (!route) return null;

  const shortOfStops = dayPlans.length > 0 && dayPlans.length < days;

  return (
    <div className="itinerary-panel sidebar-section">
      <h2>Multi-Day Itinerary</h2>

      <div className="itinerary-controls">
        <label>
          Trip length
          <input
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => onDaysChange(Math.max(1, Number(e.target.value)))}
          />
          days
        </label>

        <label>
          Max driving hours/day
          <input
            type="number"
            min={1}
            max={16}
            value={maxHoursPerDay}
            onChange={(e) => onMaxHoursChange(Math.max(1, Number(e.target.value)))}
          />
          h
        </label>
      </div>

      <div className="itinerary-suggestion">
        Suggested: <strong>{suggestedDays} days</strong> at ~{maxHoursPerDay}h driving/day.{" "}
        {days !== suggestedDays && (
          <button className="retry-link" onClick={() => onDaysChange(suggestedDays)}>
            Use suggested
          </button>
        )}
      </div>

      {shortOfStops && (
        <p className="border-hint">
          Only {stops.length} sightseeing stops are available to sleep at, so this trip is shown
          as {dayPlans.length} days instead of {days}. Lower the "stop every N km" setting for more
          overnight options.
        </p>
      )}

      <ol className="day-list">
        {dayPlans.map((day) => (
          <li key={day.dayNumber} className="day-item">
            <div className="day-item-header">
              <span className="day-badge">{day.dayNumber}</span>
              <span>
                {day.distanceKm.toFixed(0)} km · {day.drivingHours.toFixed(1)} h driving
              </span>
            </div>
            <div className="day-item-end">
              {day.overnightStopIndex === null
                ? "Arrive at destination"
                : `Overnight at Stop ${day.overnightStopIndex + 1} (${stops[day.overnightStopIndex].distanceFromStartKm.toFixed(0)} km)`}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
