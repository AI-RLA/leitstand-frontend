import { useMemo } from "react";
import { Layer, Source } from "@vis.gl/react-maplibre";
import type {
  ExpressionSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  MapLayerMouseEvent,
} from "maplibre-gl";
import type { Field } from "@/api/client";
import { toFieldGeoJSON } from "./fieldUtils";
import { useFeatureFlag, useLayerInteraction } from "./mapInteraction";

const SOURCE_ID = "fields";
const FILL_ID = "fields-fill";
const OUTLINE_ID = "fields-outline";

const SELECTED: ExpressionSpecification = [
  "boolean",
  ["feature-state", "selected"],
  false,
];
const FILL_PAINT: FillLayerSpecification["paint"] = {
  "fill-color": "#16A34A",
  "fill-opacity": ["case", SELECTED, 0.22, 0.1],
};
const OUTLINE_PAINT: LineLayerSpecification["paint"] = {
  "line-color": "#16A34A",
  "line-width": ["case", SELECTED, 2.5, 1.5],
  "line-opacity": ["case", SELECTED, 1, 0.6],
};

interface Props {
  fields: Field[];
  selectedId?: string | null;
  onClick?: (field: Field, e: MapLayerMouseEvent) => void;
}

export function FieldsLayer({ fields, selectedId = null, onClick }: Props) {
  const data = useMemo(() => toFieldGeoJSON(fields), [fields]);
  useFeatureFlag(SOURCE_ID, selectedId, "selected");

  useLayerInteraction(
    FILL_ID,
    onClick &&
      ((e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        const field = fields.find((f) => f.id === id);
        if (field) onClick(field, e);
      }),
  );

  return (
    <Source id={SOURCE_ID} type="geojson" data={data} promoteId="id">
      <Layer id={FILL_ID} type="fill" paint={FILL_PAINT} />
      <Layer id={OUTLINE_ID} type="line" paint={OUTLINE_PAINT} />
    </Source>
  );
}
