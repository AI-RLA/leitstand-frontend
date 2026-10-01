import type { RunStatus, StageStatus } from "@/api/client";
import { cn } from "@/lib/utils";
import {
  missionColors,
  stageColors,
  type MissionPillStatus,
} from "./statusColors";

// Asked, not yet confirmed by the robot: the target state's colour with a hollow dot.
const UNCONFIRMED: ReadonlySet<RunStatus> = new Set([
  "PAUSING",
  "RESUMING",
  "CANCELLING",
]);

const MISSION_LABEL: Partial<Record<MissionPillStatus, string>> = {
  NOT_RUN: "NOT RUN",
  PAUSING: "PAUSING…",
  RESUMING: "RESUMING…",
  CANCELLING: "CANCELLING…",
};

type StatusPillProps =
  | {
      variant: "mission";
      status: RunStatus | null;
      size?: "sm" | "lg";
      dotOnly?: boolean;
      className?: string;
    }
  | {
      variant: "stage";
      status: StageStatus;
      size?: "sm" | "lg";
      dotOnly?: boolean;
      className?: string;
    };

export function StatusPill(props: StatusPillProps) {
  const label: MissionPillStatus | StageStatus =
    props.variant === "mission" ? (props.status ?? "NOT_RUN") : props.status;
  const colors =
    props.variant === "mission"
      ? missionColors(label as MissionPillStatus)
      : stageColors(label as StageStatus);
  const hollow =
    props.variant === "mission" &&
    props.status !== null &&
    UNCONFIRMED.has(props.status);

  const { size = "sm", dotOnly = false, className } = props;

  if (dotOnly) {
    return (
      <span
        aria-label={label}
        className={cn("inline-block w-2 h-2 rounded-full shrink-0", className)}
        style={
          hollow
            ? { boxShadow: `inset 0 0 0 2px ${colors.accent}` }
            : { background: colors.accent }
        }
      />
    );
  }

  const sizing =
    size === "lg" ? "text-ui-xs px-2 py-0.5" : "text-ui-xs px-1.5 py-0.5";

  return (
    <span
      className={cn(
        "font-semibold rounded uppercase tracking-wide",
        sizing,
        label === "SKIPPED" && "line-through",
        className,
      )}
      style={{ background: colors.background, color: colors.text }}
    >
      {MISSION_LABEL[label as MissionPillStatus] ?? label}
    </span>
  );
}
