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
import { cn } from "@/lib/utils";
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
function AccuracyCircle({ robotId }: { robotId: string }) {
  const pose = useFleet((s) => s.robots[robotId]?.pose ?? null);
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

// Stops the click at the marker, so it does not also reach the map as a click on the ground.
function markerClick(id: string, onClick: ((id: string) => void) | undefined) {
  if (!onClick) return undefined;
  return (e: MarkerEvent<MouseEvent>) => {
    e.originalEvent.stopPropagation();
    onClick(id);
  };
}

interface MarkerProps {
  id: string;
  onClick?: (id: string) => void;
}

// Selects fields rather than the entry, because the store updates a robot's entry in place.
function FullMarker({
  id,
  highlighted,
  onClick,
}: MarkerProps & { highlighted: boolean }) {
  const pose = useFleet((s) => s.robots[id]?.pose ?? null);
  const online = useFleet((s) => s.robots[id]?.online ?? false);
  const status = useFleet((s) => s.robots[id]?.status ?? null);
  if (!pose) return null;

  const color = online
    ? (MARKER_COLOR[status ?? "idle"] ?? "#94A3B8")
    : MARKER_COLOR.offline;
  const heading = online ? pose.heading_deg : null;

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
      <Marker
        longitude={pose.lon}
        latitude={pose.lat}
        onClick={markerClick(id, onClick)}
      >
        <div
          title={id}
          className={cn(
            "flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white/85 text-[7px] font-bold leading-none text-white",
            onClick && "cursor-pointer",
          )}
          style={{
            background: color,
            opacity: online ? 1 : 0.6,
            boxShadow:
              online && highlighted
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

// The full marker's shape without colour or heading, so it reads as a robot and never as a route point.
function MutedMarker({ id, onClick }: MarkerProps) {
  const pose = useFleet((s) => s.robots[id]?.pose ?? null);
  const online = useFleet((s) => s.robots[id]?.online ?? false);
  if (!pose || !online) return null;
  return (
    <Marker
      longitude={pose.lon}
      latitude={pose.lat}
      onClick={markerClick(id, onClick)}
      className="hover:z-10"
    >
      <div className="group relative flex">
        <div
          title={id}
          aria-label={id}
          className={cn(
            "flex h-3 w-3 items-center justify-center rounded-full border-[1.5px] border-white bg-[#64748B] text-[5px] font-bold leading-none text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]",
            onClick && "cursor-pointer",
          )}
        >
          {id.slice(-2)}
        </div>
        <span className="pointer-events-none invisible absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-tight text-[#334155] shadow-[0_1px_3px_rgba(15,23,42,0.18)] group-hover:visible">
          {id}
        </span>
      </div>
    </Marker>
  );
}

interface RobotsLayerProps {
  /** Robots drawn in full while every other online robot is muted. Unset draws every robot in full. */
  fullIds?: readonly string[];
  /** The robot drawn with a ring and its position accuracy. */
  highlightId?: string | null;
  /** Without it the markers take no clicks, so a click on a robot still reaches the map. */
  onRobotClick?: (id: string) => void;
}

// Each marker subscribes to its own robot, so a position update re-renders one marker and not the list.
export function RobotsLayer({
  fullIds,
  highlightId = null,
  onRobotClick,
}: RobotsLayerProps) {
  const ids = useFleet(
    useShallow((s) =>
      Object.values(s.robots)
        .filter((r) => r.pose)
        .map((r) => r.id),
    ),
  );
  return (
    <>
      {highlightId && <AccuracyCircle robotId={highlightId} />}
      {ids.map((id) =>
        !fullIds || fullIds.includes(id) ? (
          <FullMarker
            key={id}
            id={id}
            highlighted={id === highlightId}
            onClick={onRobotClick}
          />
        ) : (
          <MutedMarker key={id} id={id} onClick={onRobotClick} />
        ),
      )}
    </>
  );
}
