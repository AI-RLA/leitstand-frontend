// A colon keeps it apart from basemap-<id>, since config ids cannot contain one.
export const BACKGROUND_ID = "basemap:background";
export const BACKGROUND_PAINT = { "background-color": "#e2e8f0" } as const;

export function layerId(entryId: string): string {
  return `basemap-${entryId}`;
}
