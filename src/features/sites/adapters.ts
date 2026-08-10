import type { Mission, Site } from "@/api/client";

export interface SiteViewModel {
  id: string;
  name: string;
  description: string | null;
  anchorLat: number;
  anchorLon: number;
  anchorHeadingDeg: number;
  nav2MapRef: string;
  outline: Site["outline"];
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Mirror the backend's referenced_site_ids: recurse into on_cancel cleanup
// stages so a site referenced only inside a cleanup branch still counts as used
// (kept consistent with the backend site-in-use guard).
function stagesReferenceSite(
  stages: Mission["stages"],
  siteId: string,
): boolean {
  for (const stage of stages) {
    for (const w of stage.waypoints) {
      if (w.kind === "site_local" && w.site_id === siteId) return true;
    }
    if (stage.on_cancel && stagesReferenceSite(stage.on_cancel, siteId)) {
      return true;
    }
  }
  return false;
}

function missionUsesSite(mission: Mission, siteId: string): boolean {
  return stagesReferenceSite(mission.stages, siteId);
}

export function toSiteViewModel(
  site: Site,
  missions: Mission[],
): SiteViewModel {
  let usageCount = 0;
  let lastUsedAt: string | null = null;
  for (const m of missions) {
    if (!missionUsesSite(m, site.site_id)) continue;
    usageCount++;
    if (!lastUsedAt || Date.parse(m.updated_at) > Date.parse(lastUsedAt)) {
      lastUsedAt = m.updated_at;
    }
  }
  return {
    id: site.site_id,
    name: site.name,
    description: site.description ?? null,
    anchorLat: site.anchor_lat,
    anchorLon: site.anchor_lon,
    anchorHeadingDeg: site.anchor_heading_deg,
    nav2MapRef: site.nav2_map_ref,
    outline: site.outline ?? null,
    usageCount,
    lastUsedAt,
    createdAt: site.created_at,
    updatedAt: site.updated_at,
  };
}

export function missionsUsingSite(
  siteId: string,
  missions: Mission[],
): Mission[] {
  return missions.filter((m) => missionUsesSite(m, siteId));
}
