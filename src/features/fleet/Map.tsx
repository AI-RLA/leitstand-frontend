import { useEffect, useRef, useState } from "react";
import { Popup, useMap, type MapLayerMouseEvent } from "@vis.gl/react-maplibre";
import { useFleet } from "@/stores/fleet";
import { NO_FIELDS, useFields } from "@/api/fields";
import type { Field } from "@/api/client";
import { LeitstandMap } from "@/components/map/LeitstandMap";
import { FieldsLayer } from "@/components/map/FieldsLayer";
import { FitBounds } from "@/components/map/FitBounds";
import { useFieldBounds } from "@/components/map/useFieldBounds";
import { RobotsLayer } from "./RobotsLayer";
import { FieldPopupCard } from "./FieldPopupCard";

type FieldPopupAt = { fieldId: string; lngLat: [number, number] };

function FlyToRobot() {
  const map = useMap().current;
  const flyToRequest = useFleet((s) => s.flyToRequest);

  useEffect(() => {
    if (!map || !flyToRequest) return;
    const robot = useFleet.getState().robots[flyToRequest.robotId];
    if (!robot?.pose) return;
    map.flyTo({ center: [robot.pose.lon, robot.pose.lat], speed: 1.5 });
  }, [map, flyToRequest]);

  return null;
}

export function FleetMap() {
  const { data: fields = NO_FIELDS } = useFields();
  const selectedFieldId = useFleet((s) => s.selectedFieldId);
  const selectedRobotId = useFleet((s) => s.selectedId);
  const [popup, setPopup] = useState<FieldPopupAt | null>(null);

  const bounds = useFieldBounds(fields, selectedFieldId);

  // A popup belongs to one selection, so it goes as soon as the selection changes elsewhere (the sidebar, a robot).
  if (popup && popup.fieldId !== selectedFieldId) setPopup(null);
  const popupField = popup && fields.find((f) => f.id === popup.fieldId);

  // Leaving the page with a popup open clears its field, so the selection lives only as long as the popup.
  const popupOpen = useRef(false);
  useEffect(() => {
    popupOpen.current = Boolean(popupField);
  }, [popupField]);
  useEffect(
    () => () => {
      if (popupOpen.current) useFleet.getState().selectField(null);
    },
    [],
  );

  function onFieldClick(field: Field, e: MapLayerMouseEvent) {
    const { selectedFieldId: current, selectField } = useFleet.getState();
    if (current === field.id) {
      selectField(null);
      setPopup(null);
    } else {
      selectField(field.id);
      setPopup({ fieldId: field.id, lngLat: [e.lngLat.lng, e.lngLat.lat] });
    }
  }

  function toggleRobot(id: string) {
    const { selectedId, select } = useFleet.getState();
    select(selectedId === id ? null : id);
  }

  // A click outside all fields closes an open popup and clears its selection.
  function onMapClick(e: MapLayerMouseEvent) {
    if (e.features?.length || !popupField) return;
    setPopup(null);
    useFleet.getState().selectField(null);
  }

  return (
    <LeitstandMap view="remembered" onClick={onMapClick}>
      <FieldsLayer
        fields={fields}
        selectedId={selectedFieldId}
        onClick={onFieldClick}
      />
      <FitBounds bounds={bounds} fitKey={selectedFieldId} />
      <RobotsLayer highlightId={selectedRobotId} onRobotClick={toggleRobot} />
      <FlyToRobot />
      {popup && popupField && (
        <Popup
          longitude={popup.lngLat[0]}
          latitude={popup.lngLat[1]}
          closeButton={false}
          closeOnClick={false}
          offset={4}
          maxWidth="220px"
        >
          <FieldPopupCard field={popupField} />
        </Popup>
      )}
    </LeitstandMap>
  );
}
