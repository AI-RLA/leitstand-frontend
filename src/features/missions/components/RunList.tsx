import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMissionRuns } from "@/api/runs";
import {
  useCancelMission,
  usePauseMission,
  useResumeMission,
} from "@/api/missions";
import { apiErrorMessage } from "@/api/client";
import type { Mission, RunSummary } from "@/api/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { relativeTime } from "@/lib/relativeTime";
import { isActiveStatus } from "../adapters";

/**
 * Every run a mission has had, newest first. Runs whose plan digest matches the mission's
 * current plan are marked, so a run of an older plan is not mistaken for one of this plan.
 */
export function RunList({
  mission,
  currentDigest,
}: {
  mission: Mission;
  currentDigest: string;
}) {
  const { data: runs = [], isLoading } = useMissionRuns(mission.mission_id);
  return (
    <div className="rounded-lg border border-border bg-white">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-ui-sm font-semibold text-t1">Runs</span>
        <span className="text-ui-xs text-t3">{runs.length}</span>
      </div>
      {isLoading && <p className="px-4 py-3 text-ui-sm text-t3">Loading…</p>}
      {!isLoading && runs.length === 0 && (
        <p className="px-4 py-3 text-ui-sm text-t3">
          This mission has not run yet.
        </p>
      )}
      <div className="divide-y divide-border">
        {runs.map((run) => (
          <RunRow
            key={run.run_id}
            run={run}
            missionId={mission.mission_id}
            samePlan={run.stages_digest === currentDigest}
          />
        ))}
      </div>
    </div>
  );
}

function RunRow({
  run,
  missionId,
  samePlan,
}: {
  run: RunSummary;
  missionId: string;
  samePlan: boolean;
}) {
  const when = run.dispatched_at ?? run.created_at;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-muted transition-colors">
      <Link
        to="/missions/$id/runs/$runId"
        params={{ id: missionId, runId: run.run_id }}
        className="min-w-0 flex-1 flex items-center gap-2"
      >
        <StatusPill variant="mission" status={run.status} dotOnly />
        <span className="text-ui-sm text-t1 truncate">
          {relativeTime(when)} · {run.robot_id}
        </span>
        {!samePlan && (
          <span
            className="text-ui-xs text-t3 border border-border rounded px-1"
            title="This run executed a different plan than the latest run of this mission."
          >
            older plan
          </span>
        )}
      </Link>
      <div className="flex items-center gap-2 shrink-0">
        {isActiveStatus(run.status) && (
          <RunActions run={run} missionId={missionId} />
        )}
        <StatusPill variant="mission" status={run.status} />
      </div>
    </div>
  );
}

/**
 * Act on one run. The row is the only place a specific run can be named, so it is where a run
 * that is not the mission's latest stays reachable.
 */
function RunActions({
  run,
  missionId,
}: {
  run: RunSummary;
  missionId: string;
}) {
  const cancel = useCancelMission(missionId);
  const pause = usePauseMission(missionId);
  const resume = useResumeMission(missionId);
  const [confirming, setConfirming] = useState(false);
  // A timer, not onBlur: a button takes no focus on click in Safari, so a blur-disarmed control
  // stays armed for good. Three seconds is what every other confirm on these pages uses.
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);
  const busy = cancel.isPending || pause.isPending || resume.isPending;
  // Silence on a refused pause is indistinguishable from a pause that worked and has not
  // refreshed yet, on the control that stops a moving machine.
  const error = cancel.isError
    ? apiErrorMessage(cancel.error)
    : pause.isError
      ? apiErrorMessage(pause.error)
      : resume.isError
        ? apiErrorMessage(resume.error)
        : null;

  return (
    <>
      {run.status === "RUNNING" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => pause.mutate(run.run_id)}
          className="text-ui-xs text-t2 border border-border rounded px-2 py-0.5 hover:bg-white disabled:opacity-50 transition"
        >
          Pause
        </button>
      )}
      {run.status === "PAUSED" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => resume.mutate(run.run_id)}
          className="text-ui-xs text-t2 border border-border rounded px-2 py-0.5 hover:bg-white disabled:opacity-50 transition"
        >
          Resume
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          setConfirming(false);
          cancel.mutate(run.run_id);
        }}
        className={
          confirming
            ? "text-ui-xs text-white bg-red-500 border border-red-500 rounded px-2 py-0.5 hover:bg-red-600 disabled:opacity-50 transition-colors"
            : "text-ui-xs text-red-500 border border-red-200 rounded px-2 py-0.5 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"
        }
        title="Stops this run on its robot."
      >
        {cancel.isPending
          ? "Cancelling…"
          : confirming
            ? "Confirm stop?"
            : "Cancel"}
      </button>
      {error && (
        <span className="text-ui-xs text-red-500 basis-full" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
