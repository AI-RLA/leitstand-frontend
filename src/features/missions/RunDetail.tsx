import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMission } from "@/api/missions";
import { useAnnotateRun, useDeleteRun, useRun, useRunState } from "@/api/runs";
import { useSites } from "@/api/sites";
import { useField } from "@/api/fields";
import { StatusPill } from "@/components/ui/StatusPill";
import { useMissionState } from "@/ws/missionState";
import { coverageOf, isActiveStatus, toMissionViewModel } from "./adapters";
import { MissionStageTimeline } from "./components/MissionStageTimeline";
import { MissionPathPreview } from "./components/MissionPathPreview";
import { MissionFailureCard } from "./components/MissionFailureCard";

interface Props {
  missionId: string;
  runId: string;
}

/**
 * One run: the plan it executed, frozen at dispatch, coloured by what each stage did.
 *
 * Live only while the run is active; a finished run is read once and never changes, so its
 * map and timeline are what happened, not what the mission looks like now.
 */
export function RunDetail({ missionId, runId }: Props) {
  const navigate = useNavigate();
  const { data: mission } = useMission(missionId);
  const { data: run, isLoading, isError } = useRun(missionId, runId);
  const active = isActiveStatus(run?.status);
  const live = useMissionState(active ? missionId : null, runId);
  const durable = useRunState(missionId, runId, !!run && !active);
  const annotate = useAnnotateRun(missionId, runId);
  const remove = useDeleteRun(runId, missionId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);
  const { data: sites = [] } = useSites();
  const coverageFieldId = coverageOf(run?.stages)?.field_id;
  const { data: coverageField } = useField(coverageFieldId ?? "", {
    enabled: !!coverageFieldId,
  });

  // The field is seeded from the run once it loads and otherwise left alone: a re-render while
  // the operator types must not overwrite what they wrote.
  const [notes, setNotes] = useState<string | null>(null);
  const shownNotes = notes ?? run?.notes ?? "";
  // Rebuilt on every render this defeats the preview's memo and re-walks every waypoint.
  const mapMission = useMemo(
    () =>
      mission && run
        ? { ...mission, stages: run.stages, latest_run: run }
        : null,
    [mission, run],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-t3">Loading…</span>
      </div>
    );
  }
  if (isError || !run || !mission) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-red-500">Run not found.</span>
      </div>
    );
  }

  const state = active ? live : (durable.data ?? null);
  // The view model is built on the run's own plan, so editing the mission afterwards changes
  // nothing here.
  const vm = toMissionViewModel({ ...mission, latest_run: run }, state, run);
  const started = run.dispatched_at ?? run.created_at;
  const facts = [
    run.robot_id,
    `started ${new Date(started).toLocaleString()}`,
    run.ended_at ? `ended ${new Date(run.ended_at).toLocaleString()}` : null,
  ].filter(Boolean);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync();
      navigate({ to: "/missions/$id", params: { id: missionId } });
    } finally {
      setConfirmDelete(false);
    }
  }

  function saveNotes() {
    const next = shownNotes.trim() || null;
    if (next === (run?.notes ?? null)) return;
    annotate.mutate(next);
  }

  return (
    <div className="p-6 min-h-full flex flex-col [@container(min-width:46.5rem)]:h-full">
      <div className="shrink-0 mb-4">
        <Link
          to="/missions/$id"
          params={{ id: missionId }}
          className="inline-flex items-center gap-1 text-ui-sm text-t3 hover:text-t1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {mission.name}
        </Link>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <h2 className="text-ui-xl font-semibold text-t1 leading-tight">
            Run of {mission.name}
          </h2>
          <StatusPill variant="mission" status={run.status} />
          {active && live && (
            <span className="text-ui-xs text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] px-1.5 py-0.5 rounded">
              live
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-4">
          <p className="text-ui-sm text-t3 mt-1">{facts.join(" · ")}</p>
          {!active && (
            <button
              onClick={handleDelete}
              disabled={remove.isPending}
              className={
                confirmDelete
                  ? "shrink-0 text-ui-sm text-white bg-red-500 border border-red-500 px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
                  : "shrink-0 text-ui-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"
              }
              title="Removes this run's record. The audit log keeps the attempt."
            >
              {remove.isPending
                ? "Deleting…"
                : confirmDelete
                  ? "Confirm delete?"
                  : "Delete run"}
            </button>
          )}
        </div>
        {remove.isError && (
          <p className="text-ui-xs text-red-500 mt-1">
            Could not delete this run.
          </p>
        )}
        <p className="text-ui-xs text-t3 mt-0.5 font-mono">
          plan {run.stages_digest.slice(0, 12)}
          {mission.latest_run &&
          run.stages_digest !== mission.latest_run.stages_digest
            ? " · differs from the latest run"
            : ""}
        </p>
      </div>

      {run.failure_errors && run.failure_errors.length > 0 && (
        <div className="shrink-0">
          <MissionFailureCard errors={run.failure_errors} />
        </div>
      )}

      <div className="flex flex-wrap gap-6 [@container(min-width:46.5rem)]:flex-1 [@container(min-width:46.5rem)]:min-h-0">
        <div className="flex-1 basis-[17rem] max-w-[22rem] min-w-0 [@container(min-width:46.5rem)]:overflow-y-auto">
          <div className="mb-3">
            <MissionStageTimeline
              stages={vm.stages}
              statePending={!active && !state && durable.isLoading}
            />
          </div>
          <div className="rounded-lg border border-border bg-white px-4 py-3">
            <label
              className="block text-ui-sm font-semibold text-t1 mb-1"
              htmlFor="run-notes"
            >
              Notes
            </label>
            <textarea
              id="run-notes"
              value={shownNotes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={3}
              placeholder="Conditions, observations, anything worth knowing about this run."
              className="w-full border border-border rounded-md px-2 py-1.5 text-ui-sm text-t1 bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            />
            {annotate.isError && (
              <p className="text-ui-xs text-red-500 mt-1">
                Could not save the notes.
              </p>
            )}
          </div>
        </div>
        <div className="flex-[2] basis-[28rem] min-w-0 flex [@container(max-width:46.5rem)]:order-first">
          <div className="flex-1 h-[60vh] min-h-[20rem] sticky top-0 [@container(min-width:46.5rem)]:h-full">
            <MissionPathPreview
              mission={mapMission ?? mission}
              state={state}
              sites={sites}
              siteAnchors={run.site_anchors}
              field={coverageField}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
