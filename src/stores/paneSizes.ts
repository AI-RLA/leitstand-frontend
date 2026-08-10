const KEY = "leitstand.paneSizes";

type Sizes = Record<string, number>;

let cache: Sizes | null = null;

function load(): Sizes {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const sizes: Sizes = {};
        for (const [k, v] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          if (typeof v === "number" && Number.isFinite(v)) sizes[k] = v;
        }
        cache = sizes;
        return sizes;
      }
    }
  } catch {
    // localStorage may be unavailable (private browsing, quota)
  }
  cache = {};
  return cache;
}

export function loadPaneSize(paneId: string, fallback: number): number {
  const v = load()[paneId];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function savePaneSize(paneId: string, width: number): void {
  const sizes = { ...load(), [paneId]: width };
  cache = sizes;
  try {
    localStorage.setItem(KEY, JSON.stringify(sizes));
  } catch {
    // localStorage may be unavailable
  }
}
