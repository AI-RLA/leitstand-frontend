import type { WaypointFrame } from "./FrameChip";
import type { WaypointDraft } from "./WaypointRow";

// All stage kinds the backend recognises. Today it ships only "navigation".
// When the backend adds more (e.g. "wait", "charge", "dock"), extend this
// union and add a sibling `<KindStageBody />` component routed by StageRow.
export type StageKind = "navigation";

// Discriminated by `kind`. Today this is a single-member union; the shape is
// in place so adding kinds is purely additive — extend StageKind, add another
// member here, add the matching body component.
export interface NavigationStageDraft {
  kind: "navigation";
  frame: WaypointFrame;
  site_id: string;
  waypoints: WaypointDraft[];
}

export type StageDraft = NavigationStageDraft;

export const KIND_LABEL: Record<StageKind, string> = {
  navigation: "Navigation",
};
