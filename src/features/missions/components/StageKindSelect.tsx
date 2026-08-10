import { ChevronDown } from "lucide-react";
import { KIND_LABEL, type StageKind } from "./stageTypes";

// All kinds the user can pick from. Today: just "navigation". Add a kind to
// this array (and to `StageKind` in stageTypes.ts) when the backend ships
// another one.
const ALL_KINDS: StageKind[] = ["navigation"];

interface StageKindSelectProps {
  value: StageKind;
  onChange: (k: StageKind) => void;
}

export function StageKindSelect({ value, onChange }: StageKindSelectProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StageKind)}
        className="appearance-none text-ui-xs font-medium uppercase tracking-wider pl-2 pr-6 py-0.5 rounded bg-[#F1F5F9] text-t2 border border-transparent hover:border-border focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
      >
        {ALL_KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 text-t3 pointer-events-none" />
    </div>
  );
}
