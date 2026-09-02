import { Plus, Crosshair } from "lucide-react";
import { FrameChip, type WaypointFrame } from "./FrameChip";
import { WaypointRow, type WaypointDraft } from "./WaypointRow";
import type { NavigationStageDraft } from "./stageTypes";
import type { Site } from "@/api/client";

interface NavigationStageBodyProps {
  stage: NavigationStageDraft;
  sites: Site[];
  isAdding: boolean;
  onChangeFrame: (f: WaypointFrame) => void;
  onChangeSiteId: (id: string) => void;
  onChangeWaypoint: (
    waypointIndex: number,
    field: keyof WaypointDraft,
    value: string,
  ) => void;
  onAddWaypoint: () => void;
  onRemoveWaypoint: (waypointIndex: number) => void;
  onArmAddMode: () => void;
  onCancelAddMode: () => void;
}

export function NavigationStageBody({
  stage,
  sites,
  isAdding,
  onChangeFrame,
  onChangeSiteId,
  onChangeWaypoint,
  onAddWaypoint,
  onRemoveWaypoint,
  onArmAddMode,
  onCancelAddMode,
}: NavigationStageBodyProps) {
  return (
    <div className="p-3 flex flex-col gap-2">
      {/* Frame selector */}
      <div className="flex items-center gap-2">
        <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
          Frame
        </span>
        <FrameChip value={stage.frame} onChange={onChangeFrame} />
      </div>

      {/* Site picker for site_local */}
      {stage.frame === "site_local" && (
        <div>
          <select
            required
            value={stage.site_id}
            onChange={(e) => onChangeSiteId(e.target.value)}
            className="w-full border border-border rounded-md px-3 py-1.5 text-ui-sm text-t1 bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
          >
            <option value="">Select site…</option>
            {sites.map((site) => (
              <option key={site.site_id} value={site.site_id}>
                {site.name}
              </option>
            ))}
          </select>
          {sites.length === 0 && (
            <p className="text-ui-xs text-t3 mt-1">
              No sites defined. Create one under Sites first.
            </p>
          )}
        </div>
      )}

      {/* Waypoints */}
      {stage.waypoints.map((wp, wi) => (
        <WaypointRow
          key={wi}
          frame={stage.frame}
          index={wi}
          waypoint={wp}
          canRemove={stage.waypoints.length > 1}
          onChange={(field, value) => onChangeWaypoint(wi, field, value)}
          onRemove={() => onRemoveWaypoint(wi)}
        />
      ))}

      {/* Add waypoint controls */}
      <div className="flex items-center gap-2 mt-0.5">
        <button
          type="button"
          onClick={onAddWaypoint}
          className="text-ui-xs text-t2 border border-dashed border-border rounded px-2.5 py-1 hover:bg-muted transition-colors inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add waypoint
        </button>
        {isAdding ? (
          <button
            type="button"
            onClick={onCancelAddMode}
            className="text-ui-xs font-medium bg-primary/10 text-[#15803D] border border-primary/30 rounded px-2.5 py-1 inline-flex items-center gap-1"
          >
            <Crosshair className="w-3 h-3" />
            Click map · cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={onArmAddMode}
            disabled={stage.frame === "site_local" && !stage.site_id}
            className="text-ui-xs text-primary border border-primary/40 rounded px-2.5 py-1 hover:bg-primary/5 transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Crosshair className="w-3 h-3" />
            Pick on map
          </button>
        )}
      </div>
    </div>
  );
}
