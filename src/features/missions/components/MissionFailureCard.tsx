import { AlertTriangle } from "lucide-react";
import type { MissionError } from "@/api/client";

export function MissionFailureCard({ errors }: { errors: MissionError[] }) {
  return (
    <section className="mb-5 rounded-lg border border-[#FECACA] bg-[#FEF2F2]">
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <AlertTriangle className="h-4 w-4 text-[#DC2626]" aria-hidden />
        <h3 className="text-ui-sm font-semibold text-[#991B1B]">
          Failure details
        </h3>
      </header>
      <ul className="divide-y divide-[#FECACA]">
        {errors.map((e, i) => (
          <li key={i} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui-xs text-t3">
              <span className={severityClass(e.severity)}>{e.severity}</span>
              <span aria-hidden>·</span>
              <span>{originLabel(e.origin)}</span>
              <span aria-hidden>·</span>
              <span className="font-mono">{e.type}</span>
            </div>
            <p className="mt-1.5 text-ui-sm text-t1">{e.description}</p>
            {(e.references ?? [])
              .filter((r) => r.key !== "stage_id")
              .map((r, ri) => (
                <p key={ri} className="mt-1 font-mono text-ui-xs text-t3">
                  {r.key}: {r.value}
                </p>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function severityClass(severity: MissionError["severity"]): string {
  const tone = severity === "FATAL" ? "text-[#B91C1C]" : "text-[#B45309]";
  return `font-semibold uppercase tracking-wide ${tone}`;
}

function originLabel(origin: MissionError["origin"]): string {
  return origin === "robot" ? "Reported by robot" : "Detected by server";
}
