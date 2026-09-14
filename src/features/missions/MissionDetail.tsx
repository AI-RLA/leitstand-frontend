import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  useMission,
  useAssignMission,
  useUnassignMission,
  useDispatchMission,
  useCancelMission,
  usePauseMission,
  useResumeMission,
  useRestoreMission,
  useDeleteMission,
} from "@/api/missions";
import { useRun, useRunState } from "@/api/runs";
import { apiErrorMessage } from "@/api/client";
import type { CoverageProvenance } from "@/api/client";
import { useMissionState } from "@/ws/missionState";
import { useOnlineRobots, useRobots } from "@/api/robots";
import { useSites } from "@/api/sites";
import { useField } from "@/api/fields";
import { StatusPill } from "@/components/ui/StatusPill";
import { durationFromMs } from "@/lib/relativeTime";
import { useNowTick } from "@/lib/useNowTick";
import { RunStatusLine } from "./components/RunStatusLine";
import { SplitCancelButton } from "./components/SplitCancelButton";
import {
  coverageOf,
  isActiveStatus,
  isConfirming,
  isMissionActive,
  toMissionViewModel,
} from "./adapters";
import { MissionStageTimeline } from "./components/MissionStageTimeline";
import { MissionPathPreview } from "./components/MissionPathPreview";
import { MissionFailureCard } from "./components/MissionFailureCard";
import { RunList } from "./components/RunList";

interface Props {
  id: string;
}

