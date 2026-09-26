import type { BorderCrossing } from "../types";
import {
  DATA_CHECKED_DATE,
  MERCOSUR_BLOC,
  YELLOW_FEVER_RELEVANT,
  getVisaRequirement,
  nationalityName,
} from "../data/borderRequirements";

interface Props {
  passports: string[];
  crossings: BorderCrossing[];
  detecting: boolean;
  error: string | null;
  onDetect: () => void;
  hasRoute: boolean;
  showDisclaimer?: boolean;
}

function visaLine(nationalityCode: string, countryCode: string): string {
  if (nationalityCode === countryCode) {
    return "This is your passport's own country.";
  }

  const result = getVisaRequirement(nationalityCode, countryCode);
  if (!result) {
    return "No curated data for this nationality/country pair — check the destination's consulate or IATA Travel Centre.";
  }

  const { entry, isProxy } = result;
  let text: string;

  if (entry.status === "visa-free") {
    text = `Visa-free${entry.days ? ` for up to ${entry.days} days` : ""}.`;
    if (entry.idCardAccepted && MERCOSUR_BLOC.has(nationalityCode) && MERCOSUR_BLOC.has(countryCode)) {
      text += " National ID card accepted instead of a passport (Mercosur/associated-states agreement).";
    }
    if (entry.feeOnArrival) {
      text += " An entry fee/tourist card is payable on arrival.";
    }
  } else if (entry.status === "e-visa") {
    text = "Electronic visa (e-Visa) required — apply online before travel.";
  } else {
    text = "Visa required — apply in advance at a consulate.";
  }

  if (entry.note) {
    text += ` (${entry.note})`;
  }
  if (isProxy) {
    text += " Based on Schengen/Australia-equivalent policy — verify for your exact nationality.";
  }

  return text;
}

export function BorderCrossingPanel({
  passports,
  crossings,
  detecting,
  error,
  onDetect,
  hasRoute,
  showDisclaimer = true,
}: Props) {
  if (!hasRoute) return null;

  return (
    <div className="border-panel sidebar-section">
      <h2>Border Crossing Documents</h2>
      {showDisclaimer && (
        <p className="border-disclaimer">
          General guidance only, not legal advice. Curated from Wikipedia's visa-policy pages,
          checked {DATA_CHECKED_DATE} — rules change often, so confirm with the destination
          country's consulate or{" "}
          <a href="https://www.iatatravelcentre.com" target="_blank" rel="noreferrer">
            IATA Travel Centre
          </a>{" "}
          before you travel.
        </p>
      )}

      {passports.length === 0 && (
        <p className="border-hint">Select your passport(s) above to see entry requirements per border.</p>
      )}

      {passports.length > 0 && crossings.length === 0 && !detecting && (
        <button className="detect-btn" onClick={onDetect}>
          Detect countries crossed
        </button>
      )}

      {detecting && <div className="border-loading">Detecting countries along the route…</div>}

      {error && (
        <div className="stop-attractions-error">
          {error}{" "}
          <button className="retry-link" onClick={onDetect}>
            Retry
          </button>
        </div>
      )}

      {passports.length > 0 && crossings.length > 0 && (
        <div className="crossing-list">
          {crossings.length === 1 ? (
            <p className="border-hint">
              Your route stays within {crossings[0].countryName} — no border crossings detected.
            </p>
          ) : (
            crossings.map((crossing, i) => {
              if (i === 0) {
                return (
                  <div key={i} className="crossing-card crossing-card-start">
                    <h3>Starting in {crossing.countryName}</h3>
                  </div>
                );
              }

              return (
                <div key={i} className="crossing-card">
                  <h3>
                    Entering {crossing.countryName}{" "}
                    <span className="crossing-km">~{crossing.atDistanceKm.toFixed(0)} km</span>
                  </h3>

                  <ul className="passport-requirement-list">
                    {passports.map((p) => (
                      <li key={p}>
                        <strong>{nationalityName(p)} passport:</strong>{" "}
                        {visaLine(p, crossing.countryCode)}
                      </li>
                    ))}
                  </ul>

                  <ul className="generic-checklist">
                    <li>Passport valid at least 6 months beyond entry date (typical rule — confirm exact requirement)</li>
                    <li>
                      Vehicle registration/title, driver's license (an International Driving
                      Permit is recommended), and insurance valid in {crossing.countryName}
                    </li>
                    {YELLOW_FEVER_RELEVANT.has(crossing.countryCode) && (
                      <li>
                        Yellow fever vaccination certificate — often required or recommended for
                        Amazon-basin border crossings; verify current rule
                      </li>
                    )}
                  </ul>
                </div>
              );
            })
          )}

          <button className="detect-btn detect-btn-secondary" onClick={onDetect}>
            Re-detect
          </button>
        </div>
      )}
    </div>
  );
}
