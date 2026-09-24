import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useField, useUpdateField } from "@/api/fields";
import type { Field } from "@/api/client";
import { fieldBbox } from "@/components/map/fieldUtils";
import type { Vertex } from "@/components/map/draw/DrawLayer";
import { FieldPolygonEditor } from "./FieldPolygonEditor";

interface Props {
  id: string;
}

// The stored ring repeats its first vertex at the end, the editor works on the open list.
function exteriorOf(field: Field): Vertex[] {
  return ((field.geometry.coordinates[0] ?? []) as Vertex[]).slice(0, -1);
}

export function FieldEdit({ id }: Props) {
  const { data: field, isLoading } = useField(id);

  // The editor mounts once the field exists and stays even if a later refetch fails, so edits are never lost.
  if (field) return <FieldEditor key={field.id} field={field} />;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-ui-md text-t3">
        Loading…
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center h-full text-ui-md text-red-500">
      Field not found.
    </div>
  );
}

function FieldEditor({ field }: { field: Field }) {
  const navigate = useNavigate();
  const update = useUpdateField(field.id);
  const initialVertices = exteriorOf(field);
  const fit = useMemo(
    () =>
      field.geometry.coordinates[0]?.length ? fieldBbox(field.geometry) : null,
    [field],
  );

  return (
    <FieldPolygonEditor
      title={`Edit: ${field.name}`}
      initialVertices={initialVertices}
      initialName={field.name}
      initialNotes={field.notes ?? ""}
      fit={fit}
      redrawKeepsVertices
      submitLabel="Save changes"
      pending={update.isPending}
      onSubmit={async ({ ring, name, notes }) => {
        await update.mutateAsync({
          name,
          geometry: { type: "Polygon", coordinates: [ring] },
          notes,
        });
        navigate({ to: "/fields/$id", params: { id: field.id } });
      }}
    />
  );
}
