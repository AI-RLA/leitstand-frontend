import { Metric } from "@/components/ui/Metric";
import { durationFromMs } from "@/lib/relativeTime";
import { useNowTick } from "@/lib/useNowTick";
import type { MissionViewModel } from "../adapters";

interface MissionProgressHeroProps {
  vm: MissionViewModel;
}

export function MissionProgressHero({ vm }: MissionProgressHeroProps) {
  const overallText =
    vm.overallProgress !== null
      ? `${Math.round(vm.overallProgress * 100)}%`
      : "—";
  const stageText =
    vm.currentStageIndex !== null
      ? `${vm.currentStageIndex + 1} / ${vm.stageCount}`
      : `— / ${vm.stageCount}`;
  // Tick the elapsed clock live (1s) while the mission is active, instead of
  // only advancing on the 10s REST poll / WS frames.
  const ticking = vm.bucket === "running" && vm.dispatchedAt !== null;
  const now = useNowTick(1000, ticking);
  const elapsedMs = vm.dispatchedAt ? now - Date.parse(vm.dispatchedAt) : null;
  const elapsedText = durationFromMs(elapsedMs);

  return (
    <div className="bg-white border border-border rounded-lg p-4 mb-5">
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Metric label="Overall" value={overallText} accent="primary" />
        <Metric label="Stage" value={stageText} />
        <Metric label="Elapsed" value={elapsedText} />
      </div>
      <div className="h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(vm.overallProgress ?? 0) * 100}%` }}
        />
      </div>
    </div>
  );
}
