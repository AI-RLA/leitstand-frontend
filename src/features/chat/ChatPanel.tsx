import { useChat } from "@ai-sdk/react";
import { isToolUIPart, type UIMessage } from "ai";
import { AlertTriangle } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { ApprovalCard } from "./ApprovalCard";
import { bareToolName, pendingApprovalsOf } from "./approvals";
import { chatSession, startNewChat } from "./session";

// Sized ui-md, not the ui-sm used across the rest of the app: the type scale is tuned for dense
// chrome that gets glanced at, and this is the one surface carrying prose to be read.
const MARKDOWN_COMPONENTS = {
  p: (props: object) => <p className="mt-1.5 text-ui-md text-t1" {...props} />,
  strong: (props: object) => <strong className="font-semibold" {...props} />,
  ul: (props: object) => (
    <ul className="mt-1.5 list-disc pl-4 text-ui-md text-t1" {...props} />
  ),
  ol: (props: object) => (
    <ol className="mt-1.5 list-decimal pl-4 text-ui-md text-t1" {...props} />
  ),
  li: (props: object) => <li className="mt-0.5" {...props} />,
  code: (props: object) => (
    <code
      className="rounded bg-[#F1F5F9] px-1 font-mono text-ui-xs text-t2"
      {...props}
    />
  ),
  a: (props: object) => (
    <a
      className="text-primary-text underline underline-offset-2"
      rel="noreferrer noopener"
      target="_blank"
      {...props}
    />
  ),
  table: (props: object) => (
    <table className="mt-2 w-full text-left text-ui-sm" {...props} />
  ),
  th: (props: object) => (
    <th
      className="border-b border-border pr-3 pb-1 font-medium text-t3"
      {...props}
    />
  ),
  td: (props: object) => (
    <td
      className="border-b border-border py-1 pr-3 align-top text-t1"
      {...props}
    />
  ),
};

// How close to the bottom still counts as following along.
const STICK_THRESHOLD_PX = 48;

type ToolOutcome = "ok" | "denied" | "failed";
type ToolPill = { name: string; outcome: ToolOutcome };

/**
 * The tools this message resolved, and how each turned out.
 *
 * A pending or awaiting-approval call is not shown here (the approval card carries it). Only a
 * settled call becomes a pill, so the colour can tell the truth: a denied or failed action did not
 * produce the answer and must not read as one.
 */
function toolPillsOf(message: UIMessage): ToolPill[] {
  const out: ToolPill[] = [];
  for (const part of message.parts) {
    if (!isToolUIPart(part)) continue;
    let outcome: ToolOutcome | null = null;
    if (part.state === "output-available") outcome = "ok";
    else if (part.state === "output-error") outcome = "failed";
    else if (part.state === "output-denied") outcome = "denied";
    else if (
      part.state === "approval-responded" &&
      part.approval?.approved === false
    )
      outcome = "denied";
    if (outcome) out.push({ name: bareToolName(part), outcome });
  }
  return out;
}

/**
 * Which tools produced this answer, and whether each actually ran.
 *
 * Every answer is derived from a live query, so naming the query separates a trustworthy answer
 * from a plausible one. A successful call is green; a denied or failed one is red, because it
 * changed nothing and the operator should read it that way. Built from the tinted-pill-and-dot
 * device the fleet uses for status, in the monospace face the app reserves for identifiers.
 */
