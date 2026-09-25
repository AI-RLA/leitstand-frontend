import type { RasterSourceSpecification } from "maplibre-gl";

export type Bounds = [number, number, number, number];

interface WmsSpec {
  url: string;
  layers: string;
  format?: string;
}

export interface BasemapEntry {
  id: string;
  role: string;
  label: string;
  details?: string;
  source: RasterSourceSpecification;
}

export interface MapConfig {
  entries: BasemapEntry[];
  rejected: string[];
}

const MAP_CONFIG_URL = "/config/map.json";
const TIMEOUT_MS = 5000;

const failed = (reason: string): MapConfig => ({
  entries: [],
  rejected: [reason],
});

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isZoom(v: unknown): v is number {
  return isFiniteNumber(v) && v >= 0 && v <= 24;
}

// Ids become layer and source names, and MapLibre refuses a whole style over one clashing name.
const ID_PATTERN = /^[a-z0-9_-]+$/;

const SOURCE_KEYS = new Set([
  "type",
  "tiles",
  "wms",
  "tileSize",
  "minzoom",
  "maxzoom",
  "bounds",
  "scheme",
  "attribution",
]);
const WMS_KEYS = new Set(["url", "layers", "format"]);

// Unknown fields are refused rather than dropped, so a typo shows in the picker.
function unknownKey(o: Record<string, unknown>, known: Set<string>) {
  return Object.keys(o).find((k) => !known.has(k));
}

function wmsTiles(wms: WmsSpec, tileSize: number): string {
  const format = wms.format ?? "image/png";
  return (
    wms.url +
    (wms.url.includes("?") ? "&" : "?") +
    "SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0" +
    `&LAYERS=${encodeURIComponent(wms.layers)}&STYLES=` +
    "&CRS=EPSG:3857&BBOX={bbox-epsg-3857}" +
    `&WIDTH=${tileSize}&HEIGHT=${tileSize}` +
    `&FORMAT=${encodeURIComponent(format)}`
  );
}

function parseBounds(v: unknown): Bounds | string {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(isFiniteNumber)) {
    return "bounds must be four numbers";
  }
  const [w, s, e, n] = v as Bounds;
  if (w >= e || s >= n) return "bounds must be west, south, east, north";
  return v as Bounds;
}

function parseEntry(raw: unknown): BasemapEntry | string {
  if (!isObject(raw)) return "not an object";
  const { id, role, label, details, source } = raw;
  if (!isNonEmptyString(id)) return "id missing";
  if (!ID_PATTERN.test(id)) return "id may only use a-z, 0-9, _ and -";
  if (!isNonEmptyString(role)) return "role missing";
  if (!isNonEmptyString(label)) return "label missing";
  if (details !== undefined && typeof details !== "string") {
    return "details must be text";
  }
  if (!isObject(source) || source.type !== "raster") {
    return 'source.type must be "raster"';
  }
  const extra = unknownKey(source, SOURCE_KEYS);
  if (extra) return `unknown source field ${extra}`;

  const tileSize = source.tileSize ?? 256;
  if (tileSize !== 256 && tileSize !== 512) {
    return "tileSize must be 256 or 512";
  }
  const { minzoom = 0, maxzoom, scheme = "xyz" } = source;
  if (!isZoom(maxzoom)) return "maxzoom must be a number from 0 to 24";
  if (!isZoom(minzoom) || minzoom > maxzoom) {
    return "minzoom must be a number from 0 to maxzoom";
  }
  if (scheme !== "xyz" && scheme !== "tms") {
    return 'scheme must be "xyz" or "tms"';
  }
  if (!isNonEmptyString(source.attribution)) return "attribution missing";

  const hasTiles = source.tiles !== undefined;
  if (hasTiles === (source.wms !== undefined)) {
    return "give exactly one of tiles or wms";
  }
  let tiles: string[];
  if (hasTiles) {
    if (
      !Array.isArray(source.tiles) ||
      source.tiles.length === 0 ||
      !source.tiles.every(isNonEmptyString)
    ) {
      return "tiles must be a list of URLs";
    }
    tiles = source.tiles;
  } else {
    const wms = source.wms;
    if (!isObject(wms)) return "wms needs url and layers";
    const extraWms = unknownKey(wms, WMS_KEYS);
    if (extraWms) return `unknown wms field ${extraWms}`;
    if (
      !isNonEmptyString(wms.url) ||
      !isNonEmptyString(wms.layers) ||
      (wms.format !== undefined && !isNonEmptyString(wms.format))
    ) {
      return "wms needs url and layers";
    }
    tiles = [
      wmsTiles(
        { url: wms.url, layers: wms.layers, format: wms.format },
        tileSize,
      ),
    ];
  }

  let bounds: Bounds | undefined;
  if (source.bounds !== undefined) {
    const parsed = parseBounds(source.bounds);
    if (typeof parsed === "string") return parsed;
    bounds = parsed;
  }

  return {
    id,
    role,
    label,
    details,
    source: {
      type: "raster",
      tiles,
      tileSize,
      minzoom,
      maxzoom,
      scheme,
      attribution: source.attribution,
      ...(bounds && { bounds }),
    },
  };
}

export function parse(json: unknown): MapConfig {
  if (!isObject(json) || json.version !== 1 || !Array.isArray(json.basemaps)) {
    return failed("not a version 1 map.json");
  }
  const entries: BasemapEntry[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  json.basemaps.forEach((raw, i) => {
    const name =
      isObject(raw) && isNonEmptyString(raw.id) ? raw.id : `entry ${i + 1}`;
    const result = seen.has(name) ? "duplicate id" : parseEntry(raw);
    if (typeof result === "string") {
      rejected.push(`${name}: ${result}`);
    } else {
      seen.add(result.id);
      entries.push(result);
    }
  });
  return { entries, rejected };
}

async function load(): Promise<MapConfig> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Fetched with the defaults so the preload in index.html is reused.
    const res = await fetch(MAP_CONFIG_URL, { signal: controller.signal });
    if (!res.ok) return failed(`map.json answered ${res.status}`);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return failed("map.json is not valid JSON");
    }
    return parse(json);
  } catch {
    return failed("map.json could not be loaded");
  } finally {
    clearTimeout(timer);
  }
}

// Created once at startup and never rejected, so every map can read it with use() and no error boundary.
export const mapConfigReady: Promise<MapConfig> = load()
  .then((c) => {
    if (c.rejected.length > 0) console.warn("[map.json]", c.rejected);
    return c;
  })
  .catch(() => failed("map.json could not be loaded"));
