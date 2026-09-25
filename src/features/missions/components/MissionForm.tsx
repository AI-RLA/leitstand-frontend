import { useCallback, useEffect, useState } from "react";
import { useFields } from "@/api/fields";
import { useRobots } from "@/api/robots";
import { NO_SITES, useSites } from "@/api/sites";
import type { Robot, StageInput } from "@/api/client";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { MissionStageList } from "./MissionStageList";
import { MissionMapWorkspace } from "./MissionMapWorkspace";
import { anchorFromSite, latLonToLocal } from "../siteFrame";
import type { WaypointFrame } from "./FrameChip";
import {
  coverageInputs,
  coverageStageInput,
  emptyCoverageDraft,
  emptyNavigationDraft,
  emptyWaypoint,
  type CoverageStageDraft,
  type NavigationStageDraft,
  type StageDraft,
  type StageKind,
} from "./stageTypes";
import type { WaypointDraft } from "./WaypointRow";

export interface MissionFormValues {
  name: string;
  description: string | null;
  stages: StageInput[];
  assignedRobotId: string | null;
}

interface MissionFormProps {
  header: React.ReactNode;
  initialName?: string;
  initialDescription?: string;
  initialStages?: StageDraft[];
  initialRobotId?: string | null;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error: string | null;
  onSubmit: (values: MissionFormValues) => Promise<void>;
  onCancel: () => void;
}

function isEmptyWaypoint(w: WaypointDraft): boolean {
  return !w.lat && !w.lon && !w.heading_deg && !w.x && !w.y && !w.theta;
}

function isValidNumber(v: string): boolean {
  return v !== "" && !Number.isNaN(parseFloat(v));
}

function navigationValid(s: NavigationStageDraft): boolean {
  if (s.waypoints.length === 0) return false;
  if (s.frame === "wgs84") {
    return s.waypoints.every(
      (w) => isValidNumber(w.lat) && isValidNumber(w.lon),
    );
  }
  return (
    s.site_id !== "" &&
    s.waypoints.every((w) => isValidNumber(w.x) && isValidNumber(w.y))
  );
}

// A coverage draft can be saved only as it was last planned: the backend plans from the inputs,
// so unplanned or edited inputs would store a path the operator never saw.
function coverageSavable(s: CoverageStageDraft): boolean {
  return s.planned !== null && !s.dirty;
}

function toStageInput(s: StageDraft): StageInput {
  if (s.kind === "coverage") {
    const built = coverageInputs(s);
    if (!("inputs" in built)) throw new Error(built.error);
    return coverageStageInput(s, built.inputs);
  }
  return {
    kind: "navigation",
    // Kept for a stage that came from the mission; omitted for a new one, which the backend
    // then assigns an id to.
    stage_id: s.stage_id ?? null,
    waypoints:
      s.frame === "wgs84"
        ? s.waypoints.map((w) => ({
            kind: "wgs84" as const,
            lat: parseFloat(w.lat),
            lon: parseFloat(w.lon),
            heading_deg: w.heading_deg ? parseFloat(w.heading_deg) : null,
          }))
        : s.waypoints.map((w) => ({
            kind: "site_local" as const,
            site_id: s.site_id,
            x: parseFloat(w.x),
            y: parseFloat(w.y),
            theta: w.theta ? parseFloat(w.theta) : null,
          })),
  };
}

function updateAt<T>(list: T[], index: number, patch: (item: T) => T): T[] {
  return list.map((item, i) => (i === index ? patch(item) : item));
}

function updateNavigation(
  list: StageDraft[],
  index: number,
  patch: (s: NavigationStageDraft) => NavigationStageDraft,
): StageDraft[] {
  return updateAt(list, index, (s) => (s.kind === "navigation" ? patch(s) : s));
}

