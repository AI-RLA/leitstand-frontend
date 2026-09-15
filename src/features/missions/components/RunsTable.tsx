import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMissionRuns } from "@/api/runs";
import {
  useCancelMission,
  usePauseMission,
  useResumeMission,
} from "@/api/missions";
import { apiErrorMessage } from "@/api/client";
import type { Mission, RunSummary } from "@/api/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { durationFromMs, relativeTime } from "@/lib/relativeTime";
import { useArmed } from "@/lib/useArmed";
import { useNowTick } from "@/lib/useNowTick";
import { cn } from "@/lib/utils";
import { isActiveStatus } from "../adapters";

const ROWS_SHOWN = 5;

/**
 * Every run a mission has had: the active ones first, then newest first. A run of an older plan
 * is marked, so it is not mistaken for one of the plan the mission holds now.
 */
export function RunsTable({
  mission,
  currentDigest,
}: {
  mission: Mission;
  currentDigest: string;
}) {
  const { data: runs = [], isLoading } = useMissionRuns(mission.mission_id);
  const [showAll, setShowAll] = useState(false);
  const anyActive = runs.some((r) => isActiveStatus(r.status));
  // Ages keep moving on a quiet page too, only slower.
  const now = useNowTick(anyActive ? 5000 : 30_000, true);
  const ordered = [...runs].sort((a, b) => {
    const activeDiff =
      Number(isActiveStatus(b.status)) - Number(isActiveStatus(a.status));
    if (activeDiff !== 0) return activeDiff;
    return b.created_at.localeCompare(a.created_at);
  });
  const shown = showAll ? ordered : ordered.slice(0, ROWS_SHOWN);

  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden">
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
      {runs.length > 0 && (
        <table className="w-full text-ui-sm">
          <thead>
            <tr className="text-ui-xs uppercase tracking-wider text-t3 border-b border-border">
              <th className="text-left font-semibold px-3 py-1.5">Status</th>
              <th className="text-left font-semibold px-2 py-1.5">Started</th>
              <th className="text-left font-semibold px-2 py-1.5">Outcome</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((run) => (
              <RunRow
                key={run.run_id}
                run={run}
                missionId={mission.mission_id}
                samePlan={run.stages_digest === currentDigest}
                now={now}
              />
            ))}
          </tbody>
        </table>
      )}
      {!showAll && runs.length > ROWS_SHOWN && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full text-ui-xs text-t2 px-4 py-2 border-t border-border hover:bg-muted transition-colors"
        >
          Show all {runs.length} runs
        </button>
      )}
    </div>
  );
}

// The status is in the pill, so the outcome cell carries only what the pill does not say.
function outcome(run: RunSummary, now: number): string {
  if (isActiveStatus(run.status)) {
    const report = run.last_report;
    if (!report) return "no report yet";
    return `report ${relativeTime(report.received_at, now)}`;
  }
  const started = run.dispatched_at ?? run.created_at;
  return run.ended_at
    ? `after ${durationFromMs(new Date(run.ended_at).getTime() - new Date(started).getTime())}`
    : "";
}

function RunRow({
  run,
  missionId,
  samePlan,
  now,
}: {
  run: RunSummary;
  missionId: string;
  samePlan: boolean;
  now: number;
}) {
  const navigate = useNavigate();
  const active = isActiveStatus(run.status);
  const when = run.dispatched_at ?? run.created_at;
  const open = () =>
    navigate({
      to: "/missions/$id/runs/$runId",
      params: { id: missionId, runId: run.run_id },
    });
  return (
    <tr
      onClick={open}
      className={cn(
        "hover:bg-muted transition-colors align-top cursor-pointer",
        active && "bg-[#F0FDF4]/40",
      )}
    >
      <td className="px-3 py-2 whitespace-nowrap">
        <StatusPill variant="mission" status={run.status} />
      </td>
      <td className="px-2 py-2" title={new Date(when).toLocaleString()}>
        <div className="text-t1 whitespace-nowrap">
          {relativeTime(when, now)}
        </div>
        <div className="text-ui-xs text-t3 truncate max-w-[9rem]">
          {run.robot_id}
        </div>
      </td>
      <td className="px-2 py-2 text-t3">
        <div className="whitespace-nowrap">{outcome(run, now)}</div>
        {!samePlan && (
          <span
            className="text-ui-xs text-t3 border border-border rounded px-1 whitespace-nowrap"
            title="This run executed a different plan than the one the mission holds now."
          >
            older plan
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
          {active && <RunActions run={run} missionId={missionId} />}
          <Link
            to="/missions/$id/runs/$runId"
            params={{ id: missionId, runId: run.run_id }}
            className="text-ui-xs text-t2 border border-border rounded px-2 py-0.5 hover:bg-white transition whitespace-nowrap"
          >
            Open
          </Link>
        </div>
      </td>
    </tr>
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
  const [confirming, setConfirming] = useArmed();
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
          className="text-ui-xs text-[#B45309] border border-[#FDE68A] bg-[#FFFBEB] rounded px-2 py-0.5 hover:bg-[#FEF3C7] disabled:opacity-50 transition-colors"
        >
          {pause.isPending ? "Pausing…" : "Pause"}
        </button>
      )}
      {run.status === "PAUSED" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => resume.mutate(run.run_id)}
          className="text-ui-xs text-[#16A34A] border border-[#BBF7D0] bg-[#F0FDF4] rounded px-2 py-0.5 hover:bg-[#DCFCE7] disabled:opacity-50 transition-colors"
        >
          {resume.isPending ? "Resuming…" : "Resume"}
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
          cancel.mutate({ runId: run.run_id, mode: "immediate" });
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
