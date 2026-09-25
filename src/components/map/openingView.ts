import type { Field, Pose, Site } from "@/api/client";
import type { MapView } from "@/config/mapConfig";
import { bboxOfPoints, fieldBbox, type LngLatBox } from "./fieldUtils";

export type OpeningView =
  | MapView
  | { bounds: LngLatBox; padding?: number; maxZoom?: number };

// All of Germany, for a deployment that has configured no home and has no data yet.
const GERMANY: MapView = { center: [10.45, 51.16], zoom: 5.5 };

interface OpeningInputs {
  saved: MapView | null;
  /** Each list is undefined while it is still loading. */
  robots: { online: boolean; pose?: Pose | null }[] | undefined;
  fields: Field[] | undefined;
  sites: Site[] | undefined;
  home: MapView | null;
}

/**
 * Pick where a map opens, from the most specific source that has anything to show.
 *
 * Returns null while a list that could still decide it is loading, so a later source never wins
 * only because it arrived first.
 */
export function resolveOpeningView({
  saved,
  robots,
  fields,
  sites,
  home,
}: OpeningInputs): OpeningView | null {
  if (saved) return saved;
  if (!robots) return null;
  const placed = robots.flatMap((r) =>
    r.pose ? [{ online: r.online, at: [r.pose.lon, r.pose.lat] }] : [],
  );
  const online = placed.filter((r) => r.online);
  const robotBox = bboxOfPoints(
    (online.length > 0 ? online : placed).map((r) => r.at),
  );
  if (robotBox) return { bounds: robotBox };
  if (!fields) return null;
  const fieldBox = bboxOfPoints(fields.flatMap((f) => fieldBbox(f.geometry)));
  if (fieldBox) return { bounds: fieldBox };
  if (!sites) return null;
  const siteBox = bboxOfPoints(sites.map((s) => [s.anchor_lon, s.anchor_lat]));
  if (siteBox) return { bounds: siteBox };
  return home ?? GERMANY;
}
