import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type Mission,
  type MissionCreate,
  type MissionUpdate,
} from "./client";

export const MISSIONS_KEY = ["missions"] as const;
export const missionKey = (id: string) => ["missions", id] as const;

export function useMissions() {
  return useQuery({ queryKey: MISSIONS_KEY, queryFn: api.listMissions });
}

export function useMission(id: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: missionKey(id),
    queryFn: () => api.getMission(id),
    refetchInterval: options?.refetchInterval,
  });
}

export function useMissionLatestState(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...missionKey(id), "state"],
    queryFn: () => api.getMissionState(id),
    enabled,
    retry: false, // a 404 (mission never produced state) must not retry-loop
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
    mutationFn: () => api.dispatchMission(id),
    onSettled: () => {
      void qc.refetchQueries({ queryKey: missionKey(id) });
      void qc.invalidateQueries({ queryKey: MISSIONS_KEY, exact: true });
    },
  });
}

export function useCancelMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.cancelMission(id),
    onSuccess: (updated: Mission) => {
      qc.setQueryData(missionKey(id), updated);
      qc.invalidateQueries({ queryKey: MISSIONS_KEY });
    },
  });
}

export function usePauseMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.pauseMission(id),
    onSuccess: (updated: Mission) => {
      qc.setQueryData(missionKey(id), updated);
      qc.invalidateQueries({ queryKey: MISSIONS_KEY });
    },
  });
}

export function useResumeMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.resumeMission(id),
    onSuccess: (updated: Mission) => {
      qc.setQueryData(missionKey(id), updated);
      qc.invalidateQueries({ queryKey: MISSIONS_KEY });
    },
  });
}

export function useResetMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetMission(id),
    onSettled: () => {
      void qc.refetchQueries({ queryKey: missionKey(id) });
      void qc.invalidateQueries({ queryKey: MISSIONS_KEY, exact: true });
    },
  });
}

export function useDeleteMission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteMission(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: missionKey(id) });
      qc.setQueryData<Mission[]>(
        MISSIONS_KEY,
        (old) => old?.filter((m) => m.mission_id !== id) ?? [],
      );
      qc.invalidateQueries({ queryKey: MISSIONS_KEY, exact: true });
    },
  });
}
