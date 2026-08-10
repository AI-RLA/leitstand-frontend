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
import { useMissionState } from "@/ws/missionState";
import { useOnlineRobots } from "@/api/robots";
import { useSites } from "@/api/sites";
import { StatusPill } from "@/components/ui/StatusPill";
import { toMissionViewModel, isActiveStatus } from "./adapters";
import { MissionProgressHero } from "./components/MissionProgressHero";
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
    <div className="p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column: controls + content */}
        <div className="lg:w-[640px] lg:shrink-0 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-ui-xl font-semibold text-t1 leading-tight">
                {mission.name}
              </h2>
              {mission.description && (
                <p className="text-ui-sm text-t3 mt-1">{mission.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusPill variant="mission" status={effectiveStatus} />
              {liveState && isActive && (
                <span className="text-ui-xs text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] px-1.5 py-0.5 rounded">
                  live
                </span>
              )}
              {isDraft && (
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
                    <span className="text-ui-xs text-red-500">
                      Reset failed.
                    </span>
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
                    <span className="text-ui-xs text-red-500">
                      Delete failed.
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Live progress (active only) */}
          {isActive && <MissionProgressHero vm={vm} />}

          {mission.failure_errors && mission.failure_errors.length > 0 && (
            <MissionFailureCard errors={mission.failure_errors} />
          )}

          {/* Metadata */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatBox label="Stages" value={String(mission.stages.length)} />
            <StatBox label="Robot" value={mission.robot_id ?? "—"} />
            <StatBox
              label="Dispatched"
              value={
                mission.dispatched_at
                  ? new Date(mission.dispatched_at).toLocaleString()
                  : "—"
              }
            />
          </div>

          {/* Assign form (DRAFT only) */}
          {isDraft && (
            <div className="bg-white border border-border rounded-lg p-4 mb-4">
              <p className="text-ui-xs uppercase tracking-wider font-semibold text-t3 mb-3">
                Assign robot
              </p>
              {onlineRobots.length === 0 ? (
                <p className="text-ui-sm text-t3">
                  No robots currently online.
                </p>
              ) : (
                <form
                  onSubmit={handleAssign}
                  className="flex items-center gap-2"
                >
                  <select
                    value={selectedRobot}
                    onChange={(e) => setSelectedRobot(e.target.value)}
                    className="flex-1 border border-border rounded-md px-3 py-2 text-ui-md text-t1 bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
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
                    className="text-ui-sm bg-primary text-white px-3.5 py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {assign.isPending ? "Assigning…" : "Assign"}
                  </button>
                </form>
              )}
              {assign.isError && (
                <p className="text-ui-sm text-red-500 mt-2">
                  {apiErrorMessage(assign.error)}
                </p>
              )}
            </div>
          )}

          {/* Assigned: dispatch or unassign */}
          {isAssigned && (
            <div className="bg-white border border-border rounded-lg p-4 mb-4">
              <p className="text-ui-xs uppercase tracking-wider font-semibold text-t3 mb-3">
                Ready to dispatch
              </p>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-ui-sm text-t1 font-mono truncate">
                  {mission.robot_id}
                </span>
                <button
                  onClick={handleDispatch}
                  disabled={dispatch.isPending}
                  className="text-ui-sm bg-primary text-white px-3.5 py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {dispatch.isPending ? "Dispatching…" : "Dispatch"}
                </button>
                <button
                  onClick={handleUnassign}
                  disabled={unassign.isPending}
                  className="text-ui-sm text-t2 border border-border px-3 py-2 rounded-md hover:bg-[#F1F5F9] disabled:opacity-50 transition-colors"
                >
                  {unassign.isPending ? "Unassigning…" : "Unassign"}
                </button>
              </div>
              {dispatch.isError && (
                <p className="text-ui-sm text-red-500 mt-2">
                  {apiErrorMessage(dispatch.error)}
                </p>
              )}
            </div>
          )}

          {/* Active mission actions */}
          {isActive && (
            <div className="flex items-center gap-2 mb-4">
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
            </div>
          )}

          {/* Stage timeline */}
          <div className="mb-3">
            <MissionStageTimeline
              stages={vm.stages}
              statePending={statePending}
            />
          </div>

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

        {/* Right column: map. Sticky on widescreen so it stays visible while
            scrolling through the long left column. */}
        <div className="flex-1 min-w-0">
          <div className="h-[320px] lg:h-[calc(100vh-7rem)] lg:sticky lg:top-0">
            <MissionPathPreview mission={mission} state={state} sites={sites} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-border rounded-lg p-3 flex flex-col gap-1">
      <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
        {label}
      </p>
      <p className="text-ui-sm font-medium text-t1 truncate">{value}</p>
    </div>
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
      <div className="px-4 py-2.5 border-b border-border bg-[#F8FAFC]">
        <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
          {title}
        </p>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-[3px]">
      <span className="text-ui-sm text-t3">{label}</span>
      <span
        className={`text-ui-sm text-t1 ${mono ? "font-mono break-all text-right max-w-[60%]" : "tabular-nums"}`}
      >
        {value}
      </span>
    </div>
  );
}
