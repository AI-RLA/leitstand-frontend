import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Site, type SiteCreate, type SiteUpdate } from "./client";

export const SITES_KEY = ["sites"] as const;
export const siteKey = (id: string) => ["sites", id] as const;

// A shared empty list, so consumers do not see a new array identity on every render while loading.
export const NO_SITES: Site[] = [];

export function useSites(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: SITES_KEY,
    queryFn: api.listSites,
    enabled: options?.enabled,
  });
}

export function useSite(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: siteKey(id),
    queryFn: () => api.getSite(id),
    enabled: options?.enabled,
  });
}

export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SiteCreate) => api.createSite(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: SITES_KEY }),
  });
}

export function useUpdateSite(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SiteUpdate) => api.updateSite(id, body),
    onSuccess: (updated: Site) => {
      qc.setQueryData(siteKey(id), updated);
      qc.invalidateQueries({ queryKey: SITES_KEY });
    },
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSite(id),
    onSuccess: (_: void, id: string) => {
      qc.removeQueries({ queryKey: siteKey(id) });
      qc.invalidateQueries({ queryKey: SITES_KEY });
    },
  });
}
