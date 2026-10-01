import type { Field } from "@/api/client";

export function FieldPopupCard({ field }: { field: Field }) {
  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        padding: "10px 12px",
        minWidth: 160,
        maxWidth: 210,
        borderTop: "3px solid #16A34A",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
          {field.name}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.06em",
            color: "#94A3B8",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          field
        </span>
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#15803D",
          lineHeight: 1,
          marginBottom: 2,
        }}
      >
        {(field.area_ha ?? 0).toFixed(2)}
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "#64748B",
            marginLeft: 3,
          }}
        >
          ha
        </span>
      </div>
      {field.notes && (
        <div
          style={{
            fontSize: 10,
            color: "#94A3B8",
            marginTop: 6,
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {field.notes}
        </div>
      )}
    </div>
  );
}
