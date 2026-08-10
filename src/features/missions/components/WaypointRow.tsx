import { X } from "lucide-react";
import type { WaypointFrame } from "./FrameChip";

export interface WaypointDraft {
  lat: string;
  lon: string;
  heading_deg: string;
  x: string;
  y: string;
  theta: string;
}

interface WaypointRowProps {
  frame: WaypointFrame;
  index: number;
  waypoint: WaypointDraft;
  canRemove: boolean;
  onChange: (field: keyof WaypointDraft, value: string) => void;
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
            min={-90}
            max={90}
            required
            onChange={(v) => onChange("lat", v)}
            className="w-24"
          />
          <Numeric
            placeholder="Lon"
            value={waypoint.lon}
            min={-180}
            max={180}
            required
            onChange={(v) => onChange("lon", v)}
            className="w-24"
          />
          <Numeric
            placeholder="Hdg°"
            value={waypoint.heading_deg}
            min={-180}
            max={180}
            onChange={(v) => onChange("heading_deg", v)}
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
            placeholder="θ"
            value={waypoint.theta}
            onChange={(v) => onChange("theta", v)}
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
  min,
  max,
  required,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  min?: number;
  max?: number;
  required?: boolean;
  className?: string;
}) {
  return (
    <input
      type="number"
      step="any"
      min={min}
      max={max}
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border border-border rounded px-2 py-1 text-ui-sm font-mono text-t1 bg-[#F8FAFC] focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${className}`}
    />
  );
}
