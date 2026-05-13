const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL ??
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const DOP_WMS_TILES = [
  "https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms" +
    "?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0" +
    "&LAYERS=ni_dop20&BBOX={bbox-epsg-3857}" +
    "&WIDTH=256&HEIGHT=256&CRS=EPSG:3857&FORMAT=image/jpeg&STYLES=",
];

export const MAP_SOURCES = {
  osm: {
    type: "raster" as const,
    tiles: [TILE_URL],
    tileSize: 256,
    attribution: "© OpenStreetMap",
  },
  dop: {
    type: "raster" as const,
    tiles: DOP_WMS_TILES,
    tileSize: 256,
    attribution: "© LGLN Niedersachsen",
  },
};

export function baseLayers(initial: "osm" | "dop" = "osm") {
  return [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
      layout: {
        visibility: (initial === "osm" ? "visible" : "none") as
          | "visible"
          | "none",
      },
    },
    {
      id: "dop",
      type: "raster" as const,
      source: "dop",
      layout: {
        visibility: (initial === "dop" ? "visible" : "none") as
          | "visible"
          | "none",
      },
    },
  ];
}
