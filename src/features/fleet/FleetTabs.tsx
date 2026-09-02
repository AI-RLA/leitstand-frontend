/**
 * The fleet overview's context tabs: what is selected on the map, and what is running on it.
 *
 * They live in the side panel alongside the assistant rather than in a rail of their own, so
 * the right edge is one panel with one width instead of two competing for the map.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useFields } from "@/api/fields";
import { useMissions } from "@/api/missions";
import { useMissionState, useMissionStates } from "@/ws/missionState";
import { useFleet } from "@/stores/fleet";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  isActiveStatus,
  toMissionViewModel,
} from "@/features/missions/adapters";
import type { Mission, MissionState } from "@/api/client";
import {
  STATUS_COLORS,
  batteryColor,
  relativeTime,
  latestTs,
} from "./constants";

export function RobotTab() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const selectedId = useFleet((s) => s.selectedId);
  const robots = useFleet((s) => s.robots);
  const { data: missions = [] } = useMissions();

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
  const status = robot.status ?? "unknown";
  const badge = STATUS_COLORS[status] ?? STATUS_COLORS.offline;
  const battPct = robot.battery?.battery_pct ?? null;
  const ts = latestTs(robot.battery?.ts, robot.pose?.ts);

  const activeMission =
    missions.find(
      (m) => m.robot_id === selectedId && isActiveStatus(m.status),
    ) ?? null;

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

      <div>
        <div className="text-ui-xs uppercase tracking-wider text-t3 font-semibold mb-2">
          Current mission
        </div>
        {activeMission ? (
          <CurrentMissionCard mission={activeMission} />
        ) : (
          <span className="text-ui-xs text-t3">None — robot is idle.</span>
        )}
      </div>

      <div className="text-ui-xs text-t3">
        {offline ? "Last seen" : "Updated"} {ts ? relativeTime(ts) : "—"}
      </div>
    </div>
  );
}

function CurrentMissionCard({ mission }: { mission: Mission }) {
  const live = useMissionState(mission.mission_id);
  const vm = toMissionViewModel(mission, live);
  return (
    <Link
      to="/missions/$id"
      params={{ id: vm.id }}
      className="block border border-border rounded-md p-2.5 hover:bg-muted transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-ui-sm font-medium text-t1 truncate flex-1">
          {vm.name}
        </span>
        <StatusPill variant="mission" status={vm.status} />
      </div>
      {vm.currentStageIndex !== null && (
        <p className="text-ui-xs text-t3 mb-1 tabular-nums">
          Stage {vm.currentStageIndex + 1}/{vm.stageCount}
        </p>
      )}
      {vm.overallProgress !== null && (
        <div className="h-[3px] bg-[#E2E8F0] rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${vm.overallProgress * 100}%` }}
          />
        </div>
      )}
    </Link>
  );
}

export function MissionsTab() {
  const { data: missions = [], isLoading } = useMissions();
  const liveStates = useMissionStates();

  const active = missions.filter((m) => isActiveStatus(m.status));
  const drafts = missions.filter((m) => m.status === "DRAFT");
  const recent = missions
    .filter(
      (m) =>
        !isActiveStatus(m.status) &&
        m.status !== "DRAFT" &&
        m.status !== "ASSIGNED",
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 5);
  const scheduled = missions.filter((m) => m.status === "ASSIGNED");

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <Link
          to="/missions/new"
          className="flex items-center justify-center w-full h-8 rounded bg-primary text-white text-ui-md font-semibold hover:bg-[#15803D] transition-colors"
        >
          New Mission
        </Link>
      </div>

      {isLoading && (
        <div className="p-4 text-t3 text-ui-sm">Loading missions…</div>
      )}

      {!isLoading && missions.length === 0 && (
        <div className="p-4 text-t3 text-ui-sm">No missions yet.</div>
      )}

      <div className="flex-1 overflow-y-auto">
        {active.length > 0 && (
          <BucketSection
            title="Running now"
            count={active.length}
            dotColor="bg-[#16A34A]"
          >
            {active.map((m) => (
              <MissionRow
                key={m.mission_id}
                mission={m}
                live={liveStates.get(m.mission_id) ?? null}
              />
            ))}
          </BucketSection>
        )}
        {scheduled.length > 0 && (
          <BucketSection
            title="Scheduled"
            count={scheduled.length}
            dotColor="bg-[#3B82F6]"
          >
            {scheduled.map((m) => (
              <MissionRow
                key={m.mission_id}
                mission={m}
                live={liveStates.get(m.mission_id) ?? null}
              />
            ))}
          </BucketSection>
        )}
        {drafts.length > 0 && (
          <BucketSection
            title="Drafts"
            count={drafts.length}
            dotColor="bg-[#94A3B8]"
          >
            {drafts.map((m) => (
              <MissionRow
                key={m.mission_id}
                mission={m}
                live={liveStates.get(m.mission_id) ?? null}
              />
            ))}
          </BucketSection>
        )}
        {recent.length > 0 && (
          <BucketSection
            title="Recent"
            count={recent.length}
            dotColor="bg-[#94A3B8]"
          >
            {recent.map((m) => (
              <MissionRow
                key={m.mission_id}
                mission={m}
                live={liveStates.get(m.mission_id) ?? null}
              />
            ))}
          </BucketSection>
        )}
      </div>

      {missions.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <Link
            to="/missions"
            className="text-ui-xs text-primary hover:underline"
          >
            View all missions →
          </Link>
        </div>
      )}
    </div>
  );
}

function MissionRow({
  mission,
  live,
}: {
  mission: Mission;
  live: MissionState | null;
}) {
  const vm = toMissionViewModel(mission, live);
  return (
    <Link
      to="/missions/$id"
      params={{ id: vm.id }}
      className="block px-3 py-2 hover:bg-muted transition-colors border-b border-border"
    >
      <div className="flex items-center gap-2">
        <StatusPill variant="mission" status={vm.status} dotOnly />
        <span className="text-ui-sm font-medium text-t1 truncate flex-1">
          {vm.name}
        </span>
        {vm.robotId && (
          <span
            className="text-ui-xs text-t3 font-mono truncate min-w-0 max-w-[40%]"
            title={vm.robotId}
          >
            {vm.robotId}
          </span>
        )}
      </div>
      {vm.status === "RUNNING" && vm.overallProgress !== null && (
        <div className="ml-[15px] mt-1.5 h-[3px] bg-[#E2E8F0] rounded-full overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{ width: `${vm.overallProgress * 100}%` }}
          />
        </div>
      )}
    </Link>
  );
}

function BucketSection({
  title,
  count,
  dotColor,
  children,
}: {
  title: string;
  count: number;
  dotColor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-3 py-1.5 bg-[#FAFBFC] border-b border-border flex items-center gap-1.5">
        <span
          className={`inline-block w-[5px] h-[5px] rounded-full ${dotColor}`}
        />
        <span className="text-ui-xs font-semibold text-t3 uppercase tracking-wider">
          {title}
        </span>
        <span className="text-ui-xs text-t2 font-bold tabular-nums">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

export function FieldsTab() {
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
                      : "border-transparent hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 w-2 h-2 rounded-[2px] bg-primary" />
                    <span className="text-ui-md font-semibold text-t1 truncate flex-1">
                      {field.name}
                    </span>
                    <span className="text-ui-xs font-mono text-t2 shrink-0">
                      {(field.area_ha ?? 0).toFixed(2)} ha
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
