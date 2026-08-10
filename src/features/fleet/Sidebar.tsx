import { useEffect, useState } from "react";
import { useFleet } from "@/stores/fleet";
import { RobotListItem } from "./RobotListItem";
import { MARKER_COLOR } from "./constants";

export function Sidebar() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const robots = useFleet((s) => s.robots);
  const selectedId = useFleet((s) => s.selectedId);
  const select = useFleet((s) => s.select);
  const flyTo = useFleet((s) => s.flyTo);
  const list = Object.values(robots).sort((a, b) => a.id.localeCompare(b.id));

  const counts = list.reduce(
    (acc, r) => {
      const status = r.status ?? "offline";
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <aside className="h-full bg-white flex flex-col">
      <div className="px-3 py-3 border-b border-border">
        <div className="text-ui-sm uppercase tracking-wider text-t3 font-semibold">
          Fleet ({list.length})
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1">
          <Stat label="Active" value={counts.active ?? 0} status="active" />
          <Stat label="Idle" value={counts.idle ?? 0} status="idle" />
          <Stat label="Charge" value={counts.charging ?? 0} status="charging" />
          <Stat label="Alert" value={counts.alert ?? 0} status="alert" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <p className="px-3 py-6 text-ui-md text-t3">No robots online.</p>
        ) : (
          list.map((r) => (
            <RobotListItem
              key={r.id}
              robot={r}
              selected={selectedId === r.id}
              onClick={() => select(r.id === selectedId ? null : r.id)}
              onDoubleClick={() => {
                select(r.id);
                flyTo(r.id);
              }}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function Stat({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: string;
}) {
  const color = MARKER_COLOR[status] ?? "#94A3B8";
  const active = value > 0;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-ui-lg font-bold tabular-nums"
        style={{ color: active ? color : "#CBD5E1" }}
      >
        {value}
      </span>
      <span className="text-ui-xs text-t3">{label}</span>
    </div>
  );
}
