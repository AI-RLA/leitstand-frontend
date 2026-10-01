import { useNavigate } from "@tanstack/react-router";
import { useCreateField } from "@/api/fields";
import { FieldPolygonEditor } from "./FieldPolygonEditor";

export function FieldDraw() {
  const navigate = useNavigate();
  const create = useCreateField();

  return (
    <FieldPolygonEditor
      title="New field"
      submitLabel="Create field"
      pending={create.isPending}
      onSubmit={async ({ ring, name, notes }) => {
        const field = await create.mutateAsync({
          name,
          geometry: { type: "Polygon", coordinates: [ring] },
          notes,
        });
        navigate({ to: "/fields/$id", params: { id: field.id } });
      }}
    />
  );
}
