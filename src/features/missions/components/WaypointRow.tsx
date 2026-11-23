import { X } from "lucide-react";
import { compassBearing, parseDecimal } from "@/lib/units";
import type { WaypointFrame } from "./FrameChip";

export interface WaypointDraft {
  lat: string;
  lon: string;
  heading_deg: string;
  x: string;
  y: string;
  // Degrees for the operator, sent as radians, which is what the API and the robot use.
  theta_deg: string;
  // The radians a loaded waypoint holds, sent back as they are while theta_deg still shows them.
  theta_stored?: number;
}

export type WaypointField = Exclude<keyof WaypointDraft, "theta_stored">;

interface WaypointRowProps {
  frame: WaypointFrame;
  index: number;
  waypoint: WaypointDraft;
  canRemove: boolean;
  onChange: (field: WaypointField, value: string) => void;
  onRemove: () => void;
}

export function WaypointRow({
  frame,
  index,
  waypoint,
  canRemove,
  onChange,
  onRemove,
}: WaypointRowProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ui-xs text-t3 w-5 text-right shrink-0 font-mono">
        {index + 1}
      </span>
      {frame === "wgs84" ? (
        <>
          <Numeric
            placeholder="Lat"
            value={waypoint.lat}
            required
            onChange={(v) => onChange("lat", v)}
            className="w-24"
          />
          <Numeric
            placeholder="Lon"
            value={waypoint.lon}
            required
            onChange={(v) => onChange("lon", v)}
            className="w-24"
          />
          <Numeric
            placeholder="Hdg°"
            title="Heading in degrees, clockwise from north"
            value={waypoint.heading_deg}
            onChange={(v) => onChange("heading_deg", v)}
            onBlur={(v) => {
              const deg = parseDecimal(v);
              if (!Number.isNaN(deg)) {
                onChange("heading_deg", String(compassBearing(deg)));
              }
            }}
            className="w-16"
          />
        </>
      ) : (
        <>
          <Numeric
            placeholder="x (m)"
            value={waypoint.x}
            required
            onChange={(v) => onChange("x", v)}
            className="w-20"
          />
          <Numeric
            placeholder="y (m)"
            value={waypoint.y}
            required
            onChange={(v) => onChange("y", v)}
            className="w-20"
          />
          <Numeric
            placeholder="θ°"
            title="Heading in degrees, counter-clockwise from the site's x axis"
            value={waypoint.theta_deg}
            onChange={(v) => onChange("theta_deg", v)}
            className="w-16"
          />
        </>
      )}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove waypoint"
          className="text-t3 hover:text-red-500 transition-colors ml-0.5"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function Numeric({
  value,
  onChange,
  placeholder,
  title,
  required,
  onBlur,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  placeholder: string;
  title?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <input
      // A text field, because a number field drops a typed decimal comma in some browsers.
      type="text"
      inputMode="decimal"
      required={required}
      placeholder={placeholder}
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur && ((e) => onBlur(e.target.value))}
      className={`border border-border rounded px-2 py-1 text-ui-sm font-mono text-t1 bg-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition ${className}`}
    />
  );
}
