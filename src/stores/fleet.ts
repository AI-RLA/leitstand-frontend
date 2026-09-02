import { create } from "zustand";
import { useSidePanel, type SidePanelTab } from "./sidePanel";
import type { Battery, Pose, RobotStatus } from "@/api/client";

export type RobotEntry = {
  id: string;
  online: boolean;
  pose: Pose | null;
  battery: Battery | null;
  status: RobotStatus | null;
};

type Store = {
  robots: Record<string, RobotEntry>;
  selectedId: string | null;
  selectedFieldId: string | null;
  flyToRequest: { robotId: string; nonce: number } | null;
  wsConnected: boolean;
  backendVersion: string | null;
  setOnline: (id: string, online: boolean) => void;
  setPose: (id: string, pose: Pose) => void;
  setBattery: (id: string, battery: Battery) => void;
  setStatus: (id: string, status: RobotStatus) => void;
  select: (id: string | null) => void;
  selectField: (id: string | null) => void;
  flyTo: (robotId: string) => void;
  setWsConnected: (connected: boolean) => void;
  setBackendVersion: (version: string | null) => void;
};

// Neither the assistant nor agent findings are among them: both live in the side panel, on every
// route rather than only this one. A tab persisted from before that move falls through to the
// default below.

const ensure = (entries: Record<string, RobotEntry>, id: string) => {
  if (!entries[id]) {
    entries[id] = {
      id,
      online: false,
      pose: null,
      battery: null,
      status: null,
    };
  }
  return entries[id];
};

/**
 * Show a tab, opening the panel if it is shut.
 *
 * Selecting something on the map has to be visible to mean anything, and a closed panel would
 * swallow it.
 */
function revealTab(tab: SidePanelTab): void {
  const panel = useSidePanel.getState();
  panel.setTab(tab);
  panel.setOpen(true);
}

export const useFleet = create<Store>((set) => ({
  robots: {},
  selectedId: null,
  selectedFieldId: null,
  flyToRequest: null,
  wsConnected: false,
  backendVersion: null,
  setOnline: (id, online) =>
    set((s) => {
      const r = { ...s.robots };
      ensure(r, id).online = online;
      return { robots: r };
    }),
  setPose: (id, pose) =>
    set((s) => {
      const r = { ...s.robots };
      ensure(r, id).pose = pose;
      return { robots: r };
    }),
  setBattery: (id, battery) =>
    set((s) => {
      const r = { ...s.robots };
      ensure(r, id).battery = battery;
      return { robots: r };
    }),
  setStatus: (id, status) =>
    set((s) => {
      const r = { ...s.robots };
      ensure(r, id).status = status;
      return { robots: r };
    }),
  select: (id) => {
    if (id) revealTab("robot");
    return set({ selectedId: id, selectedFieldId: null });
  },
  flyTo: (robotId) => set({ flyToRequest: { robotId, nonce: Date.now() } }),
  selectField: (id) => {
    if (id) revealTab("fields");
    return set({ selectedFieldId: id, selectedId: null });
  },
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setBackendVersion: (version) => set({ backendVersion: version }),
}));
