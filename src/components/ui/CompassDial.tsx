import { useRef, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

interface CompassDialProps {
  heading: number;
  size?: number;
  // When provided, the dial becomes draggable: dragging the arrow rotates
  // heading. Emits the new bearing in [-180, 180].
  onChange?: (deg: number) => void;
  className?: string;
}

function normalizeBearing(deg: number): number {
  // Map any number to [-180, 180].
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

function bearingFromPointer(
  e: PointerEvent<SVGElement> | globalThis.PointerEvent,
  rect: DOMRect,
): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;
  // Heading 0° = north (screen -y). Clockwise positive.
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return normalizeBearing(deg);
}

export function CompassDial({
  heading,
  size = 88,
  onChange,
  className,
}: CompassDialProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;

  const ticks = [0, 90, 180, 270].map((deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return {
      deg,
      x1: cx + Math.cos(rad) * (r - 2),
      y1: cy + Math.sin(rad) * (r - 2),
      x2: cx + Math.cos(rad) * (r - 8),
      y2: cy + Math.sin(rad) * (r - 8),
    };
  });

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    if (!onChange || !svgRef.current) return;
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    onChange(bearingFromPointer(e, rect));

    function onMove(ev: globalThis.PointerEvent) {
      onChange!(bearingFromPointer(ev, rect));
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0", onChange && "cursor-grab", className)}
      onPointerDown={onChange ? handlePointerDown : undefined}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#fff"
        stroke="#E2E8F0"
        strokeWidth="1.5"
      />
      {ticks.map((t) => (
        <line
          key={t.deg}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="#94A3B8"
          strokeWidth="1.5"
        />
      ))}
      <text
        x={cx}
        y={11}
        textAnchor="middle"
        fontFamily="DM Mono, monospace"
        fontSize="9"
        fontWeight="600"
        fill="#475569"
      >
        N
      </text>
      <text
        x={size - 6}
        y={cy + 3}
        textAnchor="middle"
        fontFamily="DM Mono, monospace"
        fontSize="9"
        fill="#94A3B8"
      >
        E
      </text>
      <text
        x={cx}
        y={size - 4}
        textAnchor="middle"
        fontFamily="DM Mono, monospace"
        fontSize="9"
        fill="#94A3B8"
      >
        S
      </text>
      <text
        x={6}
        y={cy + 3}
        textAnchor="middle"
        fontFamily="DM Mono, monospace"
        fontSize="9"
        fill="#94A3B8"
      >
        W
      </text>
      <g transform={`rotate(${heading} ${cx} ${cy})`}>
        <path
          d={`M ${cx} ${cy - r + 6} L ${cx - 5} ${cy + 4} L ${cx} ${cy + 1} L ${cx + 5} ${cy + 4} Z`}
          fill="#16A34A"
        />
        <circle cx={cx} cy={cy} r="2.5" fill="#0F172A" />
      </g>
    </svg>
  );
}
