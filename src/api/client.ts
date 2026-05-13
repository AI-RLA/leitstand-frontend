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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Re-exports of generated schema types under names the rest of the
// frontend uses. Renaming RobotState → RobotStateData avoids collision
// with React's "state" terminology in component code.
export type Pose = components["schemas"]["Pose"];
export type Battery = components["schemas"]["Battery"];
export type RobotStateData = components["schemas"]["RobotState"];
export type Robot = components["schemas"]["RobotView"];
export type Operator = components["schemas"]["User"];
export type Field = components["schemas"]["FieldView"];
export type FieldCreate = components["schemas"]["FieldCreate"];
export type FieldUpdate = components["schemas"]["FieldUpdate"];

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
};
