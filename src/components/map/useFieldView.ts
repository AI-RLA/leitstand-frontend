import { useMemo } from "react";
import type { Field } from "@/api/client";
import { fieldBbox } from "./fieldUtils";
import type { OpeningView } from "./openingView";

/** The view that frames one field, or undefined when it is not among the fields. */
export function useFieldView(
  fields: Field[],
  fieldId: string | null,
): OpeningView | undefined {
  return useMemo(() => {
    const field = fields.find((f) => f.id === fieldId);
    const bounds = field ? fieldBbox(field.geometry) : null;
    return bounds ? { bounds, padding: 80, maxZoom: 19 } : undefined;
  }, [fields, fieldId]);
}
