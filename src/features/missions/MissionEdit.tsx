import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import {
  useAssignMission,
  useMission,
  useUnassignMission,
  useUpdateMission,
} from "@/api/missions";
import { MissionForm, type MissionFormValues } from "./components/MissionForm";
import { stagesToDrafts } from "./components/stageTypes";

interface Props {
  id: string;
}

export function MissionEdit({ id }: Props) {
  const navigate = useNavigate();
  const { data: mission, isLoading, isError } = useMission(id);
  const update = useUpdateMission(id);
  const assign = useAssignMission(id);
  const unassign = useUnassignMission(id);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: MissionFormValues) {
    if (!mission) return;
    setError(null);
    try {
      await update.mutateAsync({
        name: values.name,
        description: values.description,
        stages: values.stages,
      });
      if (values.assignedRobotId !== mission.assigned_robot_id) {
        if (values.assignedRobotId)
          await assign.mutateAsync(values.assignedRobotId);
        else await unassign.mutateAsync();
      }
      navigate({ to: "/missions/$id", params: { id } });
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }

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

  return (
    <MissionForm
      key={mission.mission_id}
      header={
        <>
          <Link
            to="/missions/$id"
            params={{ id }}
            className="inline-flex items-center gap-1 text-ui-xs text-t3 hover:text-t1 transition-colors mb-2"
          >
            <ChevronLeft className="w-3 h-3" />
            {mission.name}
          </Link>
          <h2 className="text-ui-xl font-semibold text-t1 leading-tight">
            Edit mission
          </h2>
        </>
      }
      initialName={mission.name}
      initialDescription={mission.description ?? ""}
      initialStages={stagesToDrafts(mission.stages)}
      initialRobotId={mission.assigned_robot_id}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      isPending={update.isPending || assign.isPending || unassign.isPending}
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => navigate({ to: "/missions/$id", params: { id } })}
    />
  );
}
