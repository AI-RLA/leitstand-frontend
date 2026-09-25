import { useNavigate } from "@tanstack/react-router";
import { NO_FIELDS, useFields } from "@/api/fields";
import type { Field } from "@/api/client";
import { LeitstandMap } from "@/components/map/LeitstandMap";
import { FieldsLayer } from "@/components/map/FieldsLayer";
import { FitBounds } from "@/components/map/FitBounds";
import { useFieldBounds } from "@/components/map/useFieldBounds";

type Props = { selectedFieldId: string | null };

export function FieldsMap({ selectedFieldId }: Props) {
  const navigate = useNavigate();
  const { data: fields = NO_FIELDS } = useFields();
  const bounds = useFieldBounds(fields, selectedFieldId);

  const openField = (field: Field) =>
    navigate({ to: "/fields/$id", params: { id: field.id } });

  return (
    <LeitstandMap rememberView>
      <FieldsLayer
        fields={fields}
        selectedId={selectedFieldId}
        onClick={openField}
      />
      <FitBounds bounds={bounds} fitKey={selectedFieldId} />
    </LeitstandMap>
  );
}
