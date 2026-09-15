import { ChevronDown } from "lucide-react";
import { KIND_DESCRIPTION, type StageKind } from "./stageTypes";

const ALL_KINDS: StageKind[] = ["navigation", "coverage"];

interface StageKindSelectProps {
  value: StageKind | "";
  onChange: (k: StageKind) => void;
  autoFocus?: boolean;
}

export function StageKindSelect({
  value,
  onChange,
  autoFocus,
}: StageKindSelectProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value as StageKind);
        }}
        className="appearance-none text-ui-sm pl-2.5 pr-7 py-1 rounded-md bg-white text-t1 border border-border hover:border-t3 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
      >
        <option value="" disabled>
          Choose a stage kind…
        </option>
        {ALL_KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_DESCRIPTION[k]}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-t3 pointer-events-none" />
    </div>
  );
}