export function MissionForm({
  header,
  initialName = "",
  initialDescription = "",
  initialStages = [],
  initialRobotId = null,
  submitLabel,
  pendingLabel,
  isPending,
  error,
  onSubmit,
  onCancel,
}: MissionFormProps) {
  const { data: sites = NO_SITES, isPending: sitesPending } = useSites();
  const { data: fields = [] } = useFields();
  const { data: robots = [] } = useRobots();

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [stages, setStages] = useState<StageDraft[]>(initialStages);
  const [robotId, setRobotId] = useState<string | null>(initialRobotId);

  // The map shows robots from the live feed, which can know a robot before the robot list does.
  function chooseRobot(id: string) {
    if (robots.some((r) => r.id === id)) setRobotId(id);
  }
  const [addingIndex, setAddingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (addingIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddingIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addingIndex]);

  function changeCoverage(si: number, patch: Partial<CoverageStageDraft>) {
    setStages((prev) =>
      updateAt(prev, si, (s) =>
        s.kind === "coverage" ? { ...s, ...patch } : s,
      ),
    );
  }

  function setStageFrame(si: number, frame: WaypointFrame) {
    setStages((prev) =>
      updateNavigation(prev, si, (s) => ({
        ...s,
        frame,
        site_id: "",
        waypoints: [emptyWaypoint()],
      })),
    );
    if (addingIndex === si) setAddingIndex(null);
  }

  function setStageSiteId(si: number, siteId: string) {
    setStages((prev) =>
      updateNavigation(prev, si, (s) => ({ ...s, site_id: siteId })),
    );
  }

  function updateWaypoint(
    si: number,
    wi: number,
    field: keyof WaypointDraft,
    value: string,
  ) {
    setStages((prev) =>
      updateNavigation(prev, si, (s) => ({
        ...s,
        waypoints: updateAt(s.waypoints, wi, (w) => ({ ...w, [field]: value })),
      })),
    );
  }

  function addWaypoint(si: number) {
    setStages((prev) =>
      updateNavigation(prev, si, (s) => ({
        ...s,
        waypoints: [...s.waypoints, emptyWaypoint()],
      })),
    );
  }

  function removeWaypoint(si: number, wi: number) {
    setStages((prev) =>
      updateNavigation(prev, si, (s) => ({
        ...s,
        waypoints: s.waypoints.filter((_, j) => j !== wi),
      })),
    );
  }

  function addStage(kind: StageKind) {
    setStages((prev) => [
      ...prev,
      kind === "navigation"
        ? emptyNavigationDraft()
        : // A new coverage card starts from the mission's robot, whose radius it shows.
          emptyCoverageDraft(robots, robotId),
    ]);
  }

  function removeStage(si: number) {
    setStages((prev) => prev.filter((_, i) => i !== si));
    if (addingIndex !== null) {
      if (addingIndex === si) setAddingIndex(null);
      else if (addingIndex > si) setAddingIndex(addingIndex - 1);
    }
  }

  function moveStage(si: number, direction: -1 | 1) {
    const target = si + direction;
    setStages((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[si], next[target]] = [next[target], next[si]];
      return next;
    });
    if (addingIndex === si) setAddingIndex(target);
    else if (addingIndex === target) setAddingIndex(si);
  }

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      if (addingIndex === null) return;
      const stageIndex = addingIndex;

      setStages((prev) => {
        const stage = prev[stageIndex];
        if (!stage || stage.kind !== "navigation") return prev;

        let next: WaypointDraft;
        if (stage.frame === "wgs84") {
          next = {
            ...emptyWaypoint(),
            lat: lat.toFixed(6),
            lon: lon.toFixed(6),
          };
        } else {
          const site = sites.find((s) => s.site_id === stage.site_id);
          if (!site) return prev;
          const local = latLonToLocal(anchorFromSite(site), lat, lon);
          next = {
            ...emptyWaypoint(),
            x: local.x.toFixed(3),
            y: local.y.toFixed(3),
          };
        }

        const last = stage.waypoints[stage.waypoints.length - 1];
        const newWaypoints =
          last && isEmptyWaypoint(last)
            ? [...stage.waypoints.slice(0, -1), next]
            : [...stage.waypoints, next];

        return updateNavigation(prev, stageIndex, (s) => ({
          ...s,
          waypoints: newWaypoints,
        }));
      });
    },
    [addingIndex, sites],
  );

  const unplanned = stages.some(
    (s) => s.kind === "coverage" && !coverageSavable(s),
  );
  const canSubmit =
    name.trim().length > 0 &&
    stages.length > 0 &&
    !unplanned &&
    stages.every((s) => s.kind === "coverage" || navigationValid(s));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      stages: stages.map(toStageInput),
      assignedRobotId: robotId,
    });
  }

  const waypointCount = stages.reduce(
    (sum, s) => sum + (s.kind === "navigation" ? s.waypoints.length : 0),
    0,
  );
  const coverageCount = stages.filter((s) => s.kind === "coverage").length;

  return (
    <form
      onSubmit={handleSubmit}
      className="h-full flex overflow-hidden bg-muted"
    >
      <div className="w-[520px] shrink-0 flex flex-col border-r border-border bg-white">
        <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          {header}
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="bg-white border border-border rounded-lg p-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                Name
              </span>
              <Input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Field A inspection"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                Description{" "}
                <span className="normal-case font-normal tracking-normal">
                  (optional)
                </span>
              </span>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                Assigned robot
              </span>
              <RobotSelect
                robots={robots}
                value={robotId}
                onChange={setRobotId}
              />
            </label>
          </div>

          <MissionStageList
            stages={stages}
            sites={sites}
            fields={fields}
            robots={robots}
            addingIndex={addingIndex}
            onChangeCoverage={changeCoverage}
            onChangeStageFrame={setStageFrame}
            onChangeStageSiteId={setStageSiteId}
            onChangeWaypoint={updateWaypoint}
            onAddWaypoint={addWaypoint}
            onRemoveWaypoint={removeWaypoint}
            onMoveStageUp={(si) => moveStage(si, -1)}
            onMoveStageDown={(si) => moveStage(si, 1)}
            onRemoveStage={removeStage}
            onArmAddMode={setAddingIndex}
            onCancelAddMode={() => setAddingIndex(null)}
            onAddStage={addStage}
          />
        </div>

        <div className="border-t border-border bg-white px-4 py-3 shrink-0 flex items-center justify-between gap-3">
          <div className="text-ui-xs text-t3 tabular-nums">
            <span className="font-semibold text-t2">{stages.length}</span> stage
            {stages.length === 1 ? "" : "s"}
            <span className="mx-1.5">·</span>
            <span className="font-semibold text-t2">{waypointCount}</span>{" "}
            waypoint{waypointCount === 1 ? "" : "s"}
            {coverageCount > 0 && (
              <>
                <span className="mx-1.5">·</span>
                <span className="font-semibold text-t2">
                  {coverageCount}
                </span>{" "}
                coverage
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unplanned && (
              <span className="text-ui-xs text-t3">
                Plan every coverage stage before saving
              </span>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isPending}
              className="text-ui-sm bg-primary text-white px-4 py-1.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? pendingLabel : submitLabel}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-ui-sm text-red-500 px-4 py-2 border-t border-border bg-red-50">
            {error}
          </p>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden">
        <MissionMapWorkspace
          stages={stages}
          sites={sites}
          sitesReady={!sitesPending}
          robotId={robotId}
          onRobotClick={chooseRobot}
          addingIndex={addingIndex}
          onMapClick={handleMapClick}
          onCancelAddMode={() => setAddingIndex(null)}
        />
      </div>
    </form>
  );
}

function RobotSelect({
  robots,
  value,
  onChange,
}: {
  robots: Robot[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full border border-border rounded-md px-3 py-1.5 text-ui-sm text-t1 bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
    >
      <option value="">None</option>
      {robots.map((r) => (
        <option key={r.id} value={r.id}>
          {r.id}
          {r.online ? "" : " (offline)"}
        </option>
      ))}
    </select>
  );
}
