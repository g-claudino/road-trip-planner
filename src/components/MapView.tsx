import { Fragment, useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { LatLng, RouteStop, Place, DayPlan, RouteResult } from "../types";

function makeDivIcon(label: string, color: string, size = 28) {
  return L.divIcon({
    className: "",
    html: `<div class="map-pin" style="background:${color};width:${size}px;height:${size}px;line-height:${size}px;">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const attractionIcon = makeDivIcon("★", "#8e44ad", 20);

function FitBounds({ coordinates }: { coordinates: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length === 0) return;
    const bounds = L.latLngBounds(coordinates.map((c) => [c.lat, c.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [coordinates, map]);

  return null;
}

export interface LegMapData {
  key: string;
  label: string;
  color: string;
  overnightColor: string;
  start: Place | null;
  end: Place | null;
  routeCoordinates: LatLng[];
  stops: RouteStop[];
  dayPlans: DayPlan[];
  route: RouteResult | null;
  onStopDrag?: (index: number, location: LatLng) => void;
}

interface Props {
  legs: LegMapData[];
}

export function MapView({ legs }: Props) {
  const defaultCenter: [number, number] = [-15, -60];
  const allCoordinates = legs.flatMap((l) => l.routeCoordinates);

  return (
    <MapContainer center={defaultCenter} zoom={4} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {allCoordinates.length > 0 && <FitBounds coordinates={allCoordinates} />}

      {legs.map((leg) => {
        const overnightIndices = new Set(
          leg.dayPlans
            .filter((d) => d.overnightStopIndex !== null)
            .map((d) => d.overnightStopIndex as number),
        );

        return (
          <Fragment key={leg.key}>
            {leg.routeCoordinates.length > 0 && (
              <Polyline
                positions={leg.routeCoordinates.map((c) => [c.lat, c.lng])}
                pathOptions={{ color: leg.color, weight: 4, opacity: 0.8 }}
              />
            )}

            {leg.start && (
              <Marker
                position={[leg.start.lat, leg.start.lng]}
                icon={makeDivIcon("A", leg.color, 30)}
              >
                <Popup>
                  <strong>{leg.label} start:</strong> {leg.start.label}
                </Popup>
              </Marker>
            )}

            {leg.end && (
              <Marker position={[leg.end.lat, leg.end.lng]} icon={makeDivIcon("B", leg.color, 30)}>
                <Popup>
                  <strong>{leg.label} end:</strong> {leg.end.label}
                </Popup>
              </Marker>
            )}

            {leg.stops.map((stop, i) => (
              <Marker
                key={i}
                position={[stop.location.lat, stop.location.lng]}
                icon={makeDivIcon(
                  String(i + 1),
                  overnightIndices.has(i) ? leg.overnightColor : leg.color,
                )}
                draggable={!!leg.onStopDrag}
                eventHandlers={
                  leg.onStopDrag
                    ? {
                        dragend: (e) => {
                          const pos = e.target.getLatLng();
                          leg.onStopDrag!(i, { lat: pos.lat, lng: pos.lng });
                        },
                      }
                    : undefined
                }
              >
                <Popup>
                  <strong>
                    {leg.label} Stop {i + 1}
                    {overnightIndices.has(i) ? " · overnight" : ""}
                  </strong>
                  <div>{stop.distanceFromStartKm.toFixed(0)} km from start</div>
                  <div>~{stop.cumulativeDurationH.toFixed(1)} h driving</div>
                  {leg.onStopDrag && <div className="map-pin-hint">Drag to move this stop</div>}
                </Popup>
              </Marker>
            ))}

            {leg.stops.flatMap((stop) =>
              stop.attractions.map((a) => (
                <Marker key={a.id} position={[a.lat, a.lng]} icon={attractionIcon}>
                  <Popup>
                    <strong>{a.name}</strong>
                    <div>{a.category}</div>
                    <div>{a.distanceKm.toFixed(1)} km from stop</div>
                  </Popup>
                </Marker>
              )),
            )}
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
