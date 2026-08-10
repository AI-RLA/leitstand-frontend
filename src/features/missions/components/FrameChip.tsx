import { Globe, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

// Coordinate frame for every waypoint in a stage. The backend requires all
// waypoints in one stage to share their frame (homogeneity). This is the
// waypoint frame, not the stage kind — `NavigationStage.kind` is always
// "navigation" on the wire.
export type WaypointFrame = "wgs84" | "site_local";

interface FrameChipProps {
  value: WaypointFrame;
  onChange: (f: WaypointFrame) => void;
}

export function FrameChip({ value, onChange }: FrameChipProps) {
  return (
    <div className="inline-flex items-center border border-border rounded-md overflow-hidden text-ui-xs">
      <Option
        active={value === "wgs84"}
        onClick={() => onChange("wgs84")}
        icon={<Globe className="w-3 h-3" />}
        label="WGS84"
      />
      <Option
        active={value === "site_local"}
        onClick={() => onChange("site_local")}
        icon={<MapPin className="w-3 h-3" />}
        label="Site-local"
      />
    </div>
  );
}

function Option({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 font-medium transition-colors",
        active ? "bg-t1 text-white" : "bg-white text-t2 hover:bg-[#F8FAFC]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
