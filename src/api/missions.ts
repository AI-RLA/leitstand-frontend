import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type CancelMode,
  type Mission,
  type MissionCreate,
  type MissionDispatchBody,
  type MissionUpdate,
} from "./client";
import { missionRunsKey } from "./runs";

export const MISSIONS_KEY = ["missions"] as const;
export const missionKey = (id: string) => ["missions", id] as const;

export function useMissions() {
  return useQuery({
    queryKey: MISSIONS_KEY,
    queryFn: () => api.listMissions(),
  });
}

export function useMission(
  id: string,
  options?: { refetchInterval?: number; enabled?: boolean },
) {
  return useQuery({
    queryKey: missionKey(id),
    queryFn: () => api.getMission(id),
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  });
}

export function useCreateMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MissionCreate) => api.createMission(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: MISSIONS_KEY }),
  });
}

export function useUpdateMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MissionUpdate) => api.updateMission(id, body),
    onSuccess: (updated: Mission) => {
      qc.setQueryData(missionKey(id), updated);
      qc.invalidateQueries({ queryKey: MISSIONS_KEY });
    },
  });
}

export function useAssignMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (robotId: string) => api.assignMission(id, robotId),
    onSettled: () => {
      void qc.refetchQueries({ queryKey: missionKey(id) });
      void qc.invalidateQueries({ queryKey: MISSIONS_KEY, exact: true });
    },
  });
}

export function useUnassignMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.unassignMission(id),
    onSettled: () => {
      void qc.refetchQueries({ queryKey: missionKey(id) });
      void qc.invalidateQueries({ queryKey: MISSIONS_KEY, exact: true });
    },
  });
}

export function useDispatchMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<MissionDispatchBody> = {}) =>
      api.dispatchMission(id, body),
    onSettled: () => {
      void qc.refetchQueries({ queryKey: missionKey(id) });
      void qc.invalidateQueries({ queryKey: MISSIONS_KEY, exact: true });
      void qc.invalidateQueries({ queryKey: missionRunsKey(id) });
    },
  });
}

export function useCancelMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId = null,
      mode = "immediate",
    }: { runId?: string | null; mode?: CancelMode } = {}) =>
      api.cancelMission(id, runId, mode),
    onSuccess: (updated: Mission) => {
      qc.setQueryData(missionKey(id), updated);
      qc.invalidateQueries({ queryKey: MISSIONS_KEY });
      qc.invalidateQueries({ queryKey: missionRunsKey(id) });
    },
  });
}

export function useCloseMissionRun(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string | null = null) => api.closeMissionRun(id, runId),
    onSuccess: (updated: Mission) => {
      qc.setQueryData(missionKey(id), updated);
      qc.invalidateQueries({ queryKey: MISSIONS_KEY });
      qc.invalidateQueries({ queryKey: missionRunsKey(id) });
    },
  });
}

export function usePauseMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string | null = null) => api.pauseMission(id, runId),
    onSuccess: (updated: Mission) => {
      qc.setQueryData(missionKey(id), updated);
      qc.invalidateQueries({ queryKey: MISSIONS_KEY });
      qc.invalidateQueries({ queryKey: missionRunsKey(id) });
    },
  });
}

export function useResumeMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string | null = null) => api.resumeMission(id, runId),
    onSuccess: (updated: Mission) => {
      qc.setQueryData(missionKey(id), updated);
      qc.invalidateQueries({ queryKey: MISSIONS_KEY });
      qc.invalidateQueries({ queryKey: missionRunsKey(id) });
    },
  });
}

export function useRestoreMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.restoreMission(id),
    onSuccess: (updated: Mission) => {
      qc.setQueryData(missionKey(id), updated);
      qc.invalidateQueries({ queryKey: MISSIONS_KEY });
    },
  });
}

export function useDeleteMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteMission(id),
    onSuccess: () => {
      // A mission that has run is archived rather than removed, so its detail stays fetchable.
      void qc.invalidateQueries({ queryKey: missionKey(id) });
      qc.setQueryData<Mission[]>(
        MISSIONS_KEY,
        (old) => old?.filter((m) => m.mission_id !== id) ?? [],
      );
      qc.invalidateQueries({ queryKey: MISSIONS_KEY, exact: true });
    },
  });
}
