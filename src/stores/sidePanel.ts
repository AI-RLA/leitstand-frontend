import { create } from "zustand";

// sessionStorage, matching the conversation the panel mostly holds: a tab is one operator session,
// so the panel opens the way that tab left it rather than the way another window did.
const OPEN_KEY = "leitstand.sidePanel.open";
const TAB_KEY = "leitstand.sidePanel.tab";

export type SidePanelTab =
  | "robot"
  | "missions"
  | "fields"
  | "assistant"
  | "agents";

/** Tabs that describe a map selection, so they only exist on the fleet overview. */
export const CONTEXT_TABS: SidePanelTab[] = ["robot", "missions", "fields"];

const VALID_TABS: SidePanelTab[] = [
  "robot",
  "missions",
  "fields",
  "assistant",
  "agents",
];

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    // sessionStorage may be unavailable (private browsing, quota)
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // See read. Remembering the panel is a convenience; it must never break the layout.
  }
}

function loadTab(): SidePanelTab {
  const v = read(TAB_KEY);
  return v && (VALID_TABS as string[]).includes(v)
    ? (v as SidePanelTab)
    : "assistant";
}

type SidePanelState = {
  open: boolean;
  tab: SidePanelTab;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setTab: (tab: SidePanelTab) => void;
};

export const useSidePanel = create<SidePanelState>((set, get) => ({
  open: read(OPEN_KEY) === "true",
  tab: loadTab(),
  toggle: () => {
    const open = !get().open;
    write(OPEN_KEY, String(open));
    set({ open });
  },
  setOpen: (open: boolean) => {
    write(OPEN_KEY, String(open));
    set({ open });
  },
  setTab: (tab: SidePanelTab) => {
    write(TAB_KEY, tab);
    set({ tab });
  },
}));
