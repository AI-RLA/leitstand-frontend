import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSite, useUpdateSite, useDeleteSite } from "@/api/sites";
import { useMissions } from "@/api/missions";
import { CompassDial } from "@/components/ui/CompassDial";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { toSiteViewModel } from "./adapters";
import { SiteMiniMap } from "./components/SiteMiniMap";
import { SiteUsagePanel } from "./components/SiteUsagePanel";
import { MapErrorBoundary } from "@/components/map/MapErrorBoundary";

interface Props {
  id: string;
}

export function SiteDetail({ id }: Props) {
  const navigate = useNavigate();
  const { data: site, isLoading, isError } = useSite(id);
  const { data: missions = [] } = useMissions();
  const update = useUpdateSite(id);
  const remove = useDeleteSite();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLon, setEditLon] = useState("");
  const [editHeading, setEditHeading] = useState("");
  const [editMapRef, setEditMapRef] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmDel) return;
    const t = setTimeout(() => setConfirmDel(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDel]);

  function startEdit() {
    if (!site) return;
    setEditName(site.name);
    setEditLat(String(site.anchor_lat));
    setEditLon(String(site.anchor_lon));
    setEditHeading(String(site.anchor_heading_deg));
    setEditMapRef(site.nav2_map_ref);
    setEditDesc(site.description ?? "");
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const lat = parseFloat(editLat);
    const lon = parseFloat(editLon);
    const heading = parseFloat(editHeading);
    // Guard against NaN / out-of-range reaching the wire: JSON.stringify turns
    // NaN into null, which PATCH treats as "no change", so a fat-fingered edit
    // would silently no-op instead of erroring.
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      !Number.isFinite(heading) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setFormError(
        "Enter a valid latitude (-90..90), longitude (-180..180), and heading.",
      );
      return;
    }
    setFormError(null);
    await update.mutateAsync({
      name: editName.trim(),
      anchor_lat: lat,
      anchor_lon: lon,
      anchor_heading_deg: heading,
      nav2_map_ref: editMapRef.trim(),
      description: editDesc.trim() || null,
    });
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    try {
      await remove.mutateAsync(id);
      navigate({ to: "/sites" });
    } finally {
      setConfirmDel(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-t3">Loading…</span>
      </div>
    );
  }
  if (isError || !site) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-ui-md text-red-500">Site not found.</span>
      </div>
    );
  }

  const vm = toSiteViewModel(site, missions);

  return (
    <div className="p-6 max-w-2xl">
      {editing ? (
        <form onSubmit={handleSave} className="mb-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
              Name
            </span>
            <Input
              autoFocus
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                Anchor lat
              </span>
              <Input
                mono
                required
                type="number"
                step="any"
                min={-90}
                max={90}
                value={editLat}
                onChange={(e) => setEditLat(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                Anchor lon
              </span>
              <Input
                mono
                required
                type="number"
                step="any"
                min={-180}
                max={180}
                value={editLon}
                onChange={(e) => setEditLon(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
                Heading °
              </span>
              <Input
                mono
                required
                type="number"
                step="any"
                min={-180}
                max={180}
                value={editHeading}
                onChange={(e) => setEditHeading(e.target.value)}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
              Nav2 map ref
            </span>
            <Input
              mono
              required
              value={editMapRef}
              onChange={(e) => setEditMapRef(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-ui-xs uppercase tracking-wider font-semibold text-t3">
              Description{" "}
              <span className="normal-case font-normal tracking-normal">
                (optional)
              </span>
            </span>
            <Textarea
              rows={2}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
          </label>
          {formError && (
            <p className="text-ui-sm text-[#DC2626]">{formError}</p>
          )}
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
        <>
          <div className="flex items-start justify-between mb-5">
            <h2 className="text-ui-xl font-semibold text-t1">{vm.name}</h2>
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

          {/* Anchor block: compass + coords */}
          <div className="bg-white border border-border rounded-lg p-4 mb-3 flex items-center gap-5">
            <CompassDial heading={vm.anchorHeadingDeg} size={72} />
            <div className="flex flex-col gap-1">
              <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
                Heading
              </p>
              <p className="text-ui-2xl font-bold tabular-nums leading-none text-t1">
                {vm.anchorHeadingDeg}°
              </p>
            </div>
            <div className="border-l border-border h-12 mx-1" />
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-3">
              <Stat label="Anchor lat" value={vm.anchorLat.toFixed(6)} mono />
              <Stat label="Anchor lon" value={vm.anchorLon.toFixed(6)} mono />
            </div>
          </div>

          {/* Mini-map */}
          <MapErrorBoundary>
            <SiteMiniMap vm={vm} />
          </MapErrorBoundary>

          {/* Details */}
          <div className="bg-white border border-border rounded-lg mb-3 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
                Details
              </p>
            </div>
            <div className="px-4 py-3">
              <Row label="Nav2 map ref" value={vm.nav2MapRef} mono />
              {vm.description && (
                <Row label="Description" value={vm.description} />
              )}
              <Row
                label="Created"
                value={new Date(vm.createdAt).toLocaleString()}
              />
              <Row
                label="Updated"
                value={new Date(vm.updatedAt).toLocaleString()}
              />
              <Row label="ID" value={vm.id} mono />
            </div>
          </div>

          {/* Usage */}
          <SiteUsagePanel siteId={vm.id} />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
        {label}
      </p>
      <p
        className={`text-ui-sm font-medium text-t1 truncate ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
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
        className={`text-ui-sm text-t1 ${mono ? "font-mono break-all text-right max-w-[60%]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
