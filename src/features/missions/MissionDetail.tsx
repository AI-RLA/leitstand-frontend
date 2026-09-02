import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  useMission,
  useMissionLatestState,
  useAssignMission,
  useUnassignMission,
  useDispatchMission,
  useCancelMission,
  usePauseMission,
  useResumeMission,
  useResetMission,
  useDeleteMission,
} from "@/api/missions";
import { apiErrorMessage } from "@/api/client";
import type { Mission } from "@/api/client";
import { useMissionState } from "@/ws/missionState";
import { useOnlineRobots } from "@/api/robots";
import { useSites } from "@/api/sites";
import { useField } from "@/api/fields";
import { StatusPill } from "@/components/ui/StatusPill";
import { durationFromMs } from "@/lib/relativeTime";
import { useNowTick } from "@/lib/useNowTick";
import { toMissionViewModel, isActiveStatus } from "./adapters";
import { MissionStageTimeline } from "./components/MissionStageTimeline";
import { MissionPathPreview } from "./components/MissionPathPreview";
import { MissionFailureCard } from "./components/MissionFailureCard";

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
  const liveState = useMissionState(id);
  // REST /state is the DURABLE per-stage source for a non-active mission (the WS
  // latch is in-process and does not survive a backend restart); active missions
  // use the live WS frame. The hook is called unconditionally (mission may be
  // undefined on the first render -> disabled).
  const isActive = !!mission && isActiveStatus(mission.status);
  // Advance the elapsed clock between REST polls and WS frames.
  useNowTick(1000, isActive);
  const latest = useMissionLatestState(id, !!mission && !isActive);
  const assign = useAssignMission(id);
  const unassign = useUnassignMission(id);
  const dispatch = useDispatchMission(id);
  const cancel = useCancelMission(id);
  const pause = usePauseMission(id);
  const resume = useResumeMission(id);
  const remove = useDeleteMission(id);
  const reset = useResetMission(id);

  const onlineRobots = useOnlineRobots();
  const { data: sites = [] } = useSites();
  // Only a planned mission knows which field it covers, so the boundary is fetched on demand
  // rather than by listing every field.
  const coverageFieldId = mission?.coverage?.field_id;
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
  const state = isActive ? liveState : (latest.data ?? liveState);
  // On a cold refresh of a terminal mission, the stages would briefly render at their
  // WAITING floor before the durable /state arrives and flips them to the resolved
  // statuses. Suppress that flash with a neutral placeholder until /state lands.
  const statePending = !isActive && !state && latest.isLoading;
  const vm = toMissionViewModel(mission, state);
  const effectiveStatus = vm.status;
  const isDraft = effectiveStatus === "DRAFT";
  const isAssigned = effectiveStatus === "ASSIGNED";
  const isRunning = effectiveStatus === "RUNNING";
  const isPaused = effectiveStatus === "PAUSED";
  const isDeletable =
    isDraft ||
    effectiveStatus === "SUCCEEDED" ||
    effectiveStatus === "FAILED" ||
    effectiveStatus === "CANCELLED";
  const isResettable =
    effectiveStatus === "FAILED" || effectiveStatus === "CANCELLED";

  const facts = [
    `${vm.stageCount} ${vm.stageCount === 1 ? "stage" : "stages"}`,
    vm.robotId ?? "unassigned",
  ];
  if (isActive) {
    if (vm.overallProgress !== null) {
      facts.push(`${Math.round(vm.overallProgress * 100)}%`);
    }
    if (vm.currentStageIndex !== null) {
      facts.push(`stage ${vm.currentStageIndex + 1} of ${vm.stageCount}`);
    }
    if (vm.elapsedMs !== null) facts.push(durationFromMs(vm.elapsedMs));
  } else {
    facts.push(
      vm.dispatchedAt
        ? `dispatched ${new Date(vm.dispatchedAt).toLocaleString()}`
        : "not dispatched",
    );
  }

  const actionError = assign.isError
    ? apiErrorMessage(assign.error)
    : dispatch.isError
      ? apiErrorMessage(dispatch.error)
      : unassign.isError
        ? apiErrorMessage(unassign.error)
        : null;

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
    try {
      await dispatch.mutateAsync();
    } catch {
      // error tracked in dispatch.isError
    }
  }

  async function handleCancel() {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    try {
      await cancel.mutateAsync();
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
      navigate({ to: "/missions" });
    } finally {
      setConfirmDelete(false);
    }
  }

  async function handleReset() {
    try {
      await reset.mutateAsync();
    } catch {
      // error tracked in reset.isError
    }
  }

  return (
    <div className="p-6 min-h-full flex flex-col [@container(min-width:46.5rem)]:h-full">
      {/* One band for what the mission is and what can be done to it. Facts sit inline because a
          card each spends the page's widest space on its shortest values. */}
      <div className="shrink-0 flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-ui-xl font-semibold text-t1 leading-tight">
              {mission.name}
            </h2>
            <StatusPill variant="mission" status={effectiveStatus} />
            {liveState && isActive && (
              <span className="text-ui-xs text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] px-1.5 py-0.5 rounded">
                live
              </span>
            )}
          </div>
          <p className="text-ui-sm text-t3 mt-1">{facts.join(" · ")}</p>
          {mission.description && (
            <p className="text-ui-sm text-t3 mt-0.5">{mission.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {isDraft &&
            (onlineRobots.length === 0 ? (
              <span className="text-ui-sm text-t3">No robots online</span>
            ) : (
              <form onSubmit={handleAssign} className="flex items-center gap-2">
                <select
                  value={selectedRobot}
                  onChange={(e) => setSelectedRobot(e.target.value)}
                  className="border border-border rounded-md px-3 py-1.5 text-ui-sm text-t1 bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  required
                >
                  <option value="">Select robot…</option>
                  {onlineRobots.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!selectedRobot || assign.isPending}
                  className="text-ui-sm bg-primary text-white px-3.5 py-1.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {assign.isPending ? "Assigning…" : "Assign"}
                </button>
              </form>
            ))}
          {isAssigned && (
            <>
              <button
                onClick={handleDispatch}
                disabled={dispatch.isPending}
                className="text-ui-sm bg-primary text-white px-3.5 py-1.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {dispatch.isPending ? "Dispatching…" : "Dispatch"}
              </button>
              <button
                onClick={handleUnassign}
                disabled={unassign.isPending}
                className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] disabled:opacity-50 transition-colors"
              >
                {unassign.isPending ? "Unassigning…" : "Unassign"}
              </button>
            </>
          )}
          {isRunning && (
            <button
              onClick={() => pause.mutate()}
              disabled={pause.isPending}
              className="text-ui-sm text-[#B45309] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1.5 rounded-md hover:bg-[#FEF3C7] disabled:opacity-50 transition-colors"
            >
              {pause.isPending ? "Pausing…" : "Pause"}
            </button>
          )}
          {isPaused && (
            <button
              onClick={() => resume.mutate()}
              disabled={resume.isPending}
              className="text-ui-sm text-[#16A34A] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 rounded-md hover:bg-[#DCFCE7] disabled:opacity-50 transition-colors"
            >
              {resume.isPending ? "Resuming…" : "Resume"}
            </button>
          )}
          {isActive && (
            <button
              onClick={handleCancel}
              disabled={cancel.isPending}
              className={
                confirmCancel
                  ? "text-ui-sm text-white bg-red-500 border border-red-500 px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
                  : "text-ui-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"
              }
            >
              {cancel.isPending
                ? "Cancelling…"
                : confirmCancel
                  ? "Confirm cancel?"
                  : "Cancel mission"}
            </button>
          )}
          {/* Only missions the editor can represent. It drops what it cannot, and saving
              replaces the whole stage list. */}
          {isDraft && mission.stages.every((s) => s.kind === "navigation") && (
            <Link
              to="/missions/$id/edit"
              params={{ id }}
              className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
            >
              Edit
            </Link>
          )}
          {isResettable && (
            <>
              <button
                onClick={handleReset}
                disabled={reset.isPending}
                className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] disabled:opacity-50 transition-colors"
              >
                {reset.isPending ? "Resetting…" : "Reset to draft"}
              </button>
              {reset.isError && (
                <span className="text-ui-xs text-red-500">Reset failed.</span>
              )}
            </>
          )}
          {isDeletable && (
            <>
              <button
                onClick={handleDelete}
                disabled={remove.isPending}
                className={
                  confirmDelete
                    ? "text-ui-sm text-white bg-red-500 border border-red-500 px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
                    : "text-ui-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"
                }
              >
                {remove.isPending
                  ? "Deleting…"
                  : confirmDelete
                    ? "Confirm delete?"
                    : "Delete"}
              </button>
              {remove.isError && (
                <span className="text-ui-xs text-red-500">Delete failed.</span>
              )}
            </>
          )}
        </div>
      </div>

      {isActive && (
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

      {mission.failure_errors && mission.failure_errors.length > 0 && (
        <div className="shrink-0">
          <MissionFailureCard errors={mission.failure_errors} />
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
          {/* Stage timeline */}
          <div className="mb-3">
            <MissionStageTimeline
              stages={vm.stages}
              statePending={statePending}
            />
          </div>

          {mission.coverage && <CoveragePlanCard coverage={mission.coverage} />}

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
              mission={mission}
              state={state}
              sites={sites}
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
function CoveragePlanCard({
  coverage,
}: {
  coverage: NonNullable<Mission["coverage"]>;
}) {
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
