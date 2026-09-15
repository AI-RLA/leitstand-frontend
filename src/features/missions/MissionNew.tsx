import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { api, apiErrorMessage } from "@/api/client";
import { MISSIONS_KEY, useCreateMission } from "@/api/missions";
import { MissionForm, type MissionFormValues } from "./components/MissionForm";
import { emptyNavigationDraft } from "./components/stageTypes";

export function MissionNew() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useCreateMission();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The mission created by a submit whose assignment was refused; the next submit saves the
  // form into it and assigns again instead of creating a second mission.
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function handleSubmit(values: MissionFormValues) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: values.name,
        description: values.description,
        stages: values.stages,
      };
      let id = createdId;
      if (id === null) {
        id = (await create.mutateAsync(body)).mission_id;
        setCreatedId(id);
      } else {
        await api.updateMission(id, body);
      }
      // Assigned after the mission exists, because the check the assignment runs needs the
      // stages.
      if (values.assignedRobotId) {
        try {
          await api.assignMission(id, values.assignedRobotId);
        } catch (e) {
          setError(
            `The mission was created, but ${values.assignedRobotId} was refused: ${apiErrorMessage(e)}. Pick another robot or none, then save again to open it.`,
          );
          return;
        }
      }
      void qc.invalidateQueries({ queryKey: MISSIONS_KEY });
      await navigate({ to: "/missions/$id", params: { id } });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <MissionForm
      header={
        <>
          <Link
            to="/missions"
            className="inline-flex items-center gap-1 text-ui-xs text-t3 hover:text-t1 transition-colors mb-2"
          >
            <ChevronLeft className="w-3 h-3" />
            Missions
          </Link>
          <h2 className="text-ui-xl font-semibold text-t1 leading-tight">
            New mission
          </h2>
        </>
      }
      initialStages={[emptyNavigationDraft()]}
      submitLabel="Create mission"
      pendingLabel="Creating…"
      isPending={busy}
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => navigate({ to: "/missions" })}
    />
  );
}
