import type { Robot, RunSummary, RunTransition } from "@/api/client";
import { relativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";
import { isConfirming } from "../adapters";

// After these waits the line changes colour: warning (yellow) while a reply or a confirmation is
// overdue, alert (red) once the robot has been silent for a minute.
const ACCEPT_WARNING_MS = 10_000;
const CONFIRM_WARNING_MS = 35_000;
const SILENT_ALERT_MS = 60_000;

type Tone = "muted" | "warning" | "alert";

type Props = {
  run: RunSummary;
  /** The run's transitions when the caller has the full run; the summary has none. */
  transitions?: RunTransition[];
  robot?: Robot;
  /** The current time from useNowTick, so the ages move without a refetch. */
  now: number;
  onCancel?: () => void;
  onSendAgain?: () => void;
  /** Ends the run on the operator's word; offered only while the robot is offline. */
  onClose?: () => void;
  closeArmed?: boolean;
};

const VERB: Record<string, string> = {
  PAUSING: "Pausing",
  RESUMING: "Resuming",
  CANCELLING: "Cancelling",
};

/** One always-present line under a run's header: what the robot last said, and what is awaited. */
export function RunStatusLine({
  run,
  transitions = [],
  robot,
  now,
  onCancel,
  onSendAgain,
  onClose,
  closeArmed = false,
}: Props) {
  const robotName = run.robot_id;
  const report = run.last_report;
  const reportAge = report
    ? now - new Date(report.received_at).getTime()
    : null;
  const last = transitions.length
    ? transitions[transitions.length - 1]
    : undefined;

  let text: string;
  let tone: Tone = "muted";
  let action: { label: string; onClick: () => void } | undefined;

  if (
    run.status === "SUCCEEDED" ||
    run.status === "FAILED" ||
    run.status === "CANCELLED"
  ) {
    const byRobot = !last || last.actor === "robot";
    text = byRobot
      ? `Ended by the robot ${relativeTime(run.ended_at)}`
      : `Closed by the backend ${relativeTime(run.ended_at)}; the robot never confirmed the end`;
  } else if (run.status === "REJECTED") {
    text = `Refused by the robot ${relativeTime(run.ended_at)}`;
  } else if (run.status === "PENDING") {
    const age = now - new Date(run.created_at).getTime();
    text = `Sending to ${robotName}, waiting for it to accept (${relativeTime(run.created_at)})`;
    if (age > ACCEPT_WARNING_MS) tone = "warning";
    if (onCancel) action = { label: "Cancel", onClick: onCancel };
  } else if (run.status === "DISPATCHED") {
    const age = now - new Date(run.dispatched_at ?? run.created_at).getTime();
    text = `${robotName} accepted ${relativeTime(run.dispatched_at ?? run.created_at)}, waiting for its first report`;
    if (age > ACCEPT_WARNING_MS) tone = "warning";
    if (onCancel) action = { label: "Cancel", onClick: onCancel };
  } else if (isConfirming(run.status)) {
    const asked = last ? now - new Date(last.at).getTime() : 0;
    const reported = report
      ? `${robotName} last reported ${report.exec_status.toLowerCase()} ${relativeTime(report.received_at)}`
      : `${robotName} has not reported yet`;
    text = `${VERB[run.status]}… asked ${last ? relativeTime(last.at) : "just now"}; ${reported}`;
    const deferred = last?.detail?.deferred as string | undefined;
    if (deferred) {
      // The fleet knew the robot could not answer; the request waits for its reconnect.
      tone = "warning";
      text = `${VERB[run.status]}… ${robotName} is offline; the request is delivered when it reconnects`;
    } else if (last?.acknowledged === false) {
      tone = "alert";
      const reason = last.detail?.reason as string | undefined;
      text = reason
        ? `${VERB[run.status]}… refused by ${robotName}: ${reason}`
        : `${VERB[run.status]}… ${robotName} did not acknowledge the request`;
    } else if (asked > CONFIRM_WARNING_MS) {
      tone = "warning";
    }
    if (onSendAgain && (tone !== "muted" || run.status === "CANCELLING")) {
      action = { label: "Send again", onClick: onSendAgain };
    }
  } else if (reportAge !== null && reportAge > SILENT_ALERT_MS) {
    tone = "alert";
    text = `No report from ${robotName} for ${relativeTime(report!.received_at).replace(" ago", "")}${robot && !robot.online ? " (offline)" : ""}`;
    if (onCancel) action = { label: "Cancel run", onClick: onCancel };
  } else if (report) {
    text = `${robotName} reports ${report.exec_status.toLowerCase()}, ${relativeTime(report.received_at)}`;
  } else {
    text = `Waiting for the first report from ${robotName}`;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 text-ui-sm min-h-[1.75rem]",
        tone === "muted" && "text-t3",
        tone === "warning" && "text-[#B45309]",
        tone === "alert" && "text-[#B91C1C]",
      )}
    >
      <span>{text}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-ui-xs border border-current rounded px-2 py-0.5 hover:bg-black/5 transition-colors"
        >
          {action.label}
        </button>
      )}
      {onClose && robot && !robot.online && (
        <button
          type="button"
          onClick={onClose}
          title="Ends the run now, without the robot. If the robot comes back still holding it, it is told to stop."
          className={cn(
            "text-ui-xs rounded px-2 py-0.5 transition-colors",
            closeArmed
              ? "text-white bg-red-500 border border-red-500 hover:bg-red-600"
              : "text-red-500 border border-red-200 hover:bg-red-50 hover:border-red-300",
          )}
        >
          {closeArmed ? "Confirm close?" : "Close now"}
        </button>
      )}
    </div>
  );
}