function Provenance({ pills }: { pills: ToolPill[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {pills.map((pill, i) => {
        const red = pill.outcome !== "ok";
        const suffix =
          pill.outcome === "denied"
            ? " · denied"
            : pill.outcome === "failed"
              ? " · failed"
              : "";
        return (
          <span
            key={`${pill.name}-${i}`}
            className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-ui-xs ${
              red
                ? "bg-[#FEF2F2] text-[#B91C1C]"
                : "bg-primary-light text-primary-text"
            }`}
          >
            <span
              className={`h-[5px] w-[5px] rounded-full ${red ? "bg-[#DC2626]" : "bg-primary"}`}
              aria-hidden
            />
            {pill.name}
            {suffix}
          </span>
        );
      })}
    </div>
  );
}

/**
 * One message, re-rendered only when that message itself changes.
 *
 * A streamed answer replaces just the message it is building, so every other message keeps its
 * identity and this skips them. Without that, each delta re-renders the whole transcript and
 * re-parses every earlier answer's markdown, which costs more the longer the conversation gets
 * and makes the rest of the UI stutter while an answer arrives.
 */
const MessageRow = memo(function MessageRow({
  message,
  onDecide,
}: {
  message: UIMessage;
  onDecide: (approvalId: string, approved: boolean) => void;
}) {
  // Reasoning parts are dropped on purpose: this model emits long chains of thought,
  // and an operator wants the answer, not the deliberation behind it.
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
  const pills = toolPillsOf(message);
  const approvals = pendingApprovalsOf(message);
  if (!text && pills.length === 0 && approvals.length === 0) return null;
  const asked = message.role === "user";
  return (
    <div className="border-b border-border px-4 py-3">
      <Eyebrow>{asked ? "You" : "Assistant"}</Eyebrow>
      {pills.length > 0 && <Provenance pills={pills} />}
      {text &&
        (asked ? (
          <p className="mt-1.5 whitespace-pre-wrap text-ui-md text-t2">
            {text}
          </p>
        ) : (
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={MARKDOWN_COMPONENTS}
          >
            {text}
          </Markdown>
        ))}
      {approvals.map((approval) => (
        <ApprovalCard
          key={approval.approvalId}
          approval={approval}
          onDecide={onDecide}
        />
      ))}
    </div>
  );
});

// One render per frame's worth of tokens rather than one per token. The stream arrives far faster
// than a person reads, so coalescing costs nothing visible, and per-token rendering is main-thread
// work that leaves the rest of the UI unresponsive mid-answer.
const RENDER_THROTTLE_MS = 50;

// A cold first turn takes the better part of a minute, and a label that never changes reads as a
// hang, so a wait long enough to be worth naming is counted out.
const WAIT_VISIBLE_S = 3;

function WaitedSeconds() {
  const [waited, setWaited] = useState(0);
  // Mounted only while the turn is waiting, so unmounting is what resets the count.
  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(
      () => setWaited(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);
  if (waited < WAIT_VISIBLE_S) return null;
  return <span className="ml-1 font-mono tabular-nums">{waited}s</span>;
}

export function ChatPanel() {
  const [draft, setDraft] = useState("");
  // The chat lives outside this component, so switching to another tab and back does not take the
  // conversation with it.
  const [chat, setChat] = useState(chatSession);
  const {
    messages,
    sendMessage,
    status,
    error,
    clearError,
    stop,
    regenerate,
    addToolApprovalResponse,
  } = useChat({ chat, throttle: RENDER_THROTTLE_MS });
  const busy = status === "submitted" || status === "streaming";
  const waiting = status === "submitted";
  // An approval can only be answered while its message is the newest one, because the SDK rewrites
  // that message alone. Sending anything else first would leave the card on screen with live
  // buttons that no longer reach the proposal, and the proposal itself awaiting a decision that can
  // never arrive. Holding the composer until the operator decides is what prevents that.
  const awaitingDecision =
    messages.length > 0 &&
    pendingApprovalsOf(messages[messages.length - 1]).some((a) => !a.decision);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Only follow the stream while the reader is already at the bottom. Scrolling on every token
  // regardless would drag them back down the moment they scroll up to re-read an earlier answer.
  const stickToBottom = useRef(true);

  // Stable across renders so a memoised message row is not invalidated by a new function identity
  // on every token.
  const decide = useCallback(
    (approvalId: string, approved: boolean) => {
      // Following the answer to an action the operator just authorised is the expected intent.
      stickToBottom.current = true;
      // Name a denial as a deliberate decision, not a failure: without this the model reads the
      // bare "denied" as a technical fault and starts suggesting workarounds instead of stopping.
      void addToolApprovalResponse({
        id: approvalId,
        approved,
        reason: approved
          ? undefined
          : "The operator denied this action on the approval card.",
      });
    },
    [addToolApprovalResponse],
  );

  function trackScrollPosition() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distanceFromBottom <= STICK_THRESHOLD_PX;
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, status, error]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    // Asking a question is an intent to watch the answer, wherever they had scrolled to.
    stickToBottom.current = true;
    void sendMessage({ text });
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <Eyebrow>Assistant</Eyebrow>
        <button
          type="button"
          onClick={() => {
            setChat(startNewChat());
            stickToBottom.current = true;
          }}
          disabled={busy || messages.length === 0}
          className="rounded-md border border-border px-2.5 py-1 text-ui-sm font-medium text-t2 transition-colors hover:border-border-strong hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
        >
          New chat
        </button>
      </div>

      <p className="border-b border-border px-3 py-1.5 text-ui-xs text-t3">
        Conversations are not stored. Approved actions are recorded in the audit
        log.
      </p>

      <div
        ref={scrollRef}
        onScroll={trackScrollPosition}
        className="flex-1 overflow-y-auto"
      >
        {messages.length === 0 && !error && (
          <EmptyState
            title="Ask about the fleet"
            hint="Answers come from live fleet data, not from memory. Try: which robots are online?"
          />
        )}

        {messages.map((m) => (
          <MessageRow key={m.id} message={m} onDecide={decide} />
        ))}

        {busy && (
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {/* Silent once text is arriving: the answer itself is the better indicator. */}
            {waiting && (
              <span className="text-ui-sm text-t3">
                Working
                <WaitedSeconds />
              </span>
            )}
            {/* Pinned right so the row's one fixed element never moves: the label appears,
                counts up and disappears, and each of those would otherwise shove it. */}
            <button
              type="button"
              onClick={() => stop()}
              className="ml-auto text-ui-sm text-t3 underline underline-offset-2 hover:text-t2"
            >
              Stop
            </button>
          </div>
        )}

        {error && (
          <section className="m-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#DC2626]" aria-hidden />
              <h3 className="text-ui-sm font-semibold text-[#991B1B]">
                Assistant unavailable
              </h3>
            </div>
            <p className="mt-1.5 text-ui-sm text-t1">
              Fleet control is unaffected: robots, missions and dispatch all
              continue to work.
            </p>
            <p className="mt-1 font-mono text-ui-xs text-t3">{error.message}</p>
            {/* A failed turn is otherwise orphaned: the question stays on screen with no answer
                and no way to ask it again except retyping it. */}
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  stickToBottom.current = true;
                  void regenerate();
                }}
                className="text-ui-xs font-medium text-t2 underline underline-offset-2 disabled:opacity-40"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => clearError()}
                className="text-ui-xs font-medium text-t2 underline underline-offset-2"
              >
                Dismiss
              </button>
            </div>
          </section>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={awaitingDecision}
          placeholder={
            awaitingDecision
              ? "Approve or deny the proposed action first"
              : "Ask about the fleet"
          }
          aria-label="Ask about the fleet"
          className="flex-1"
        />
        {/* Names the action, not today's capability: the same control will carry instructions
            that change the fleet, not only questions about it. */}
        <button
          type="submit"
          disabled={busy || awaitingDecision || draft.trim().length === 0}
          className="rounded-md bg-primary px-3.5 text-ui-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
