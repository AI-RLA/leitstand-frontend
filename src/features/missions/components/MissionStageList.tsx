import { useState } from "react";
import { Plus, X } from "lucide-react";
import { StageRow } from "./StageRow";
import { StageKindSelect } from "./StageKindSelect";
import type { CoverageStageDraft, StageDraft, StageKind } from "./stageTypes";
import type { WaypointDraft } from "./WaypointRow";
import type { WaypointFrame } from "./FrameChip";
import type { Field, Robot, Site } from "@/api/client";

interface MissionStageListProps {
  stages: StageDraft[];
  sites: Site[];
  fields: Field[];
  robots: Robot[];
  addingIndex: number | null;
  onChangeCoverage: (
    stageIndex: number,
    patch: Partial<CoverageStageDraft>,
  ) => void;
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
  onAddStage: (kind: StageKind) => void;
}

export function MissionStageList(props: MissionStageListProps) {
  // The kind is chosen before a row exists: a row's body is shaped by its kind, so a row cannot
  // change kind without losing its waypoints or its plan.
  const [choosingKind, setChoosingKind] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {props.stages.map((stage, i) => (
        <StageRow
          key={i}
          index={i}
          stage={stage}
          sites={props.sites}
          fields={props.fields}
          robots={props.robots}
          totalStages={props.stages.length}
          isAdding={props.addingIndex === i}
          onChangeCoverage={(patch) => props.onChangeCoverage(i, patch)}
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
      {choosingKind ? (
        <div className="bg-white border border-primary rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
              Stage {props.stages.length + 1}
            </span>
            <StageKindSelect
              value=""
              autoFocus
              onChange={(kind) => {
                props.onAddStage(kind);
                setChoosingKind(false);
              }}
            />
          </div>
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setChoosingKind(false)}
            className="text-t3 hover:text-t1 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setChoosingKind(true)}
          className="text-ui-sm text-t2 border border-dashed border-border rounded-lg px-4 py-2 hover:bg-white transition-colors inline-flex items-center gap-1.5 self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          Add stage
        </button>
      )}
    </div>
  );
}
