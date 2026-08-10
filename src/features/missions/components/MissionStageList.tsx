import { Plus } from "lucide-react";
import { StageRow, type StageDraft } from "./StageRow";
import type { WaypointDraft } from "./WaypointRow";
import type { WaypointFrame } from "./FrameChip";
import type { StageKind } from "./stageTypes";
import type { Site } from "@/api/client";

interface MissionStageListProps {
  stages: StageDraft[];
  sites: Site[];
  addingIndex: number | null;
  onChangeStageKind: (stageIndex: number, kind: StageKind) => void;
  onChangeStageFrame: (stageIndex: number, frame: WaypointFrame) => void;
  onChangeStageSiteId: (stageIndex: number, siteId: string) => void;
  onChangeWaypoint: (
    stageIndex: number,
    waypointIndex: number,
    field: keyof WaypointDraft,
    value: string,
  ) => void;
  onAddWaypoint: (stageIndex: number) => void;
  onRemoveWaypoint: (stageIndex: number, waypointIndex: number) => void;
  onMoveStageUp: (stageIndex: number) => void;
  onMoveStageDown: (stageIndex: number) => void;
  onRemoveStage: (stageIndex: number) => void;
  onArmAddMode: (stageIndex: number) => void;
  onCancelAddMode: () => void;
  onAddStage: () => void;
}

export function MissionStageList(props: MissionStageListProps) {
  return (
    <div className="flex flex-col gap-2">
      {props.stages.map((stage, i) => (
        <StageRow
          key={i}
          index={i}
          stage={stage}
          sites={props.sites}
          totalStages={props.stages.length}
          isAdding={props.addingIndex === i}
          onChangeKind={(k) => props.onChangeStageKind(i, k)}
          onChangeFrame={(f) => props.onChangeStageFrame(i, f)}
          onChangeSiteId={(id) => props.onChangeStageSiteId(i, id)}
          onChangeWaypoint={(wi, f, v) => props.onChangeWaypoint(i, wi, f, v)}
          onAddWaypoint={() => props.onAddWaypoint(i)}
          onRemoveWaypoint={(wi) => props.onRemoveWaypoint(i, wi)}
          onMoveUp={() => props.onMoveStageUp(i)}
          onMoveDown={() => props.onMoveStageDown(i)}
          onRemoveStage={() => props.onRemoveStage(i)}
          onArmAddMode={() => props.onArmAddMode(i)}
          onCancelAddMode={props.onCancelAddMode}
        />
      ))}
      <button
        type="button"
        onClick={props.onAddStage}
        className="text-ui-sm text-t2 border border-dashed border-border rounded-lg px-4 py-2 hover:bg-white transition-colors inline-flex items-center gap-1.5 self-start"
      >
        <Plus className="w-3.5 h-3.5" />
        Add stage
      </button>
    </div>
  );
}