export function MissionDetail({ id }: Props) {
  const navigate = useNavigate();
  const {
    data: mission,
    isLoading,
    isError,
  } = useMission(id, {
    refetchInterval: 10_000,
  });
  const latestRun = mission?.latest_run ?? null;
  const latestRunId = latestRun?.run_id ?? null;
  // What the page shows is the latest run; what it lets you do must count every run still
  // occupying a robot.
  const latestRunIsActive = isActiveStatus(latestRun?.status);
  const missionIsActive = !!mission && isMissionActive(mission);
  const archived = !!mission?.archived_at;
  // Frames on the mission's topic are filtered to the latest run, so an older run's latched
  // frame cannot render as this one.
  const liveState = useMissionState(id, latestRunId);
  // REST /state is the durable per-stage source for a run that is not active, because the WS
  // latch is in-process and does not survive a backend restart.
  // Advance the elapsed clock between REST polls and WS frames.
  const now = useNowTick(1000, latestRunIsActive);
  const latest = useRunState(
    id,
    latestRunId,
    !!latestRun && !latestRunIsActive,
  );
  // The latest run's own plan is the stage spine: editing the mission afterwards must not
  // redraw what that run did.
  const { data: run } = useRun(id, latestRunId);
  // Memoised because a fresh object every render defeats the preview's own memo, and the
  // elapsed-clock tick would then re-upload every waypoint once a second.
  const mapMission = useMemo(
    () => (mission && run ? { ...mission, stages: run.stages } : mission),
    [mission, run],
  );
  const assign = useAssignMission(id);
  const unassign = useUnassignMission(id);
  const dispatch = useDispatchMission(id);
  const cancel = useCancelMission(id);
  const pause = usePauseMission(id);
  const resume = useResumeMission(id);
  const remove = useDeleteMission(id);
  const restore = useRestoreMission(id);

  const onlineRobots = useOnlineRobots();
  const { data: robots = [] } = useRobots();
  const { data: sites = [] } = useSites();
  // Only a planned mission knows which field it covers, so the boundary is fetched on demand
  // rather than by listing every field.
  const coverageFieldId = coverageOf(run?.stages ?? mission?.stages)?.field_id;
  const { data: coverageField } = useField(coverageFieldId ?? "", {
    enabled: !!coverageFieldId,
  });

  const [selectedRobot, setSelectedRobot] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmCancel) return;
    const t = setTimeout(() => setConfirmCancel(false), 3000);
    return () => clearTimeout(t);
  }, [confirmCancel]);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

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

  // Active -> live WS frame; otherwise the durable REST /state, falling back to the
  // latched WS frame while the REST fetch is in flight (avoids an all-WAITING flash
  // on the active->terminal flip).
  const state = latestRunIsActive ? liveState : (latest.data ?? liveState);
  // On a cold refresh of a finished run, the stages would briefly show as WAITING before the
  // durable /state arrives with the resolved statuses; a neutral placeholder covers that gap.
  const statePending =
    !!latestRun && !latestRunIsActive && !state && latest.isLoading;
  const vm = toMissionViewModel(mission, state, run ?? null);
  const status = vm.status;
  const isRunning = status === "RUNNING";
  const isPaused = status === "PAUSED";
  const confirming = isConfirming(status);
  const hasRun = latestRun !== null;
  // A mission can be edited, dispatched and deleted whenever no run is active. Deleting one
  // that has run archives it instead, and the button says so.
  const canAct = !missionIsActive && !archived;
  // Dispatch needs a robot: the default one, or one picked here.
  const dispatchRobot = selectedRobot || mission.assigned_robot_id || "";

  const facts = [
    `${vm.stageCount} ${vm.stageCount === 1 ? "stage" : "stages"}`,
    mission.assigned_robot_id
      ? `default robot ${mission.assigned_robot_id}`
      : "no default robot",
  ];
  if (latestRunIsActive) {
    facts.push(`running on ${vm.robotId}`);
    if (vm.overallProgress !== null) {
      facts.push(`${Math.round(vm.overallProgress * 100)}%`);
    }
    if (vm.currentStageIndex !== null) {
      facts.push(`stage ${vm.currentStageIndex + 1} of ${vm.stageCount}`);
    }
    if (vm.elapsedMs !== null) facts.push(durationFromMs(vm.elapsedMs));
  } else if (latestRun) {
    facts.push(
      `last run ${latestRun.status.toLowerCase()} on ${latestRun.robot_id}` +
        (latestRun.ended_at
          ? ` · ${new Date(latestRun.ended_at).toLocaleString()}`
          : ""),
    );
  } else {
    facts.push("not run yet");
  }

  // Every action on this page, pause and resume included: a refused pause that says nothing is
  // indistinguishable from one that worked and has not refreshed yet.
  const actionError =
    [assign, dispatch, unassign, cancel, pause, resume, restore]
      .map((m) => (m.isError ? apiErrorMessage(m.error) : null))
      .find((msg) => msg !== null) ?? null;

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRobot) return;
    try {
      await assign.mutateAsync(selectedRobot);
      setSelectedRobot("");
    } catch {
      // error tracked in assign.isError
    }
  }

  async function handleUnassign() {
    try {
      await unassign.mutateAsync();
    } catch {
      // error tracked in unassign.isError
    }
  }

  async function handleDispatch() {
    if (!dispatchRobot) return;
    try {
      await dispatch.mutateAsync({ robot_id: dispatchRobot });
      setSelectedRobot("");
    } catch {
      // error tracked in dispatch.isError
    }
  }

  async function handleCancel(mode: "immediate" | "graceful" = "immediate") {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    try {
      await cancel.mutateAsync({ runId: latestRunId, mode });
    } finally {
      setConfirmCancel(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync();
      if (!hasRun) navigate({ to: "/missions" });
    } finally {
      setConfirmDelete(false);
    }
  }

  async function handleRestore() {
    try {
      await restore.mutateAsync();
    } catch {
      // error tracked in restore.isError
    }
  }

  return (
    <div className="p-6 min-h-full flex flex-col [@container(min-width:46.5rem)]:h-full">
      {archived && (
        <div className="shrink-0 mb-4 flex items-center justify-between gap-3 rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
          <span className="text-ui-sm text-[#92400E]">
            Archived {new Date(mission.archived_at!).toLocaleString()}. Its runs
            stay readable; restore it to run or edit it again.
          </span>
          <button
            onClick={handleRestore}
            disabled={restore.isPending}
            className="text-ui-sm text-t2 border border-border bg-white px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] disabled:opacity-50 transition-colors"
          >
            {restore.isPending ? "Restoring…" : "Restore"}
          </button>
        </div>
      )}
      {/* One band for what the mission is and what can be done to it. Facts sit inline because a
          card each spends the page's widest space on its shortest values. */}
      <div className="shrink-0 flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-ui-xl font-semibold text-t1 leading-tight">
              {mission.name}
            </h2>
            <StatusPill variant="mission" status={status} />
            {liveState && latestRunIsActive && (
              <span className="text-ui-xs text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] px-1.5 py-0.5 rounded">
                live
              </span>
            )}
          </div>
          <p className="text-ui-sm text-t3 mt-1">{facts.join(" · ")}</p>
          {mission.description && (
            <p className="text-ui-sm text-t3 mt-0.5">{mission.description}</p>
          )}
          {latestRun && (
            <RunStatusLine
              run={latestRun}
              transitions={run?.transitions}
              robot={robots.find((r) => r.id === latestRun.robot_id)}
              now={now}
              onCancel={latestRunIsActive ? () => handleCancel() : undefined}
              onSendAgain={
                latestRun.status === "CANCELLING"
                  ? () =>
                      cancel.mutate({ runId: latestRunId, mode: "immediate" })
                  : undefined
              }
            />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {canAct &&
            (onlineRobots.length === 0 ? (
              <span className="text-ui-sm text-t3">No robots online</span>
            ) : (
              <form onSubmit={handleAssign} className="flex items-center gap-2">
                <select
                  value={selectedRobot}
                  onChange={(e) => setSelectedRobot(e.target.value)}
                  className="border border-border rounded-md px-3 py-1.5 text-ui-sm text-t1 bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                >
                  <option value="">
                    {mission.assigned_robot_id
                      ? `Default: ${mission.assigned_robot_id}`
                      : "Select robot…"}
                  </option>
                  {onlineRobots.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDispatch}
                  disabled={!dispatchRobot || dispatch.isPending}
                  className="text-ui-sm bg-primary text-white px-3.5 py-1.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {dispatch.isPending
                    ? "Dispatching…"
                    : hasRun
                      ? "Run again"
                      : "Dispatch"}
                </button>
                <button
                  type="submit"
                  disabled={!selectedRobot || assign.isPending}
                  className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] disabled:opacity-50 transition-colors"
                  title="Make this the robot the mission runs on by default, without starting it."
                >
                  {assign.isPending ? "Assigning…" : "Assign"}
                </button>
                {mission.assigned_robot_id && (
                  <button
                    type="button"
                    onClick={handleUnassign}
                    disabled={unassign.isPending}
                    className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] disabled:opacity-50 transition-colors"
                  >
                    {unassign.isPending ? "Unassigning…" : "Unassign"}
                  </button>
                )}
              </form>
            ))}
          {(isRunning || status === "PAUSING") && (
            <button
              onClick={() => pause.mutate(latestRunId)}
              disabled={pause.isPending || confirming}
              className="text-ui-sm text-[#B45309] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1.5 rounded-md hover:bg-[#FEF3C7] disabled:opacity-50 transition-colors"
            >
              {pause.isPending ? "Pausing…" : "Pause"}
            </button>
          )}
          {(isPaused || status === "RESUMING") && (
            <button
              onClick={() => resume.mutate(latestRunId)}
              disabled={resume.isPending || confirming}
              className="text-ui-sm text-[#16A34A] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 rounded-md hover:bg-[#DCFCE7] disabled:opacity-50 transition-colors"
            >
              {resume.isPending ? "Resuming…" : "Resume"}
            </button>
          )}
          {missionIsActive && (
            <SplitCancelButton
              confirming={confirmCancel}
              pending={cancel.isPending}
              resend={status === "CANCELLING"}
              onCancel={(mode) => void handleCancel(mode)}
            />
          )}
          {/* Only missions the editor can represent. It drops what it cannot, and saving
              replaces the whole stage list. */}
          {canAct && mission.stages.every((s) => s.kind === "navigation") && (
            <Link
              to="/missions/$id/edit"
              params={{ id }}
              className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
            >
              Edit
            </Link>
          )}
          {canAct && (
            <>
              <button
                onClick={handleDelete}
                disabled={remove.isPending}
                className={
                  confirmDelete
                    ? "text-ui-sm text-white bg-red-500 border border-red-500 px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
                    : "text-ui-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"
                }
                title={
                  hasRun
                    ? "Archives the mission; its runs stay readable and it can be restored."
                    : "Deletes the mission. It has never run, so nothing else is lost."
                }
              >
                {remove.isPending
                  ? hasRun
                    ? "Archiving…"
                    : "Deleting…"
                  : confirmDelete
                    ? hasRun
                      ? "Confirm archive?"
                      : "Confirm delete?"
                    : hasRun
                      ? "Archive"
                      : "Delete"}
              </button>
              {remove.isError && (
                <span className="text-ui-xs text-red-500">
                  {apiErrorMessage(remove.error)}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {latestRunIsActive && (
        <div className="shrink-0 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(vm.overallProgress ?? 0) * 100}%` }}
          />
        </div>
      )}

      {actionError && (
        <p className="shrink-0 text-ui-sm text-red-500 mb-3">{actionError}</p>
      )}

      {run?.failure_errors && run.failure_errors.length > 0 && (
        <div className="shrink-0">
          <MissionFailureCard errors={run.failure_errors} />
        </div>
      )}

      {/* Wraps on room available rather than on a viewport breakpoint: the side panel takes width
          the window says nothing about. Takes the height left over once side by side, so the map
          fills it exactly; stacked, it keeps its own height and the page scrolls instead. */}
      {/* The breakpoint is the two columns' own widths plus the gap (17 + 28 + 1.5rem):
          below it they wrap and the page scrolls as one, above it each takes its own
          height and the stage list scrolls inside itself. Any other number leaves a band
          where they sit side by side with no height to divide between them, and a long
          stage list stretches the map. */}
      <div className="flex flex-wrap gap-6 [@container(min-width:46.5rem)]:flex-1 [@container(min-width:46.5rem)]:min-h-0">
        {/* Stage table, narrow because it is a list of short rows. Scrolls on its own so a long
            mission cannot push the map off screen. */}
        <div className="flex-1 basis-[17rem] max-w-[22rem] min-w-0 [@container(min-width:46.5rem)]:overflow-y-auto">
          {/* Stage timeline: the latest run's stages when there is one, else the definition's. */}
          <div className="mb-3">
            <MissionStageTimeline
              stages={vm.stages}
              statePending={statePending}
            />
          </div>

          <div className="mb-3">
            <RunList mission={mission} currentDigest={mission.stages_digest} />
          </div>

          {coverageOf(mission.stages) && (
            <CoveragePlanCard coverage={coverageOf(mission.stages)!} />
          )}

          {/* Audit */}
          <Card title="Audit">
            <Row label="ID" value={mission.mission_id} mono />
            <Row
              label="Created"
              value={new Date(mission.created_at).toLocaleString()}
            />
            <Row
              label="Updated"
              value={new Date(mission.updated_at).toLocaleString()}
            />
          </Card>
        </div>

        {/* Takes the larger share of spare width, and leads once the columns stack: geometry is
            what this page is for, and a map reached only by scrolling past the stages is a map
            nobody looks at. Fills the row's height side by side; stacked, it takes a fraction of
            the viewport and sticks, so scrolling the stages does not scroll it away. */}
        <div className="flex-[2] basis-[28rem] min-w-0 flex [@container(max-width:46.5rem)]:order-first">
          <div className="flex-1 h-[60vh] min-h-[20rem] sticky top-0 [@container(min-width:46.5rem)]:h-full">
            <MissionPathPreview
              mission={mapMission ?? mission}
              state={state}
              sites={sites}
              siteAnchors={run?.site_anchors}
              field={coverageField}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * What the planner produced, and what it costs.
 *
 * Excursion leads because Fields2Cover constrains the swaths to the field and never the turns
 * joining them, so a correct plan can still take the machine past the edge, and only the operator
 * knows whether that edge is a hedge or a mown margin. Shown beside the working area because
 * deepening the headland to contain a turn is paid for in ground left undriven.
 */
function CoveragePlanCard({ coverage }: { coverage: CoverageProvenance }) {
  const m = coverage.metrics;
  const outside = m.max_excursion_m;
  // Measured against the ground the swaths were allowed to work rather than the whole field: the
  // headland is excluded on purpose, so counting it would make a complete plan read as a partial
  // one, and on a small field with a deep headland it never approaches 100%.
  // Against the field the operator asked to have covered, not against the ground the swaths were
  // allowed to reach: a headland they chose is still field that does not get worked.
  const share = coverage.field_area_m2
    ? Math.round((m.covered_area_m2 / coverage.field_area_m2) * 100)
    : null;
  // A planner predating the swath-area clipping returns an unclipped covered area, which can
  // exceed the field; reporting that would explain the planner rather than the plan.
  const showShare = share !== null && share <= 100;
  return (
    <Card title="Coverage plan">
      <Row label="Swaths" value={String(m.swath_count)} />
      {/* The denominator is inline because it appears nowhere else on the card, and a worked area
          with nothing to read it against says very little. */}
      <Row
        label="Working area"
        value={`${Math.round(m.covered_area_m2)} m² of ${Math.round(coverage.field_area_m2)} m²${showShare ? ` (${share}%)` : ""}`}
      />
      {/* Two different measurements, so they carry their own names rather than one label
          qualified by its value. A plan stored before the path was recorded has only the swaths,
          which exclude the turns joining them. */}
      {m.path_length_m == null ? (
        <Row label="Swath length" value={`${Math.round(m.track_length_m)} m`} />
      ) : (
        <Row label="Path length" value={`${Math.round(m.path_length_m)} m`} />
      )}
      <Row
        label="Outside boundary"
        // Rounding to nearest would turn a real excursion of a few millimetres into a flat zero,
        // and rounding up would bias every other value, so anything under the displayed
        // resolution is reported as the bound it is.
        value={excursionLabel(outside)}
        tone={outside != null && outside > 0.05 ? "warn" : undefined}
      />
      {/* Heads the parameters rather than trailing the card: everything below is either this
          robot's own property or a choice made for it. Not the assigned robot, which may differ. */}
      <Row label="Planned for" value={coverage.planned_for_robot_id} />
      <Row
        label="Working width"
        value={`${coverage.params.operation_width_m} m`}
      />
      <Row
        label="Headland width"
        value={`${coverage.params.headland_width_m} m`}
      />
      {/* The radius the plan assumed, not the radius of whatever robot is assigned now. Assign
          refuses a robot that turns wider than this, and the number it names is this one. */}
      <Row
        label="Turning radius"
        value={`${coverage.params.turning_radius_m} m`}
      />
      {coverage.params.allow_overlap != null && (
        <Row
          label="Last pass"
          // Overlap and skip are the opposed pair the trade names: double-applied ground versus
          // an untreated strip. A sentence here would say less than the word an operator knows.
          value={coverage.params.allow_overlap ? "overlap" : "skip"}
        />
      )}
      {coverage.params.swath_angle_deg != null && (
        <Row
          label="Swath angle"
          // Trimmed because the planner derives the bearing through radians and hands back the
          // float noise that leaves; a tenth of a degree is finer than any machine steers.
          value={`${Number(coverage.params.swath_angle_deg.toFixed(1))}°`}
        />
      )}
    </Card>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border rounded-lg mb-3 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
          {title}
        </p>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function excursionLabel(outside: number | null | undefined): string {
  if (outside == null) return "not measured";
  if (outside > 0 && outside < 0.005) return "< 0.01 m";
  return `${outside.toFixed(2)} m`;
}

function Row({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "warn";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[3px]">
      <span className="text-ui-sm text-t3 shrink-0">{label}</span>
      <span
        className={`text-ui-sm min-w-0 ${tone === "warn" ? "text-[#B45309] font-medium" : "text-t1"} ${mono ? "font-mono break-all text-right" : "tabular-nums"}`}
      >
        {value}
      </span>
    </div>
  );
}
