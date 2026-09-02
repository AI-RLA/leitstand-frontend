import type { RobotEntry } from "@/stores/fleet";
import {
  STATUS_COLORS,
  MARKER_COLOR,
  batteryColor,
  relativeTime,
  latestTs,
} from "./constants";

type Props = {
  robot: RobotEntry;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
};

export function RobotListItem({
  robot,
  selected,
  onClick,
  onDoubleClick,
}: Props) {
  const opStatus = robot.status ?? "unknown";
  const batteryPct = robot.battery?.battery_pct ?? null;
  const badge = STATUS_COLORS[opStatus] ?? STATUS_COLORS.offline;
  const lastSeen = !robot.online
    ? latestTs(robot.battery?.ts, robot.pose?.ts)
    : null;

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`w-full text-left py-[9px] px-3 border-l-[3px] border-b border-b-border transition-opacity ${
        selected
          ? "bg-[#F0FDF4] border-primary"
          : "border-transparent hover:bg-muted"
      } ${!robot.online ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        {/* Connectivity dot: green = online, charcoal = offline */}
        <span
          title={robot.online ? "Online" : "Offline"}
          className="shrink-0 inline-block w-2 h-2 rounded-full"
          style={{
            background: robot.online
              ? MARKER_COLOR.active
              : MARKER_COLOR.offline,
          }}
        />
        <span className="text-ui-md font-semibold text-t1">{robot.id}</span>
        <span className="flex-1" />
        <span
          className="text-ui-sm font-medium rounded-full px-2 py-[1px]"
          style={{ background: badge.bg, color: badge.text }}
        >
          {opStatus}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        {/* indent to align with robot id */}
        <div className="w-2 shrink-0" />
        <div className="w-9 h-2 rounded-[3px] bg-border overflow-hidden">
          {batteryPct != null && (
            <div
              className="h-full"
              style={{
                width: `${batteryPct}%`,
                background: robot.online ? batteryColor(batteryPct) : "#9CA3AF",
              }}
            />
          )}
        </div>
        <span
          className="text-ui-xs font-mono"
          style={{ color: robot.online ? undefined : "#9CA3AF" }}
        >
          {batteryPct != null ? `${batteryPct}%` : "—"}
        </span>
        {lastSeen && (
          <span className="text-ui-xs text-t3 truncate flex-1 text-right">
            {relativeTime(lastSeen)}
          </span>
        )}
      </div>
    </button>
  );
}
