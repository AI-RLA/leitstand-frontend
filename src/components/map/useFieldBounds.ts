import { useMemo } from "react";
import type { Field } from "@/api/client";
import { fieldBbox, type LngLatBox } from "./fieldUtils";

export function useFieldBounds(
  fields: Field[],
  fieldId: string | null,
): LngLatBox | null {
  return useMemo(() => {
    const field = fields.find((f) => f.id === fieldId);
    return field ? fieldBbox(field.geometry) : null;
  }, [fields, fieldId]);
}
