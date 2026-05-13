import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useFields } from "@/api/fields";
import { useFleet } from "@/stores/fleet";
import {
  STATUS_COLORS,
  batteryColor,
  relativeTime,
  latestTs,
} from "./constants";

export function RightRail() {
  const tab = useFleet((s) => s.activeTab);
  const setTab = useFleet((s) => s.setActiveTab);
  return (
    <aside className="h-full bg-white flex flex-col">
      <div className="h-12 px-1 border-b border-border flex items-center text-ui-md font-medium">
        <TabBtn active={tab === "robot"} onClick={() => setTab("robot")}>
          Robot
        </TabBtn>
        <TabBtn active={tab === "missions"} onClick={() => setTab("missions")}>
          Missions
        </TabBtn>
        <TabBtn active={tab === "fields"} onClick={() => setTab("fields")}>
          Fields
        </TabBtn>
        <TabBtn active={tab === "ai"} onClick={() => setTab("ai")}>
          AI Agent
        </TabBtn>
        <TabBtn active={tab === "alerts"} onClick={() => setTab("alerts")}>
          Alerts
        </TabBtn>
      </div>
      <div className="flex-1 overflow-y-auto text-ui-md text-t2">
        {tab === "robot" && <RobotTab />}
        {tab === "ai" && <div className="p-4">Not available.</div>}
        {tab === "missions" && (
          <div className="p-4">
            <button
              disabled
              className="w-full h-10 rounded bg-primary text-white text-ui-md font-semibold opacity-50 cursor-not-allowed"
            >
              Plan New Mission
            </button>
            <p className="mt-3">No missions yet.</p>
          </div>
        )}
        {tab === "fields" && <FieldsTab />}
        {tab === "alerts" && <div className="p-4">No alerts.</div>}
      </div>
    </aside>
  );
}

function RobotTab() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const selectedId = useFleet((s) => s.selectedId);
  const robots = useFleet((s) => s.robots);

  if (!selectedId) {
    return (
      <div className="p-4 text-ui-sm text-t3">
        Select a robot from the fleet list to show details.
      </div>
    );
  }

  const robot = robots[selectedId];
  if (!robot) return null;

  const offline = !robot.online;
  const status = offline ? "offline" : (robot.state?.status ?? "idle");
  const badge = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  const battPct = robot.battery?.battery_pct ?? null;
  const ts = latestTs(robot.state?.ts, robot.battery?.ts, robot.pose?.ts);

  return (
    <div className="p-4 flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-ui-md font-bold text-t1">
            {robot.id}
          </span>
          <span
            className="inline-flex items-center gap-1 text-ui-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: badge.bg, color: badge.text }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: badge.text }}
            />
            {status}
          </span>
        </div>
        {robot.state?.task && (
          <div className="mt-1 text-ui-xs text-t3 truncate">
            {robot.state.task}
          </div>
        )}
      </div>

      <div>
        <div className="text-ui-xs uppercase tracking-wider text-t3 font-semibold mb-2">
          Battery
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
            {battPct != null && (
              <div
                className="h-full rounded-full"
                style={{
                  width: `${battPct}%`,
                  background: offline ? "#9CA3AF" : batteryColor(battPct),
                }}
              />
            )}
          </div>
          <span className="font-mono text-ui-xs text-t2 tabular-nums w-8 text-right">
            {battPct != null ? `${battPct}%` : "—"}
          </span>
        </div>
      </div>

      <div>
        <div className="text-ui-xs uppercase tracking-wider text-t3 font-semibold mb-1">
          Position
        </div>
        <span className="font-mono text-ui-xs text-t2">
          {robot.pose
            ? `${robot.pose.lat.toFixed(5)}, ${robot.pose.lon.toFixed(5)}`
            : "—"}
        </span>
      </div>

      <div className="text-ui-xs text-t3">
        {offline ? "Last seen" : "Updated"} {ts ? relativeTime(ts) : "—"}
      </div>
    </div>
  );
}

function FieldsTab() {
  const { data: fields, isLoading } = useFields();
  const selectedFieldId = useFleet((s) => s.selectedFieldId);
  const selectField = useFleet((s) => s.selectField);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <Link
          to="/fields/new"
          className="flex items-center justify-center w-full h-8 rounded bg-primary text-white text-ui-md font-semibold hover:bg-[#15803D] transition-colors"
        >
          New Field
        </Link>
      </div>

      {isLoading && (
        <div className="p-4 text-t3 text-ui-sm">Loading fields...</div>
      )}

      {!isLoading && (!fields || fields.length === 0) && (
        <div className="p-4 text-t3 text-ui-sm">No fields yet.</div>
      )}

      {fields && fields.length > 0 && (
        <ul className="flex-1 overflow-y-auto">
          {fields.map((field) => {
            const selected = selectedFieldId === field.id;
            return (
              <li key={field.id}>
                <button
                  onClick={() => selectField(selected ? null : field.id)}
                  className={`w-full text-left py-[9px] px-3 border-l-[3px] ${
                    selected
                      ? "bg-[#F0FDF4] border-primary"
                      : "border-transparent hover:bg-[#F8FAFC]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 w-2 h-2 rounded-[2px] bg-primary" />
                    <span className="text-ui-md font-semibold text-t1 truncate flex-1">
                      {field.name}
                    </span>
                    <span className="text-ui-xs font-mono text-t2 shrink-0">
                      {field.area_ha.toFixed(2)} ha
                    </span>
                  </div>
                  {field.notes && (
                    <div className="mt-0.5 ml-4 text-ui-xs text-t3 truncate">
                      {field.notes}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-center pb-1 ${active ? "text-t1 border-b-2 border-primary" : "text-t2"}`}
    >
      {children}
    </button>
  );
}
