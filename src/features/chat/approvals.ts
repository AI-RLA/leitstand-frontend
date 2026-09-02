import { getToolName, isToolUIPart, type UIMessage } from "ai";

import type { PendingApproval } from "./ApprovalCard";

/** Strip the toolset prefix the agent applies, leaving the bare operation id the card keys on. */
export function bareToolName(part: Parameters<typeof getToolName>[0]): string {
  return getToolName(part).replace(/^leitstand_/, "");
}

/**
 * Pull the actuations this message proposed, and what the operator decided about each.
 *
 * A call awaiting a decision arrives in the `approval-requested` state carrying the arguments and
 * an approval id; answering moves it to `approval-responded`. Both are returned so the card can
 * take its enabled state from the part itself: component state would forget the decision when the
 * panel unmounts, bringing the buttons back on an already-answered proposal.
 *
 * Lives apart from the panel because the header reads it too, to say how many decisions are
 * waiting while the drawer is shut.
 */
export function pendingApprovalsOf(message: UIMessage): PendingApproval[] {
  const out: PendingApproval[] = [];
  for (const part of message.parts) {
    if (!isToolUIPart(part)) continue;
    if (
      part.state !== "approval-requested" &&
      part.state !== "approval-responded"
    )
      continue;
    const approval = part.approval;
    if (!approval?.id) continue;
    out.push({
      toolName: bareToolName(part),
      input: (part.input ?? {}) as Record<string, unknown>,
      approvalId: approval.id,
      decision:
        part.state === "approval-responded"
          ? approval.approved
            ? "approved"
            : "denied"
          : undefined,
    });
  }
  return out;
}
