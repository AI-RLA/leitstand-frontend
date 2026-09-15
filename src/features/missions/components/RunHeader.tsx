import { useNavigate } from "@tanstack/react-router";
import {
  useCancelMission,
  useDispatchMission,
  usePauseMission,
  useResumeMission,
} from "@/api/missions";
import { useQueryClient } from "@tanstack/react-query";
import { runKey, useDeleteRun } from "@/api/runs";
import {
  apiErrorMessage,
  type Mission,
  type Robot,
  type Run,
} from "@/api/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { durationFromMs } from "@/lib/relativeTime";
import { useArmed } from "@/lib/useArmed";
import { dispatchRefusal, isActiveStatus, isConfirming } from "../adapters";
import { SplitCancelButton } from "./SplitCancelButton";

interface RunHeaderProps {
  mission: Mission;
  run: Run;
  /** The run's robot as the fleet knows it now; undefined when it is not in the fleet list. */
  robot: Robot | undefined;
  /** The current time from useNowTick, so the duration moves while the run is active. */
  now: number;
  live: boolean;
}

/** The run's identity and the controls that act on it; the status line sits under it. */
export function RunHeader({ mission, run, robot, now, live }: RunHeaderProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const missionId = mission.mission_id;
  const pause = usePauseMission(missionId);
  const resume = useResumeMission(missionId);
  const cancel = useCancelMission(missionId);
  const dispatch = useDispatchMission(missionId);
  const remove = useDeleteRun(run.run_id, missionId);
  const [confirmCancel, setConfirmCancel] = useArmed();
  const [confirmDelete, setConfirmDelete] = useArmed();

  const active = isActiveStatus(run.status);
  const confirming = isConfirming(run.status);
  const started = run.dispatched_at ?? run.created_at;
  const durationMs =
    (run.ended_at ? new Date(run.ended_at).getTime() : now) -
    new Date(started).getTime();
  const samePlan = run.stages_digest === mission.stages_digest;
  // Run again goes to the same robot, so the fleet's reasons against it are shown on the button.
  const refusal = robot
    ? dispatchRefusal(mission, robot)
    : "robot not in the fleet list";
  const error =
    [pause, resume, cancel, dispatch, remove]
      .map((m) => (m.isError ? apiErrorMessage(m.error) : null))
      .find((msg) => msg !== null) ?? null;

  async function handleCancel(mode: "immediate" | "graceful") {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    try {
      await cancel.mutateAsync({ runId: run.run_id, mode });
    } catch {
      // shown through `error`
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
      // Left before the cached run is dropped, or this page would refetch it and show a 404.
      await navigate({ to: "/missions/$id", params: { id: missionId } });
      qc.removeQueries({ queryKey: runKey(missionId, run.run_id) });
    } catch {
      // shown through `error`
    } finally {
      setConfirmDelete(false);
    }
  }

  async function runAgain() {
    try {
      const next = await dispatch.mutateAsync({ robot_id: run.robot_id });
      const runId = next.latest_run?.run_id;
      if (runId) {
        navigate({
          to: "/missions/$id/runs/$runId",
          params: { id: missionId, runId },
        });
      }
    } catch {
      // shown through `error`
    }
  }

  const facts = [
    run.robot_id,
    `started ${new Date(started).toLocaleString()}`,
    durationFromMs(durationMs),
    run.origin.kind === "agent"
      ? "started by the assistant"
      : "started by hand",
  ];

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-ui-xl font-semibold text-t1 leading-tight">
            Run of {new Date(started).toLocaleString()}
          </h2>
          <StatusPill variant="mission" status={run.status} />
          {live && (
            <span className="text-ui-xs text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] px-1.5 py-0.5 rounded">
              live
            </span>
          )}
        </div>
        <p className="text-ui-sm text-t3 mt-1">{facts.join(" · ")}</p>
        {error && <p className="text-ui-sm text-red-500 mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {(run.status === "RUNNING" || run.status === "PAUSING") && (
          <button
            onClick={() => pause.mutate(run.run_id)}
            disabled={pause.isPending || confirming}
            className="text-ui-sm text-[#B45309] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1.5 rounded-md hover:bg-[#FEF3C7] disabled:opacity-50 transition-colors"
          >
            {pause.isPending ? "Pausing…" : "Pause"}
          </button>
        )}
        {(run.status === "PAUSED" || run.status === "RESUMING") && (
          <button
            onClick={() => resume.mutate(run.run_id)}
            disabled={resume.isPending || confirming}
            className="text-ui-sm text-[#16A34A] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 rounded-md hover:bg-[#DCFCE7] disabled:opacity-50 transition-colors"
          >
            {resume.isPending ? "Resuming…" : "Resume"}
          </button>
        )}
        {active && (
          <SplitCancelButton
            confirming={confirmCancel}
            pending={cancel.isPending}
            resend={run.status === "CANCELLING"}
            onCancel={(mode) => void handleCancel(mode)}
          />
        )}
        {!active && !mission.archived_at && (
          <button
            onClick={() => void runAgain()}
            disabled={dispatch.isPending || refusal !== null}
            className="text-ui-sm bg-primary text-white px-3.5 py-1.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            title={
              refusal !== null
                ? `${run.robot_id}: ${refusal}`
                : samePlan
                  ? "Runs this plan again on the same robot."
                  : "The mission changed since this run; runs the plan it holds now on the same robot."
            }
          >
            {dispatch.isPending
              ? "Dispatching…"
              : samePlan
                ? "Run again"
                : "Run current plan"}
          </button>
        )}
        {!active && (
          <button
            onClick={() => void handleDelete()}
            disabled={remove.isPending}
            className={
              confirmDelete
                ? "text-ui-sm text-white bg-red-500 border border-red-500 px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
                : "text-ui-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"
            }
            title="Removes this run's record. The audit log keeps the attempt."
          >
            {remove.isPending
              ? "Deleting…"
              : confirmDelete
                ? "Confirm delete?"
                : "Delete run"}
          </button>
        )}
      </div>
    </div>
  );
}
