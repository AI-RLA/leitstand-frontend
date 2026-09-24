import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFields } from "@/api/fields";
import type { Field } from "@/api/client";
import { LeitstandMap } from "@/components/map/LeitstandMap";
import { FieldsLayer } from "@/components/map/FieldsLayer";
import { FitBounds } from "@/components/map/FitBounds";
import { fieldBbox } from "@/components/map/fieldUtils";

// A shared empty list, so the layer's data does not change identity while the query loads.
const NO_FIELDS: Field[] = [];

type Props = { selectedFieldId: string | null };

export function FieldsMap({ selectedFieldId }: Props) {
  const navigate = useNavigate();
  const { data: fields = NO_FIELDS } = useFields();
  const bounds = useMemo(() => {
    const selected = fields.find((f) => f.id === selectedFieldId);
    return selected ? fieldBbox(selected.geometry) : null;
  }, [fields, selectedFieldId]);

  const openField = (field: Field) =>
    navigate({ to: "/fields/$id", params: { id: field.id } });

  return (
    <LeitstandMap view="remembered">
      <FieldsLayer
        fields={fields}
        selectedId={selectedFieldId}
        onClick={openField}
      />
      <FitBounds bounds={bounds} fitKey={selectedFieldId} />
    </LeitstandMap>
  );
}
