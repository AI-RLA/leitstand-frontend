import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Field, type FieldCreate, type FieldUpdate } from "./client";

export const FIELDS_KEY = ["fields"] as const;
export const fieldKey = (id: string) => ["fields", id] as const;

// A shared empty list, so consumers do not see a new array identity on every render while loading.
export const NO_FIELDS: Field[] = [];

export function useFields(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: FIELDS_KEY,
    queryFn: api.listFields,
    enabled: options?.enabled,
  });
}

export function useField(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: fieldKey(id),
    queryFn: () => api.getField(id),
    enabled: options?.enabled,
  });
}

export function useCreateField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FieldCreate) => api.createField(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: FIELDS_KEY }),
  });
}

export function useUpdateField(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FieldUpdate) => api.updateField(id, body),
    onSuccess: (updated: Field) => {
      qc.setQueryData(fieldKey(id), updated);
      qc.invalidateQueries({ queryKey: FIELDS_KEY });
    },
  });
}

export function useDeleteField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteField(id),
    onSuccess: (_: void, id: string) => {
      qc.removeQueries({ queryKey: fieldKey(id) });
      qc.invalidateQueries({ queryKey: FIELDS_KEY });
    },
  });
}
