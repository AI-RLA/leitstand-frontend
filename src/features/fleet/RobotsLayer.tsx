import { useMemo } from "react";
import {
  Layer,
  Marker,
  Source,
  type MarkerEvent,
} from "@vis.gl/react-maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
} from "maplibre-gl";
import type { Feature, Polygon } from "geojson";
import { useShallow } from "zustand/react/shallow";
import { useFleet } from "@/stores/fleet";
import { MARKER_COLOR } from "./constants";

const METRES_PER_DEGREE = 111_320;
const CIRCLE_STEPS = 64;

const ACCURACY_FILL: FillLayerSpecification["paint"] = {
  "fill-color": "#3B82F6",
  "fill-opacity": 0.12,
};
const ACCURACY_LINE: LineLayerSpecification["paint"] = {
  "line-color": "#3B82F6",
  "line-opacity": 0.5,
  "line-width": 1,
};

const NOTCH_STYLE = { pointerEvents: "none" } as const;

function circle(lon: number, lat: number, radiusM: number): Feature<Polygon> {
  const dLat = radiusM / METRES_PER_DEGREE;
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  const ring = Array.from({ length: CIRCLE_STEPS }, (_, i) => {
    const a = (2 * Math.PI * i) / CIRCLE_STEPS;
    return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)];
  });
  ring.push(ring[0]);
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
    properties: {},
  };
}

// A geographic circle rather than a sized element, so it scales with the zoom on its own.
function AccuracyCircle() {
  const pose = useFleet((s) =>
    s.selectedId ? (s.robots[s.selectedId]?.pose ?? null) : null,
  );
  const radius = pose?.horizontal_accuracy_m;
  const data = useMemo(
    () =>
      pose && typeof radius === "number" && Number.isFinite(radius)
        ? circle(pose.lon, pose.lat, radius)
        : null,
    [pose, radius],
  );
  if (!data) return null;
  return (
    <Source id="robot-accuracy" type="geojson" data={data}>
      <Layer id="robot-accuracy-fill" type="fill" paint={ACCURACY_FILL} />
      <Layer id="robot-accuracy-line" type="line" paint={ACCURACY_LINE} />
    </Source>
  );
}

// Selects fields rather than the entry, because the store updates a robot's entry in place.
function RobotMarker({ id }: { id: string }) {
  const pose = useFleet((s) => s.robots[id]?.pose ?? null);
  const online = useFleet((s) => s.robots[id]?.online ?? false);
  const status = useFleet((s) => s.robots[id]?.status ?? null);
  const selected = useFleet((s) => s.selectedId === id);
  if (!pose) return null;

  const color = online
    ? (MARKER_COLOR[status ?? "idle"] ?? "#94A3B8")
    : MARKER_COLOR.offline;
  const heading = online ? pose.heading_deg : null;

  // Stops the click here, so it does not also reach the map as a click outside every field.
  function onClick(e: MarkerEvent<MouseEvent>) {
    e.originalEvent.stopPropagation();
    const { selectedId, select } = useFleet.getState();
    select(selectedId === id ? null : id);
  }

  // The notch stays mounted and only empties, so it keeps its place under the dot in the DOM.
  return (
    <>
      <Marker
        longitude={pose.lon}
        latitude={pose.lat}
        rotation={heading ?? 0}
        rotationAlignment="map"
        pitchAlignment="map"
        style={NOTCH_STYLE}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
          {heading != null && (
            <path
              d="M20 3 L25.5 11 L14.5 11 Z"
              fill="#fff"
              stroke={color}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </Marker>
      <Marker longitude={pose.lon} latitude={pose.lat} onClick={onClick}>
        <div
          title={id}
          className="flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-2 border-white/85 text-[7px] font-bold leading-none text-white"
          style={{
            background: color,
            opacity: online ? 1 : 0.6,
            boxShadow:
              online && selected
                ? "0 0 0 3px rgba(22,163,74,0.35), 0 2px 8px rgba(0,0,0,0.4)"
                : "0 2px 8px rgba(0,0,0,0.35)",
          }}
        >
          {id.slice(-2)}
        </div>
      </Marker>
    </>
  );
}

// Each marker subscribes to its own robot, so a position update re-renders one marker and not the list.
export function RobotsLayer() {
  const ids = useFleet(
    useShallow((s) =>
      Object.values(s.robots)
        .filter((r) => r.pose)
        .map((r) => r.id),
    ),
  );
  return (
    <>
      <AccuracyCircle />
      {ids.map((id) => (
        <RobotMarker key={id} id={id} />
      ))}
    </>
  );
}
