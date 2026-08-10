import { authHeaders } from "./auth";
import type { components } from "./generated";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * Human-readable message from any thrown API error. Extracts the backend's
 * `detail` (a string, or the `{message, ...}` object used by richer errors like
 * SiteInUse), falling back to the raw body / generic text.
 */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    try {
      const detail = (JSON.parse(error.body) as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (
        detail &&
        typeof detail === "object" &&
        typeof (detail as { message?: unknown }).message === "string"
      ) {
        return (detail as { message: string }).message;
      }
    } catch {
      // body was not JSON; fall through
    }
    return error.body || `Request failed (${error.status})`;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Re-exports of generated schema types under names the rest of the frontend uses.
export type Pose = components["schemas"]["Pose"];
export type Battery = components["schemas"]["Battery"];
export type RobotStatus = components["schemas"]["RobotStatus"];
export type Robot = components["schemas"]["RobotView"];
export type Operator = components["schemas"]["User"];
export type Field = components["schemas"]["FieldView"];
export type FieldCreate = components["schemas"]["FieldCreate"];
export type FieldUpdate = components["schemas"]["FieldUpdate"];
export type Mission = components["schemas"]["MissionView"];
export type MissionCreate = components["schemas"]["MissionCreate"];
export type MissionUpdate = components["schemas"]["MissionUpdate"];
export type MissionStatus = components["schemas"]["MissionStatus"];
export type MissionState = components["schemas"]["MissionStateView"];
export type StageStateView = components["schemas"]["StageStateView"];
export type StageStatus = components["schemas"]["StageStatus"];
export type MissionError = components["schemas"]["MissionError"];
export type NavigationStageInput =
  components["schemas"]["NavigationStageInput"];
export type SiteLocalWaypoint = components["schemas"]["SiteLocalWaypoint"];
export type Site = components["schemas"]["SiteView"];
export type SiteCreate = components["schemas"]["SiteCreate"];
export type SiteUpdate = components["schemas"]["SiteUpdate"];

export const api = {
  listRobots: () => request<Robot[]>("/robots"),
  getRobot: (id: string) => request<Robot>(`/robots/${encodeURIComponent(id)}`),
  me: () => request<Operator>("/users/me"),

  listFields: () => request<Field[]>("/fields/"),
  getField: (id: string) => request<Field>(`/fields/${encodeURIComponent(id)}`),
  createField: (body: FieldCreate) =>
    request<Field>("/fields/", { method: "POST", body: JSON.stringify(body) }),
  updateField: (id: string, body: FieldUpdate) =>
    request<Field>(`/fields/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteField: (id: string) =>
    request<void>(`/fields/${encodeURIComponent(id)}`, { method: "DELETE" }),

  listMissions: () => request<Mission[]>("/missions/"),
  getMission: (id: string) =>
    request<Mission>(`/missions/${encodeURIComponent(id)}`),
  getMissionState: (id: string) =>
    request<MissionState>(`/missions/${encodeURIComponent(id)}/state`),
  createMission: (body: MissionCreate) =>
    request<Mission>("/missions/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateMission: (id: string, body: MissionUpdate) =>
    request<Mission>(`/missions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  assignMission: (id: string, robotId: string) =>
    request<Mission>(`/missions/${encodeURIComponent(id)}/assign`, {
      method: "POST",
      body: JSON.stringify({ robot_id: robotId }),
    }),
  unassignMission: (id: string) =>
    request<Mission>(`/missions/${encodeURIComponent(id)}/unassign`, {
      method: "POST",
    }),
  dispatchMission: (id: string) =>
    request<Mission>(`/missions/${encodeURIComponent(id)}/dispatch`, {
      method: "POST",
    }),
  deleteMission: (id: string) =>
    request<void>(`/missions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  cancelMission: (id: string) =>
    request<Mission>(`/missions/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    }),
  pauseMission: (id: string) =>
    request<Mission>(`/missions/${encodeURIComponent(id)}/pause`, {
      method: "POST",
    }),
  resumeMission: (id: string) =>
    request<Mission>(`/missions/${encodeURIComponent(id)}/resume`, {
      method: "POST",
    }),
  resetMission: (id: string) =>
    request<Mission>(`/missions/${encodeURIComponent(id)}/reset`, {
      method: "POST",
    }),

  listSites: () => request<Site[]>("/sites/"),
  getSite: (id: string) => request<Site>(`/sites/${encodeURIComponent(id)}`),
  createSite: (body: SiteCreate) =>
    request<Site>("/sites/", { method: "POST", body: JSON.stringify(body) }),
  updateSite: (id: string, body: SiteUpdate) =>
    request<Site>(`/sites/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteSite: (id: string) =>
    request<void>(`/sites/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
