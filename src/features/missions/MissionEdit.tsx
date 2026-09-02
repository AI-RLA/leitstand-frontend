import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMission, useUpdateMission } from "@/api/missions";
import { useSites } from "@/api/sites";
import type { Mission, NavigationStageInput } from "@/api/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { MissionStageList } from "./components/MissionStageList";
import { MissionMapWorkspace } from "./components/MissionMapWorkspace";
import { anchorFromSite, latLonToLocal } from "./siteFrame";
import type { WaypointFrame } from "./components/FrameChip";
import type { StageDraft } from "./components/StageRow";
import type { StageKind } from "./components/stageTypes";
import type { WaypointDraft } from "./components/WaypointRow";

function emptyWaypoint(): WaypointDraft {
  return { lat: "", lon: "", heading_deg: "", x: "", y: "", theta: "" };
}

function isEmptyWaypoint(w: WaypointDraft): boolean {
  return !w.lat && !w.lon && !w.heading_deg && !w.x && !w.y && !w.theta;
}

function isValidNumber(v: string): boolean {
  return v !== "" && !Number.isNaN(parseFloat(v));
}

function stageValid(s: StageDraft): boolean {
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

function totalWaypoints(stages: StageDraft[]): number {
  return stages.reduce((sum, s) => sum + s.waypoints.length, 0);
}

function stagesToDrafts(stages: Mission["stages"]): StageDraft[] {
  // Navigation stages only. A coverage stage is derived from a field boundary rather than typed,
  // so editing its waypoints by hand would silently break the relationship the plan records.
  return stages
    .filter((s) => s.kind === "navigation")
    .map((s) => {
      const first = s.waypoints[0];
      const frame: WaypointFrame =
        first?.kind === "site_local" ? "site_local" : "wgs84";
      const site_id = first?.kind === "site_local" ? first.site_id : "";
      return {
        kind: "navigation",
        frame,
        site_id,
        waypoints: s.waypoints.map(
          (w): WaypointDraft =>
            w.kind === "wgs84"
              ? {
                  lat: String(w.lat),
                  lon: String(w.lon),
                  heading_deg:
                    w.heading_deg != null ? String(w.heading_deg) : "",
                  x: "",
                  y: "",
                  theta: "",
                }
              : {
                  lat: "",
                  lon: "",
                  heading_deg: "",
                  x: String(w.x),
                  y: String(w.y),
                  theta: w.theta != null ? String(w.theta) : "",
                },
        ),
      };
    });
}

interface Props {
  id: string;
}

export function MissionEdit({ id }: Props) {
  const navigate = useNavigate();
  const { data: mission, isLoading, isError } = useMission(id);
  const update = useUpdateMission(id);
  const { data: sites = [] } = useSites();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stages, setStages] = useState<StageDraft[]>([]);
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!mission || initialized) return;
    // One-time hydration of the edit form from the loaded mission, guarded by
    // `initialized` so it runs exactly once; the rule's cascading-render concern
    // does not apply to a one-shot init.
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(mission.name);
    setDescription(mission.description ?? "");
    setStages(stagesToDrafts(mission.stages));
    setInitialized(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [mission, initialized]);

  useEffect(() => {
    if (addingIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddingIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addingIndex]);

  function setStageKind(si: number, kind: StageKind) {
    setStages((prev) => prev.map((s, i) => (i !== si ? s : { ...s, kind })));
    if (addingIndex === si) setAddingIndex(null);
  }

  function setStageFrame(si: number, frame: WaypointFrame) {
    setStages((prev) =>
      prev.map((s, i) =>
        i !== si
          ? s
          : { ...s, frame, site_id: "", waypoints: [emptyWaypoint()] },
      ),
    );
    if (addingIndex === si) setAddingIndex(null);
  }

  function setStageSiteId(si: number, siteId: string) {
    setStages((prev) =>
      prev.map((s, i) => (i !== si ? s : { ...s, site_id: siteId })),
    );
  }

  function updateWaypoint(
    si: number,
    wi: number,
    field: keyof WaypointDraft,
    value: string,
  ) {
    setStages((prev) =>
      prev.map((s, i) =>
        i !== si
          ? s
          : {
              ...s,
              waypoints: s.waypoints.map((w, j) =>
                j !== wi ? w : { ...w, [field]: value },
              ),
            },
      ),
    );
  }

  function addWaypoint(si: number) {
    setStages((prev) =>
      prev.map((s, i) =>
        i !== si ? s : { ...s, waypoints: [...s.waypoints, emptyWaypoint()] },
      ),
    );
  }

  function removeWaypoint(si: number, wi: number) {
    setStages((prev) =>
      prev.map((s, i) =>
        i !== si
          ? s
          : { ...s, waypoints: s.waypoints.filter((_, j) => j !== wi) },
      ),
    );
  }

  function addStage() {
    setStages((prev) => [
      ...prev,
      {
        kind: "navigation",
        frame: "wgs84",
        site_id: "",
        waypoints: [emptyWaypoint()],
      },
    ]);
  }

  function removeStage(si: number) {
    setStages((prev) => prev.filter((_, i) => i !== si));
    if (addingIndex !== null) {
      if (addingIndex === si) setAddingIndex(null);
      else if (addingIndex > si) setAddingIndex(addingIndex - 1);
    }
  }

  function moveStageUp(si: number) {
    if (si === 0) return;
    setStages((prev) => {
      const next = [...prev];
      [next[si - 1], next[si]] = [next[si], next[si - 1]];
      return next;
    });
    if (addingIndex === si) setAddingIndex(si - 1);
    else if (addingIndex === si - 1) setAddingIndex(si);
  }

  function moveStageDown(si: number) {
    setStages((prev) => {
      if (si >= prev.length - 1) return prev;
      const next = [...prev];
      [next[si], next[si + 1]] = [next[si + 1], next[si]];
      return next;
    });
    if (addingIndex === si) setAddingIndex(si + 1);
    else if (addingIndex === si + 1) setAddingIndex(si);
  }

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      if (addingIndex === null) return;
      const stageIndex = addingIndex;

      setStages((prev) => {
        const stage = prev[stageIndex];
        if (!stage) return prev;

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

        return prev.map((s, i) =>
          i !== stageIndex ? s : { ...s, waypoints: newWaypoints },
        );
      });
    },
    [addingIndex, sites],
  );

  const canSubmit =
    name.trim().length > 0 && stages.length > 0 && stages.every(stageValid);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const builtStages: NavigationStageInput[] = stages.map((s) => ({
      kind: "navigation" as const,
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
    }));

    await update.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      stages: builtStages,
    });

    navigate({ to: "/missions/$id", params: { id } });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-t3">Loading…</span>
      </div>
    );
  }
  if (isError || !mission) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-red-500">Mission not found.</span>
      </div>
    );
  }

  // Refused here as well as at the link, because the route is directly navigable. The form holds
  // only what it can express, and saving replaces every stage, so what it dropped would be lost.
  if (mission.stages.some((s) => s.kind !== "navigation")) {
    return (
      <EmptyState
        className="h-48 justify-center"
        title="This mission was planned, not typed"
        hint="Its stages come from a field boundary. Plan it again to change them."
        action={
          <Link
            to="/missions/$id"
            params={{ id }}
            className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
          >
            Back to mission
          </Link>
        }
      />
    );
  }

  const totalWp = totalWaypoints(stages);

  return (
    <form
      onSubmit={handleSubmit}
      className="h-full flex overflow-hidden bg-muted"
    >
      {/* Left form pane */}
      <div className="w-[520px] shrink-0 flex flex-col border-r border-border bg-white">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <Link
            to="/missions/$id"
            params={{ id }}
            className="inline-flex items-center gap-1 text-ui-xs text-t3 hover:text-t1 transition-colors mb-2"
          >
            <ChevronLeft className="w-3 h-3" />
            {mission.name}
          </Link>
          <h2 className="text-ui-xl font-semibold text-t1 leading-tight">
            Edit mission
          </h2>
        </div>

        {/* Body */}
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
          </div>

          <MissionStageList
            stages={stages}
            sites={sites}
            addingIndex={addingIndex}
            onChangeStageKind={setStageKind}
            onChangeStageFrame={setStageFrame}
            onChangeStageSiteId={setStageSiteId}
            onChangeWaypoint={updateWaypoint}
            onAddWaypoint={addWaypoint}
            onRemoveWaypoint={removeWaypoint}
            onMoveStageUp={moveStageUp}
            onMoveStageDown={moveStageDown}
            onRemoveStage={removeStage}
            onArmAddMode={setAddingIndex}
            onCancelAddMode={() => setAddingIndex(null)}
            onAddStage={addStage}
          />
        </div>

        {/* Bottom strip */}
        <div className="border-t border-border bg-white px-4 py-3 shrink-0 flex items-center justify-between gap-3">
          <div className="text-ui-xs text-t3 tabular-nums">
            <span className="font-semibold text-t2">{stages.length}</span> stage
            {stages.length === 1 ? "" : "s"}
            <span className="mx-1.5">·</span>
            <span className="font-semibold text-t2">{totalWp}</span> waypoint
            {totalWp === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate({ to: "/missions/$id", params: { id } })}
              className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || update.isPending}
              className="text-ui-sm bg-primary text-white px-4 py-1.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        {update.isError && (
          <p className="text-ui-sm text-red-500 px-4 py-2 border-t border-border bg-red-50">
            Failed to save changes. Check that all fields are valid.
          </p>
        )}
      </div>

      {/* Right map pane */}
      <div className="flex-1 relative overflow-hidden">
        <MissionMapWorkspace
          stages={stages}
          sites={sites}
          addingIndex={addingIndex}
          onMapClick={handleMapClick}
          onCancelAddMode={() => setAddingIndex(null)}
        />
      </div>
    </form>
  );
}
