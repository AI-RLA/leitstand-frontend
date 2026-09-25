# Map configuration

## Overview

Every map in the frontend draws the application's data on top of a basemap, the background map
such as a street map or aerial imagery. Operators switch between the available basemaps with
the layer button in the top right corner of each map.

The available basemaps are defined in `/config/map.json`, which the browser loads at runtime. The
image ships [`public/config/map.json`](../public/config/map.json) with two entries, OpenStreetMap
and the aerial imagery of Lower Saxony published by its surveying authority LGLN. Together they
illustrate both source types, `tiles` and `wms`. Changes to this shipped file take effect only after
a rebuild. A deployment instead mounts its own configuration, which takes effect without rebuilding
the image (see [Deployment](#deployment)).

## Deployment

| Environment        | Configuration                                                                                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker             | Mount a directory containing `map.json` at `/usr/share/nginx/html/config`, as shown in the commented `volumes` entry of `docker-compose.yaml`. A directory is mounted rather than the file, so that changes take effect on the next page load. |
| Development server | Set `LEITSTAND_MAP_CONFIG_FILE` to the path of the file, for example `LEITSTAND_MAP_CONFIG_FILE=map.local.json npm run dev`. If the variable is unset, `public/config/map.json` is served.                                                     |

Local configuration files (`*.local.json` and the `config.local` directory) are excluded from
version control.

## Schema

The document has the form `{ "version": 1, "home": { ... }, "basemaps": [ ... ] }`. Each entry
of `basemaps` supports the following fields.

| Field                | Required       | Default | Description                                                                                                                                                 |
| -------------------- | -------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | yes            |         | Unique identifier, restricted to `a-z`, `0-9`, `_` and `-`. The selected basemap is stored per browser by this identifier.                                  |
| `role`               | yes            |         | Category such as `streets` or `aerial`. If a stored identifier no longer exists, the picker selects an entry of the same role.                              |
| `label`              | yes            |         | Name displayed in the picker.                                                                                                                               |
| `details`            | no             |         | Additional text displayed as a tooltip.                                                                                                                     |
| `source.type`        | yes            |         | Must be `raster`.                                                                                                                                           |
| `source.tiles`       | one of the two |         | List of XYZ tile URLs containing `{z}`, `{x}` and `{y}`.                                                                                                    |
| `source.wms`         | one of the two |         | Web Map Service (WMS) with `url`, `layers` and optional `format` (default `image/png`). Tiles are requested in Web Mercator.                                |
| `source.tileSize`    | no             | `256`   | Tile size in pixels, `256` or `512`. For a WMS, `512` reduces the number of requests by a factor of four.                                                   |
| `source.minzoom`     | no             | `0`     | Lowest zoom level served.                                                                                                                                   |
| `source.maxzoom`     | yes            |         | Highest zoom level served. Beyond it, the map scales the tiles of this level.                                                                               |
| `source.bounds`      | no             |         | Extent as `[west, south, east, north]`. No tiles are requested outside it, and the picker marks the entry as unavailable while the map center lies outside. |
| `source.scheme`      | no             | `xyz`   | Tile numbering, `xyz` or `tms`.                                                                                                                             |
| `source.attribution` | yes            |         | Attribution required by the licence, displayed in full while the basemap is active.                                                                         |

## Opening view

A map without its own content to show opens on the first of the following that exists: the view
last left on the fleet or fields map in this browser tab, the robots that report a position
(online robots first), the fields, the site anchors, `home`, and otherwise all of Germany. The
optional top-level `home` is `{ "center": [longitude, latitude], "zoom": 17 }`, typically the
deployment's farm. The shipped file defines none. A page whose own content is still loading, such as
a mission or a field, waits for it and opens directly on it instead.

## Validation

Unknown fields and duplicate identifiers are rejected, so that a misspelt field such as `maxZoom`
is reported rather than ignored. Invalid entries are omitted. The picker reports the first error,
and the browser console lists all of them.

The file is trusted configuration. It determines which servers the browser of every operator
contacts, and its attributions may contain links and images.

## Licensing

OpenStreetMap data is licensed under the Open Database License (ODbL). The
[Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) of the OpenStreetMap
Foundation requires visible attribution and permits blocking heavy use of the public tile servers
without notice. Deployments with many operators should therefore use their own or a commercial
tile service for the `osm` entry.

The LGLN aerial imagery is licensed under Creative Commons Attribution 4.0 (CC BY 4.0). It
requires the attribution "LGLN (year of retrieval)" together with the licence name.

## Performance

A WMS renders every tile on request. The LGLN service responds in one to three seconds per tile
and prohibits browser caching. A caching tile proxy such as [MapProxy](https://mapproxy.org/)
serves repeated requests from disk within milliseconds. It is then configured as a regular `tiles`
entry.
