import { create } from "zustand";
import type { Battery, Pose, RobotStateData } from "@/api/client";

export type RobotEntry = {
  id: string;
  online: boolean;
  pose: Pose | null;
  battery: Battery | null;
  state: RobotStateData | null;
};

export type RightRailTab = "robot" | "ai" | "missions" | "fields" | "alerts";

type Store = {
  robots: Record<string, RobotEntry>;
  selectedId: string | null;
  selectedFieldId: string | null;
  flyToRequest: { robotId: string; nonce: number } | null;
  activeTab: RightRailTab;
  wsConnected: boolean;
  backendVersion: string | null;
  setOnline: (id: string, online: boolean) => void;
  setPose: (id: string, pose: Pose) => void;
  setBattery: (id: string, battery: Battery) => void;
  setState: (id: string, state: RobotStateData) => void;
  select: (id: string | null) => void;
  selectField: (id: string | null) => void;
  flyTo: (robotId: string) => void;
  setActiveTab: (tab: RightRailTab) => void;
  setWsConnected: (connected: boolean) => void;
  setBackendVersion: (version: string | null) => void;
};

const TAB_KEY = "leitstand.activeTab";
const VALID_TABS: RightRailTab[] = [
  "robot",
  "ai",
  "missions",
  "fields",
  "alerts",
];

function loadTab(): RightRailTab {
  try {
    const v = sessionStorage.getItem(TAB_KEY);
    if (v && (VALID_TABS as string[]).includes(v)) return v as RightRailTab;
  } catch {
    // sessionStorage may be unavailable (private browsing, quota)
  }
  return "missions";
}

function saveTab(tab: RightRailTab) {
  try {
    sessionStorage.setItem(TAB_KEY, tab);
  } catch {
    // sessionStorage may be unavailable (private browsing, quota)
  }
}

const ensure = (entries: Record<string, RobotEntry>, id: string) => {
  if (!entries[id]) {
    entries[id] = { id, online: false, pose: null, battery: null, state: null };
  }
  return entries[id];
};

export const useFleet = create<Store>((set) => ({
  robots: {},
  selectedId: null,
  selectedFieldId: null,
  flyToRequest: null,
  activeTab: loadTab(),
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
  setState: (id, state) =>
    set((s) => {
      const r = { ...s.robots };
      ensure(r, id).state = state;
      return { robots: r };
    }),
  select: (id) => {
    const tab = id ? ("robot" as RightRailTab) : undefined;
    if (tab) saveTab(tab);
    return set({
      selectedId: id,
      selectedFieldId: null,
      ...(tab ? { activeTab: tab } : {}),
    });
  },
  flyTo: (robotId) => set({ flyToRequest: { robotId, nonce: Date.now() } }),
  selectField: (id) => {
    const tab = id ? ("fields" as RightRailTab) : undefined;
    if (tab) saveTab(tab);
    return set({
      selectedFieldId: id,
      selectedId: null,
      ...(tab ? { activeTab: tab } : {}),
    });
  },
  setActiveTab: (tab) => {
    saveTab(tab);
    return set({ activeTab: tab });
  },
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setBackendVersion: (version) => set({ backendVersion: version }),
}));
