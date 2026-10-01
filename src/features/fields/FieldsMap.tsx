import { useNavigate } from "@tanstack/react-router";
import { NO_FIELDS, useFields } from "@/api/fields";
import type { Field } from "@/api/client";
import { LeitstandMap } from "@/components/map/LeitstandMap";
import { FieldsLayer } from "@/components/map/FieldsLayer";
import { useFieldView } from "@/components/map/useFieldView";

type Props = { selectedFieldId: string | null };

export function FieldsMap({ selectedFieldId }: Props) {
  const navigate = useNavigate();
  const { data: fields = NO_FIELDS } = useFields();
  const fieldView = useFieldView(fields, selectedFieldId);

  const openField = (field: Field) =>
    navigate({ to: "/fields/$id", params: { id: field.id } });

  return (
    <LeitstandMap rememberView view={fieldView} viewKey={selectedFieldId}>
      <FieldsLayer
        fields={fields}
        selectedId={selectedFieldId}
        onClick={openField}
      />
    </LeitstandMap>
  );
}
