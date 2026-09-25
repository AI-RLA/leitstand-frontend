import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  useMission,
  useAssignMission,
  useUnassignMission,
  useDispatchMission,
  useRestoreMission,
  useDeleteMission,
} from "@/api/missions";
import { apiErrorMessage } from "@/api/client";
import { useRobots } from "@/api/robots";
import { NO_SITES, useSites } from "@/api/sites";
import { NO_FIELDS, useFields } from "@/api/fields";
import { useArmed } from "@/lib/useArmed";
import {
  coverageTurningRadius,
  dispatchRefusal,
  isMissionActive,
  stageViewModels,
} from "./adapters";
import { MissionPathPreview } from "./components/MissionPathPreview";
import { MissionStageTimeline } from "./components/MissionStageTimeline";
import { RunsTable } from "./components/RunsTable";

interface Props {
  id: string;
}

export function MissionDetail({ id }: Props) {
  const navigate = useNavigate();
  const {
    data: mission,
    isLoading,
    isError,
  } = useMission(id, { refetchInterval: 10_000 });
  const missionIsActive = !!mission && isMissionActive(mission);
  const archived = !!mission?.archived_at;
  const assign = useAssignMission(id);
  const unassign = useUnassignMission(id);
  const dispatch = useDispatchMission(id);
  const remove = useDeleteMission(id);
  const restore = useRestoreMission(id);
  const { data: robots = [] } = useRobots();
  const { data: sites = NO_SITES, isPending: sitesPending } = useSites();
  const { data: fields = NO_FIELDS, isPending: fieldsPending } = useFields();
  const coverageFields = useMemo(() => {
    const ids = new Set(
      (mission?.stages ?? []).flatMap((s) =>
        s.kind === "coverage" ? [s.provenance.field_id] : [],
      ),
    );
    return fields.filter((f) => ids.has(f.id));
  }, [mission, fields]);

  const [selectedRobot, setSelectedRobot] = useState("");
  const [confirmDelete, setConfirmDelete] = useArmed();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-t3">Loading…</span>
      </div>
    );
  }
  if (isError || !mission) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-red-500">Mission not found.</span>
      </div>
    );
  }

  const hasRun = mission.latest_run !== null;
  // A mission can be edited, run and deleted whenever no run is active. Deleting one that has
  // run archives it instead, and the button says so.
  const canAct = !missionIsActive && !archived;
  const stageCount = mission.stages.length;
  const changedAfterRun =
    mission.latest_run &&
    mission.latest_run.stages_digest !== mission.stages_digest
      ? mission.latest_run
      : null;
  const actionError =
    [assign, unassign, dispatch, restore, remove]
      .map((m) => (m.isError ? apiErrorMessage(m.error) : null))
      .find((msg) => msg !== null) ?? null;

  // The select serves Dispatch and Assign alike, so a robot the fleet cannot send to now stays
  // selectable and only the run is held back.
  const dispatchRobot = selectedRobot || mission.assigned_robot_id || "";
  const dispatchTarget = robots.find((r) => r.id === dispatchRobot);
  const runRefusal = dispatchTarget
    ? dispatchRefusal(mission, dispatchTarget)
    : null;

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRobot) return;
    try {
      await assign.mutateAsync(selectedRobot);
      setSelectedRobot("");
    } catch {
      // shown through actionError
    }
  }

  async function handleRun() {
    if (!dispatchRobot) return;
    try {
      const next = await dispatch.mutateAsync({ robot_id: dispatchRobot });
      setSelectedRobot("");
      const runId = next.latest_run?.run_id;
      if (runId) {
        navigate({ to: "/missions/$id/runs/$runId", params: { id, runId } });
      }
    } catch {
      // shown through actionError
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync();
      if (!hasRun) navigate({ to: "/missions" });
    } finally {
      setConfirmDelete(false);
    }
  }

  return (
    <div className="p-6 min-h-full flex flex-col [@container(min-width:53.5rem)]:h-full">
      {archived && (
        <div className="shrink-0 mb-4 flex items-center justify-between gap-3 rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
          <span className="text-ui-sm text-[#92400E]">
            Archived {new Date(mission.archived_at!).toLocaleString()}. Its runs
            stay readable; restore it to run or edit it again.
          </span>
          <button
            onClick={() => restore.mutate()}
            disabled={restore.isPending}
            className="text-ui-sm text-t2 border border-border bg-white px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] disabled:opacity-50 transition-colors"
          >
            {restore.isPending ? "Restoring…" : "Restore"}
          </button>
        </div>
      )}

      <div className="shrink-0 flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h2 className="text-ui-xl font-semibold text-t1 leading-tight">
            {mission.name}
          </h2>
          <p className="text-ui-sm text-t3 mt-1">
            {stageCount} {stageCount === 1 ? "stage" : "stages"} ·{" "}
            {mission.assigned_robot_id
              ? `default robot ${mission.assigned_robot_id}`
              : "no default robot"}
          </p>
          {mission.description && (
            <p className="text-ui-sm text-t3 mt-0.5">{mission.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {canAct &&
            (robots.length === 0 ? (
              <span className="text-ui-sm text-t3">No robots known</span>
            ) : (
              <form onSubmit={handleAssign} className="flex items-center gap-2">
                <select
                  value={selectedRobot}
                  onChange={(e) => setSelectedRobot(e.target.value)}
                  className="border border-border rounded-md px-3 py-1.5 text-ui-sm text-t1 bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                >
                  <option value="">
                    {mission.assigned_robot_id
                      ? `Default: ${mission.assigned_robot_id}`
                      : "Select robot…"}
                  </option>
                  {robots.map((r) => {
                    const why = dispatchRefusal(mission, r);
                    return (
                      <option key={r.id} value={r.id}>
                        {r.id}
                        {why ? ` (${why})` : ""}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={() => void handleRun()}
                  disabled={
                    !dispatchRobot || dispatch.isPending || runRefusal !== null
                  }
                  className="text-ui-sm bg-primary text-white px-3.5 py-1.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  title={
                    runRefusal !== null
                      ? `${dispatchRobot}: ${runRefusal}`
                      : coverageTurningRadius(mission) !== null
                        ? `The plan needs a turning radius of ${coverageTurningRadius(mission)} m or less.`
                        : undefined
                  }
                >
                  {dispatch.isPending
                    ? "Dispatching…"
                    : hasRun
                      ? "Run again"
                      : "Dispatch"}
                </button>
                <button
                  type="submit"
                  disabled={!selectedRobot || assign.isPending}
                  className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] disabled:opacity-50 transition-colors"
                  title="Make this the robot the mission runs on by default, without starting it."
                >
                  {assign.isPending ? "Assigning…" : "Assign"}
                </button>
                {mission.assigned_robot_id && (
                  <button
                    type="button"
                    onClick={() => unassign.mutate()}
                    disabled={unassign.isPending}
                    className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] disabled:opacity-50 transition-colors"
                  >
                    {unassign.isPending ? "Unassigning…" : "Unassign"}
                  </button>
                )}
              </form>
            ))}
          {canAct && (
            <Link
              to="/missions/$id/edit"
              params={{ id }}
              className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
            >
              Edit
            </Link>
          )}
          {canAct && (
            <button
              onClick={() => void handleDelete()}
              disabled={remove.isPending}
              className={
                confirmDelete
                  ? "text-ui-sm text-white bg-red-500 border border-red-500 px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
                  : "text-ui-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"
              }
              title={
                hasRun
                  ? "Archives the mission; its runs stay readable and it can be restored."
                  : "Deletes the mission. It has never run, so nothing else is lost."
              }
            >
              {remove.isPending
                ? hasRun
                  ? "Archiving…"
                  : "Deleting…"
                : confirmDelete
                  ? hasRun
                    ? "Confirm archive?"
                    : "Confirm delete?"
                  : hasRun
                    ? "Archive"
                    : "Delete"}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <p className="shrink-0 text-ui-sm text-red-500 mb-3">{actionError}</p>
      )}

      {/* The wrap breakpoint is the two columns' bases plus the gap (24 + 28 + 1.5rem), because
          any other number leaves a band where they sit side by side with no height to divide. */}
      <div className="flex flex-wrap gap-6 [@container(min-width:53.5rem)]:flex-1 [@container(min-width:53.5rem)]:min-h-0">
        <div className="flex-1 basis-[24rem] max-w-[30rem] min-w-0 [@container(min-width:53.5rem)]:overflow-y-auto">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
              Definition
            </p>
            {changedAfterRun && (
              <span
                className="text-ui-xs text-t3"
                title="The latest run drove an older plan; open it to see what it did."
              >
                changed {new Date(mission.updated_at).toLocaleDateString()},
                after the run of{" "}
                {new Date(
                  changedAfterRun.dispatched_at ?? changedAfterRun.created_at,
                ).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="mb-4">
            <MissionStageTimeline
              stages={stageViewModels(mission.stages, null)}
            />
          </div>
          <div className="mb-3">
            <RunsTable
              mission={mission}
              currentDigest={mission.stages_digest}
            />
          </div>
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
                Audit
              </p>
            </div>
            <div className="px-4 py-3">
              <AuditRow label="ID" value={mission.mission_id} mono />
              <AuditRow
                label="Created"
                value={new Date(mission.created_at).toLocaleString()}
              />
              <AuditRow
                label="Updated"
                value={new Date(mission.updated_at).toLocaleString()}
              />
            </div>
          </div>
        </div>

        {/* Geometry is what this page is for, so the map leads once the columns stack. */}
        <div className="flex-[2] basis-[28rem] min-w-0 flex [@container(max-width:53.5rem)]:order-first">
          <div className="flex-1 h-[60vh] min-h-[20rem] sticky top-0 [@container(min-width:53.5rem)]:h-full">
            <MissionPathPreview
              stages={mission.stages}
              fitKey={sitesPending || fieldsPending ? null : mission.mission_id}
              state={null}
              sites={sites}
              fields={coverageFields}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[3px]">
      <span className="text-ui-sm text-t3 shrink-0">{label}</span>
      <span
        className={`text-ui-sm min-w-0 text-t1 ${mono ? "font-mono break-all text-right" : "tabular-nums"}`}
      >
        {value}
      </span>
    </div>
  );
}
