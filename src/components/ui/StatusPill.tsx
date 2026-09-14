import type { RunStatus, StageStatus } from "@/api/client";
import { cn } from "@/lib/utils";

// A mission's status is that of its latest run; "NOT_RUN" stands in for a mission that has none.
export type MissionPillStatus = RunStatus | "NOT_RUN";

const MISSION_STYLES: Record<MissionPillStatus, { pill: string; dot: string }> =
  {
    NOT_RUN: { pill: "bg-[#F1F5F9] text-[#475569]", dot: "bg-[#94A3B8]" },
    PENDING: { pill: "bg-[#EFF6FF] text-[#2563EB]", dot: "bg-[#3B82F6]" },
    DISPATCHED: { pill: "bg-[#EEF2FF] text-[#4F46E5]", dot: "bg-[#6366F1]" },
    RUNNING: { pill: "bg-[#F0FDF4] text-[#16A34A]", dot: "bg-[#16A34A]" },
    PAUSED: { pill: "bg-[#FFFBEB] text-[#B45309]", dot: "bg-[#F59E0B]" },
    SUCCEEDED: { pill: "bg-[#F0FDF4] text-[#15803D]", dot: "bg-[#16A34A]" },
    FAILED: { pill: "bg-[#FEF2F2] text-[#B91C1C]", dot: "bg-[#EF4444]" },
    CANCELLED: { pill: "bg-muted text-[#64748B]", dot: "bg-[#94A3B8]" },
    REJECTED: { pill: "bg-[#FEF2F2] text-[#B91C1C]", dot: "bg-[#F87171]" },
  };

const STAGE_STYLES: Record<StageStatus, { pill: string; dot: string }> = {
  WAITING: { pill: "bg-[#F1F5F9] text-[#64748B]", dot: "bg-[#94A3B8]" },
  INITIALIZING: { pill: "bg-[#EEF2FF] text-[#4F46E5]", dot: "bg-[#6366F1]" },
  RUNNING: { pill: "bg-[#F0FDF4] text-[#16A34A]", dot: "bg-[#16A34A]" },
  PAUSED: { pill: "bg-[#FFFBEB] text-[#B45309]", dot: "bg-[#F59E0B]" },
  FINISHED: { pill: "bg-[#DCFCE7] text-[#15803D]", dot: "bg-[#16A34A]" },
  FAILED: { pill: "bg-[#FEF2F2] text-[#B91C1C]", dot: "bg-[#EF4444]" },
  CANCELLED: { pill: "bg-muted text-[#64748B]", dot: "bg-[#94A3B8]" },
  SKIPPED: {
    pill: "bg-muted text-[#94A3B8] line-through",
    dot: "bg-[#CBD5E1]",
  },
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
  const styles =
    props.variant === "mission"
      ? MISSION_STYLES[label as MissionPillStatus]
      : STAGE_STYLES[label as StageStatus];
  if (!styles) return null;

  const { size = "sm", dotOnly = false, className } = props;

  if (dotOnly) {
    return (
      <span
        aria-label={label}
        className={cn(
          "inline-block w-2 h-2 rounded-full shrink-0",
          styles.dot,
          className,
        )}
      />
    );
  }

  const fontSize =
    size === "lg"
      ? "text-ui-xs px-2 py-0.5"
      : props.variant === "mission"
        ? "text-ui-xs px-1.5 py-0.5"
        : "text-ui-xs px-1.5 py-0.5";

  return (
    <span
      className={cn(
        "font-semibold rounded uppercase tracking-wide",
        fontSize,
        styles.pill,
        className,
      )}
    >
      {label === "NOT_RUN" ? "NOT RUN" : label}
    </span>
  );
}
