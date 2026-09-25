import { useQuery } from "@tanstack/react-query";
import { api, type Robot } from "./client";

export const ROBOTS_KEY = ["robots"] as const;

export function useRobots(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ROBOTS_KEY,
    queryFn: api.listRobots,
    enabled: options?.enabled,
  });
}

export function useOnlineRobots(): Robot[] {
  const { data } = useRobots();
  return (data ?? []).filter((r) => r.online);
}
