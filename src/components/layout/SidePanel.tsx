import { useChat } from "@ai-sdk/react";
import { PanelRight, X } from "lucide-react";
import { ResizablePane } from "@/components/ui/ResizablePane";
import { useRouterState } from "@tanstack/react-router";
import {
  CONTEXT_TABS,
  useSidePanel,
  type SidePanelTab,
} from "@/stores/sidePanel";
import { RobotTab, MissionsTab, FieldsTab } from "@/features/fleet/FleetTabs";
import { pendingApprovalsOf } from "@/features/chat/approvals";
import { chatSession } from "@/features/chat/session";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { AgentsPanel } from "@/features/agents/AgentsPanel";

/**
 * Everything the AI side of the system has to say, beside whatever the operator is reading.
 *
 * Pushes the page rather than covering it: the thing an approval most often needs checking against
 * is the map or the mission underneath it, and a card judged against a hidden page is judged on its
 * own say-so.
 *
 * Lives in the root layout, so a streaming turn and a pending decision survive navigation instead
 * of unmounting with the page that started them.
 */
export function SidePanel() {
  const { open, tab, toggle, setTab } = useSidePanel();
  // Context tabs describe a selection on the fleet map, so they exist only where that map does.
  const onOverview = useRouterState({
    select: (s) => s.location.pathname === "/",
  });
  const { messages } = useChat({ chat: chatSession() });
  const waiting = messages
    .flatMap(pendingApprovalsOf)
    .filter((approval) => approval.decision === undefined).length;

  // A context tab left selected from the overview would show nothing on another route.
  const effectiveTab =
    !onOverview && CONTEXT_TABS.includes(tab) ? "assistant" : tab;

  if (!open) return <Handle waiting={waiting} onOpen={toggle} />;

  return (
    // Resizable like the fleet panes, and for the same reason: how much room the assistant deserves
    // against the map depends on what the operator is doing, and only they know which.
    <ResizablePane
      paneId="side-panel"
      side="right"
      initial={340}
      min={280}
      max={560}
    >
      <aside
        aria-label="Assistant and agents"
        className="flex h-full flex-col border-l border-border bg-white"
      >
        <div className="flex items-center gap-1 border-b border-border px-2">
          {onOverview && (
            <>
              <Tab id="robot" active={tab} onSelect={setTab}>
                Robot
              </Tab>
              <Tab id="missions" active={tab} onSelect={setTab}>
                Missions
              </Tab>
              <Tab id="fields" active={tab} onSelect={setTab}>
                Fields
              </Tab>
              <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            </>
          )}
          <Tab
            id="assistant"
            active={effectiveTab}
            onSelect={setTab}
            badge={waiting}
          >
            Assistant
          </Tab>
          <Tab id="agents" active={effectiveTab} onSelect={setTab}>
            Agents
          </Tab>
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggle}
            aria-label="Close panel"
            className="rounded p-1 text-t3 transition-colors hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto text-ui-md text-t2">
          <TabBody tab={effectiveTab} />
        </div>
      </aside>
    </ResizablePane>
  );
}

/**
 * The closed panel's edge, and the only thing that says a decision is waiting.
 *
 * Quiet until it is not: a bare strip while nothing needs the operator, a count when something
 * does. A closed panel holding an undecided proposal is otherwise indistinguishable from an
 * assistant that has stopped answering, and only the operator can clear it.
 */
function Handle({ waiting, onOpen }: { waiting: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={
        waiting > 0
          ? `Open assistant, ${waiting} awaiting your decision`
          : "Open assistant"
      }
      title={waiting > 0 ? `${waiting} awaiting your decision` : "Assistant"}
      className="
        flex w-8 shrink-0 flex-col items-center gap-2 border-l border-border bg-white py-3
        text-t3 transition-colors hover:bg-muted hover:text-t1
        focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2
        focus-visible:outline-primary
      "
    >
      <PanelRight className="h-4 w-4" aria-hidden />
      {waiting > 0 && (
        <span
          className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-1 text-ui-xs font-semibold text-[#B91C1C]"
          aria-hidden
        >
          {waiting}
        </span>
      )}
    </button>
  );
}

function TabBody({ tab }: { tab: SidePanelTab }) {
  if (tab === "robot") return <RobotTab />;
  if (tab === "missions") return <MissionsTab />;
  if (tab === "fields") return <FieldsTab />;
  if (tab === "agents") return <AgentsPanel />;
  return <ChatPanel />;
}

function Tab({
  id,
  active,
  onSelect,
  badge = 0,
  children,
}: {
  id: SidePanelTab;
  active: SidePanelTab;
  onSelect: (tab: SidePanelTab) => void;
  badge?: number;
  children: React.ReactNode;
}) {
  const selected = active === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={selected}
      className={`flex items-center gap-1.5 border-b-2 px-2 py-2 text-ui-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
        selected
          ? "border-primary font-medium text-t1"
          : "border-transparent text-t3 hover:text-t1"
      }`}
    >
      {children}
      {/* On the tab as well as the handle: a decision waiting here must stay visible while the
          operator is reading the other tab. */}
      {badge > 0 && (
        <span className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-1 text-ui-xs font-semibold text-[#B91C1C]">
          {badge}
        </span>
      )}
    </button>
  );
}
