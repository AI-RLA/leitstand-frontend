import { Link } from "@tanstack/react-router";
import type { MissionState } from "@/api/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";
import { relativeTime, durationFromMs } from "@/lib/relativeTime";
import { toMissionViewModel, type MissionViewModel } from "../adapters";
import type { Mission } from "@/api/client";

interface MissionCardProps {
  mission: Mission;
  selected: boolean;
  // Live state is supplied by the list-level subscription (useMissionStates),
  // so the card itself opens no WS subscription.
  live: MissionState | null;
}

export function MissionCard({ mission, selected, live }: MissionCardProps) {
  const vm = toMissionViewModel(mission, live);

  return (
    <Link
      to="/missions/$id"
      params={{ id: vm.id }}
      className={cn(
        "block w-full px-3 py-[10px] border-l-[3px] border-b border-border transition-colors",
        selected
          ? "bg-[#F0FDF4] border-l-primary"
          : "border-l-transparent hover:bg-[#F8FAFC]",
      )}
    >
      <div className="flex items-center gap-2">
        <StatusPill variant="mission" status={vm.status} dotOnly />
        <span className="text-ui-md font-semibold text-t1 flex-1 truncate">
          {vm.name}
        </span>
        {vm.robotId && (
          <span
            className="text-ui-xs text-t3 font-mono truncate min-w-0 max-w-[40%]"
            title={vm.robotId}
          >
            {vm.robotId}
          </span>
        )}
      </div>
      <SecondaryLine vm={vm} />
    </Link>
  );
}

function SecondaryLine({ vm }: { vm: MissionViewModel }) {
  if (vm.status === "RUNNING") {
    const stageNum =
      vm.currentStageIndex !== null ? vm.currentStageIndex + 1 : "?";
    return (
      <div className="ml-[15px] mt-1.5">
        <p className="text-ui-xs text-t3">
          Stage {stageNum}/{vm.stageCount}
          {vm.elapsedMs !== null && (
            <> · started {durationFromMs(vm.elapsedMs)} ago</>
          )}
        </p>
        {vm.overallProgress !== null && (
          <div className="mt-1 h-[3px] bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${vm.overallProgress * 100}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  let text: string;
  if (vm.status === "DISPATCHED") {
    text = vm.robotId ? `Dispatched to ${vm.robotId}` : "Dispatched";
  } else if (vm.status === "PAUSED") {
    const stageNum =
      vm.currentStageIndex !== null ? vm.currentStageIndex + 1 : "?";
    text = `Paused · stage ${stageNum}/${vm.stageCount}`;
  } else if (vm.status === "ASSIGNED") {
    text = vm.robotId ? `Assigned to ${vm.robotId}` : "Assigned";
  } else if (vm.status === "DRAFT") {
    text = `${vm.stageCount} stage${vm.stageCount === 1 ? "" : "s"} · not dispatched`;
  } else if (vm.status === "SUCCEEDED") {
    text = `Succeeded ${relativeTime(vm.updatedAt)}`;
  } else if (vm.status === "FAILED") {
    text = `Failed ${relativeTime(vm.updatedAt)}`;
  } else {
    text = `Cancelled ${relativeTime(vm.updatedAt)}`;
  }

  return <p className="ml-[15px] mt-1 text-ui-xs text-t3 truncate">{text}</p>;
}
