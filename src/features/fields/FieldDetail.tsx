import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useField, useDeleteField, useUpdateField } from "@/api/fields";

interface Props {
  id: string;
}

export function FieldDetail({ id }: Props) {
  const navigate = useNavigate();
  const { data: field, isLoading, isError } = useField(id);
  const remove = useDeleteField();
  const update = useUpdateField(id);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!confirmDel) return;
    const t = setTimeout(() => setConfirmDel(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDel]);

  function startEdit() {
    setEditName(field!.name);
    setEditNotes(field!.notes ?? "");
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      name: editName.trim(),
      notes: editNotes.trim() || null,
    });
    setEditing(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-t3">Loading…</span>
      </div>
    );
  }
  if (isError || !field) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-red-500">Field not found.</span>
      </div>
    );
  }

  async function handleDelete() {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    await remove.mutateAsync(id);
    navigate({ to: "/fields" });
  }

  const ring = field.geometry.coordinates[0] ?? [];
  const interior = ring.slice(0, -1);
  const centroid =
    interior.length > 0
      ? `${(interior.reduce((s, c) => s + c[1], 0) / interior.length).toFixed(5)}°N  ${(interior.reduce((s, c) => s + c[0], 0) / interior.length).toFixed(5)}°E`
      : "—";

  return (
    <div className="p-6 max-w-2xl">
      {editing ? (
        <form onSubmit={handleSave} className="mb-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
              Name
            </span>
            <input
              autoFocus
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="border border-border rounded-md px-3 py-2 text-[13px] text-t1 bg-[#F8FAFC] focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
              Notes{" "}
              <span className="normal-case font-normal tracking-normal">
                (optional)
              </span>
            </span>
            <textarea
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="border border-border rounded-md px-3 py-2 text-[13px] text-t1 bg-[#F8FAFC] focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={update.isPending}
              className="text-ui-sm bg-primary text-white px-3.5 py-1.5 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-[20px] font-semibold text-t1 leading-tight">
              {field.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startEdit}
              className="text-ui-sm text-t2 border border-border px-3 py-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={remove.isPending}
              className={
                confirmDel
                  ? "text-ui-sm text-white bg-red-500 border border-red-500 px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
                  : "text-ui-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"
              }
            >
              {remove.isPending
                ? "Deleting…"
                : confirmDel
                  ? "Confirm delete?"
                  : "Delete"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat
          label="Area"
          value={`${field.area_ha.toFixed(3)}`}
          unit="ha"
          accent
        />
        <Stat label="Vertices" value={String(interior.length)} unit="pts" />
        <StatCentroid label="Centroid" value={centroid} />
      </div>

      {field.notes && (
        <Card title="Notes">
          <p className="text-[13px] text-t1 leading-relaxed">{field.notes}</p>
        </Card>
      )}

      <Card title="Audit">
        <Row
          label="Created"
          value={new Date(field.created_at).toLocaleString()}
        />
        <Row
          label="Updated"
          value={new Date(field.updated_at).toLocaleString()}
        />
        <Row label="ID" value={field.id} mono />
      </Card>

      <Link
        to="/fields/$id/edit"
        params={{ id }}
        className="mb-3 flex items-center justify-between w-full bg-white border border-border rounded-lg px-4 py-3 text-ui-md text-t2 hover:bg-[#F8FAFC] transition-colors"
      >
        <span className="font-medium">Edit geometry</span>
        <span className="text-t3">Redraw polygon →</span>
      </Link>

      <details className="bg-white border border-border rounded-lg overflow-hidden">
        <summary className="px-4 py-3 text-ui-md font-medium text-t2 cursor-pointer select-none hover:bg-[#F8FAFC] transition-colors list-none flex items-center justify-between">
          <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
            GeoJSON
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-t3"
          >
            <path d="M3 4.5L6 7.5L9 4.5" />
          </svg>
        </summary>
        <pre className="px-4 pb-4 pt-2 text-ui-xs font-mono text-t2 overflow-x-auto leading-relaxed border-t border-border">
          {JSON.stringify(field.geometry, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`bg-white border rounded-lg p-4 flex flex-col gap-1.5 ${accent ? "border-primary/20" : "border-border"}`}
    >
      <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-semibold text-t1 leading-none ${accent ? "text-[22px]" : "text-[20px]"}`}
        >
          {value}
        </span>
        {unit && <span className="text-ui-sm text-t3 font-medium">{unit}</span>}
      </div>
    </div>
  );
}

function StatCentroid({ label, value }: { label: string; value: string }) {
  const [lat, lon] = value !== "—" ? value.split(/\s{2,}/) : ["—", ""];
  return (
    <div className="bg-white border border-border rounded-lg p-4 flex flex-col gap-1.5">
      <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
        {label}
      </p>
      <div className="flex flex-col gap-0.5">
        <span className="text-ui-sm font-mono text-t1 leading-snug tabular-nums">
          {lat}
        </span>
        {lon && (
          <span className="text-ui-sm font-mono text-t1 leading-snug tabular-nums">
            {lon}
          </span>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border rounded-lg mb-3 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-[#F8FAFC]">
        <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
          {title}
        </p>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-[3px]">
      <span className="text-ui-sm text-t3">{label}</span>
      <span
        className={`text-ui-sm text-t1 ${mono ? "font-mono break-all text-right max-w-[60%]" : "tabular-nums"}`}
      >
        {value}
      </span>
    </div>
  );
}
