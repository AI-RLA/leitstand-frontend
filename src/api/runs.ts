import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Run } from "./client";

export const missionRunsKey = (missionId: string) =>
  ["missions", missionId, "runs"] as const;
// Nested under the mission so one non-exact invalidation of ["missions"] reaches the mission,
// its run list and an open run together, with no mutation having to remember a second root.
export const runKey = (missionId: string, runId: string) =>
  ["missions", missionId, "runs", runId] as const;

export function useMissionRuns(missionId: string) {
  return useQuery({
    queryKey: missionRunsKey(missionId),
    queryFn: () => api.listMissionRuns(missionId),
  });
}

export function useRun(missionId: string, runId: string | null | undefined) {
  return useQuery({
    queryKey: runKey(missionId, runId ?? ""),
    queryFn: () => api.getRun(runId!),
    enabled: !!runId,
  });
}

export function useRunState(
  missionId: string,
  runId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: [...runKey(missionId, runId ?? ""), "state"],
    queryFn: () => api.getRunState(runId!),
    enabled: !!runId && enabled,
    retry: false,
  });
}

export function useAnnotateRun(missionId: string, runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notes: string | null) => api.annotateRun(runId, notes),
    onSuccess: (updated: Run) => {
      qc.setQueryData(runKey(missionId, runId), updated);
      void qc.invalidateQueries({ queryKey: missionRunsKey(missionId) });
    },
  });
}

export function useDeleteRun(runId: string, missionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteRun(runId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: runKey(missionId, runId) });
      void qc.invalidateQueries({ queryKey: missionRunsKey(missionId) });
      void qc.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}
