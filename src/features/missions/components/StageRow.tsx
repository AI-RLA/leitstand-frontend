import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavigationStageBody } from "./NavigationStageBody";
import { StageKindSelect } from "./StageKindSelect";
import type { StageDraft, StageKind } from "./stageTypes";
import type { WaypointFrame } from "./FrameChip";
import type { WaypointDraft } from "./WaypointRow";
import type { Site } from "@/api/client";

// Re-export for convenience so consumers can keep importing `StageDraft`
// from this file. The discriminated union itself lives in stageTypes.ts.
export type { StageDraft } from "./stageTypes";

interface StageRowProps {
  index: number;
  stage: StageDraft;
  sites: Site[];
  totalStages: number;
  isAdding: boolean;
  onChangeKind: (k: StageKind) => void;
  onChangeFrame: (f: WaypointFrame) => void;
  onChangeSiteId: (id: string) => void;
  onChangeWaypoint: (
    waypointIndex: number,
    field: keyof WaypointDraft,
    value: string,
  ) => void;
  onAddWaypoint: () => void;
  onRemoveWaypoint: (waypointIndex: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemoveStage: () => void;
  onArmAddMode: () => void;
  onCancelAddMode: () => void;
}

export function StageRow({
  index,
  stage,
  sites,
  totalStages,
  isAdding,
  onChangeKind,
  onChangeFrame,
  onChangeSiteId,
  onChangeWaypoint,
  onAddWaypoint,
  onRemoveWaypoint,
  onMoveUp,
  onMoveDown,
  onRemoveStage,
  onArmAddMode,
  onCancelAddMode,
}: StageRowProps) {
  return (
    <div
      className={cn(
        "bg-white border rounded-lg overflow-hidden transition-colors",
        isAdding ? "border-primary" : "border-border",
      )}
    >
      {/* Header — stage index, kind label, reorder/remove controls */}
      <div className="px-3 py-2 border-b border-border bg-[#F8FAFC] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
            Stage {index + 1}
          </span>
          <StageKindSelect value={stage.kind} onChange={onChangeKind} />
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <IconButton label="Move up" disabled={index === 0} onClick={onMoveUp}>
            <ChevronUp className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton
            label="Move down"
            disabled={index === totalStages - 1}
            onClick={onMoveDown}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </IconButton>
          {totalStages > 1 && (
            <button
              type="button"
              onClick={onRemoveStage}
              className="text-ui-xs text-red-400 hover:text-red-600 transition-colors ml-1"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Body routed by kind. Switch will fall through when new kinds land
          and TypeScript will require a matching body component. */}
      {stage.kind === "navigation" && (
        <NavigationStageBody
          stage={stage}
          sites={sites}
          isAdding={isAdding}
          onChangeFrame={onChangeFrame}
          onChangeSiteId={onChangeSiteId}
          onChangeWaypoint={onChangeWaypoint}
          onAddWaypoint={onAddWaypoint}
          onRemoveWaypoint={onRemoveWaypoint}
          onArmAddMode={onArmAddMode}
          onCancelAddMode={onCancelAddMode}
        />
      )}
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="text-t3 hover:text-t1 hover:bg-white rounded p-0.5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-t3"
    >
      {children}
    </button>
  );
}
