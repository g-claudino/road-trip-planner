import { useState } from "react";
import type { LatLng } from "../types";
import { buildGoogleMapsUrl, buildWazeLegs, buildWazeUrl } from "../utils/exportRoute";

interface Props {
  origin: LatLng;
  destination: LatLng;
  stops: LatLng[];
  startLabel: string;
  endLabel: string;
}

export function ExportRoutePanel({ origin, destination, stops, startLabel, endLabel }: Props) {
  const [showWazeLegs, setShowWazeLegs] = useState(false);

  const googleUrl = buildGoogleMapsUrl(origin, destination, stops);
  const wazeUrl = buildWazeUrl(destination);
  const wazeLegs = buildWazeLegs(origin, stops, destination, startLabel, endLabel);

  return (
    <div className="export-routes">
      <span className="export-routes-label">Export route</span>
      <div className="export-routes-buttons">
        <a className="export-btn" href={googleUrl} target="_blank" rel="noreferrer">
          Open in Google Maps ↗
        </a>
        <a className="export-btn" href={wazeUrl} target="_blank" rel="noreferrer">
          Open in Waze ↗
        </a>
      </div>

      {stops.length > 0 && (
        <>
          <button className="retry-link export-waze-toggle" onClick={() => setShowWazeLegs((v) => !v)}>
            {showWazeLegs ? "Hide leg-by-leg Waze links" : "Waze can't do multi-stop routes — navigate leg by leg instead"}
          </button>

          {showWazeLegs && (
            <ul className="export-leg-list">
              {wazeLegs.map((leg, i) => (
                <li key={i}>
                  <a href={leg.url} target="_blank" rel="noreferrer">
                    {leg.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
